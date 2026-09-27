/**
 * DESCOBERTA EM ESCALA — o processo em batches.
 *
 * A rodada deixa de ser "uma busca" e passa a ser um PROCESSO:
 *   1. o plano completo de consultas (segmento × bairro × intenção) é montado
 *      uma vez e guardado em `discovery_runs.pending_queries`;
 *   2. a primeira leva roda na hora (rota /discover) → resultado imediato;
 *   3. um cron (`/api/cron/discovery`) drena o resto, batch a batch, até
 *      atingir `campaigns.max_opportunities`, esgotar as consultas ou a
 *      campanha sair de "ativa".
 *
 * `planNextBatch` / `applyBatch` são puros (testáveis). `runScaleBatch` é a
 * orquestração com banco, compartilhada pela rota e pelo cron.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { runDiscovery, primeTavilyKey } from "./index";
import { heuristicBuyerProfile, getCampaignProductContext } from "./product-context";
import type { CampaignBrief, DiscoveredCompany, QueryLogRow } from "./types";
import { approveDiscoveries, enqueueOutreach } from "@/lib/outreach/promote";
import { expandSearchStrategy, normalizeExpansionState } from "./expand";

type Admin = SupabaseClient<Database>;

export const SCALE_BATCH_SIZE = 12;
export const SCALE_PER_QUERY = 6;

// ── Planejamento (puro) ──────────────────────────────────────────────────

export interface ScaleState {
  pendingQueries: string[];
  usedQueries: string[];
  batchCount: number;
  candidatesCount: number;
  targetOpportunities: number;
}

export type StopReason = "target_reached" | "queries_exhausted";

/**
 * Quantos leads deste batch ainda cabem na meta antes de virar excedente
 * (reserva). Função pura — usada pelo envio automático para não promover
 * mais leads do que `targetOpportunities` mesmo que o batch tenha
 * qualificado mais do que isso.
 */
export function capacityRemaining(alreadyApproved: number, targetOpportunities: number): number {
  return Math.max(0, targetOpportunities - Math.max(0, alreadyApproved));
}

export function planNextBatch(
  state: ScaleState,
  batchSize = SCALE_BATCH_SIZE,
): { queries: string[]; done: boolean; reason?: StopReason } {
  if (state.candidatesCount >= state.targetOpportunities)
    return { queries: [], done: true, reason: "target_reached" };
  if (state.pendingQueries.length === 0)
    return { queries: [], done: true, reason: "queries_exhausted" };
  return { queries: state.pendingQueries.slice(0, batchSize), done: false };
}

export function applyBatch(
  state: ScaleState,
  batch: string[],
  addedCandidates: number,
): ScaleState {
  const used = new Set(batch);
  return {
    pendingQueries: state.pendingQueries.filter((q) => !used.has(q)),
    usedQueries: [...state.usedQueries, ...batch],
    batchCount: state.batchCount + 1,
    candidatesCount: state.candidatesCount + addedCandidates,
    targetOpportunities: state.targetOpportunities,
  };
}

// ── Persistência de descobertas (compartilhada com a rota single) ─────────

export function mapDiscoveryRow(
  c: DiscoveredCompany,
  meta: {
    companyId: string;
    campaignId: string;
    runId: string;
    channelRequirement: "whatsapp" | "email" | "none";
    status: "qualified" | "rejected" | "approved";
    priorLeadId?: string | null;
    approvedAt?: string | null;
    approvedBy?: string | null;
  },
) {
  return {
    company_id: meta.companyId,
    campaign_id: meta.campaignId,
    discovery_run_id: meta.runId,
    lead_id: meta.priorLeadId ?? null,
    approved_at: meta.approvedAt ?? null,
    approved_by: meta.approvedBy ?? null,
    company_name: c.companyName,
    legal_name: c.legalName,
    segment: c.segment,
    description: c.description,
    city: c.city,
    state: c.state,
    country: c.country,
    address: c.address,
    phone: c.phone,
    whatsapp: c.whatsapp,
    email: c.email,
    website: c.website,
    instagram: c.instagram,
    source: c.source,
    source_url: c.sourceUrl,
    discovery_query: c.discoveryQuery,
    raw: c.raw as unknown as Json,
    dedupe_key: c.dedupeKey,
    result_type: c.resultType,
    business_type: c.businessType,
    source_quality: c.sourceQuality,
    individual_business: c.individualBusiness,
    competitor: c.competitor,
    whatsapp_verified: c.whatsappVerified,
    whatsapp_evidence: c.whatsappEvidence,
    channel_requirement: meta.channelRequirement,
    score: c.score,
    buyer_fit_score: c.buyerFitScore,
    product_fit_score: c.productFitScore,
    business_fit_score: c.businessFitScore,
    product_match_name: c.productMatch?.name ?? null,
    product_match_reason: c.productMatch?.reason ?? null,
    qualification: c.qualification,
    qualification_reason: c.qualificationReason,
    qualification_signals: c.qualificationSignals as unknown as Json,
    evidence: c.evidence as unknown as Json,
    discard_reason: c.discardReason,
    qualified_by: c.qualifiedBy,
    recommended_approach: c.recommendedApproach,
    status: meta.status,
  };
}

export async function writeDiscoveryLog(
  admin: Admin,
  meta: { companyId: string; campaignId: string; runId: string; batch: number },
  rows: QueryLogRow[],
): Promise<void> {
  if (rows.length === 0) return;
  await admin.from("discovery_log").insert(
    rows.map((r) => ({
      company_id: meta.companyId,
      campaign_id: meta.campaignId,
      discovery_run_id: meta.runId,
      batch: meta.batch,
      query: r.query,
      source: r.source,
      results_returned: r.resultsReturned,
      new_candidates: r.newCandidates,
      duplicates: r.duplicates,
      rejected: r.rejected,
      reject_breakdown: r.rejectBreakdown as unknown as Json,
      qualified: r.qualified,
      whatsapp_found: r.whatsappFound,
      whatsapp_confirmed: r.whatsappConfirmed,
    })),
  );
}

// ── Reconstrução do brief SEM IA (para o cron) ──────────────────────────

async function rebuildBrief(
  admin: Admin,
  run: {
    company_id: string;
    campaign_id: string;
    buyer_segments: Json;
  },
): Promise<CampaignBrief | null> {
  const { data: campaign } = await admin
    .from("campaigns")
    .select(
      "id, name, channel, status, product_id, product_text, audience_text, regions, segment, city, goal",
    )
    .eq("id", run.campaign_id)
    .maybeSingle();
  if (!campaign) return null;

  const productContext = await getCampaignProductContext(admin, run.company_id, campaign);
  if (!productContext) return null;

  const audience = campaign.audience_text?.trim() || campaign.segment?.trim() || "";
  const regions = (campaign.regions?.length ? campaign.regions : campaign.city ? [campaign.city] : [])
    .map((r) => r.trim())
    .filter(Boolean);

  const stored = Array.isArray(run.buyer_segments)
    ? (run.buyer_segments as unknown[]).filter((s): s is string => typeof s === "string")
    : [];
  const hp = heuristicBuyerProfile(productContext, audience);
  const buyerProfile = stored.length ? { ...hp, buyerSegments: stored } : hp;

  const channelRequirement: "whatsapp" | "email" | "none" =
    campaign.channel === "whatsapp" ? "whatsapp" : campaign.channel === "email" ? "email" : "none";

  return {
    id: campaign.id,
    companyId: run.company_id,
    name: campaign.name,
    product: productContext.name,
    productContext,
    buyerProfile,
    audience,
    regions,
    channel: campaign.channel,
    channelRequirement,
  };
}

// ── Orquestração de um batch (cron) ─────────────────────────────────────

export interface BatchOutcome {
  runId: string;
  ran: boolean;
  batch: number;
  queriesUsed: number;
  inserted: number;
  qualified: number;
  enqueued: number;
  done: boolean;
  reason?: StopReason | "not_active" | "no_brief";
}

export async function runScaleBatch(
  admin: Admin,
  runId: string,
  opts: { batches?: number; deadlineMs?: number } = {},
): Promise<BatchOutcome> {
  const maxBatches = Math.max(1, opts.batches ?? 1);
  // Cada batch agora pode envolver 2 fontes de busca + eventualmente 1
  // chamada de IA (camada 2 da expansão) — mais lento que antes. Não inicia
  // um novo batch se já não houver tempo hábil para ele terminar dentro do
  // maxDuration da função serverless (evita o 504 "Task timed out").
  const deadline = Date.now() + (opts.deadlineMs ?? 90_000);
  let last: BatchOutcome = {
    runId, ran: false, batch: 0, queriesUsed: 0, inserted: 0, qualified: 0, enqueued: 0, done: false,
  };

  for (let i = 0; i < maxBatches; i++) {
    if (Date.now() > deadline) break;
    const { data: run } = await admin
      .from("discovery_runs")
      .select(
        "id, company_id, campaign_id, scale_status, batch_count, candidates_count, target_opportunities, pending_queries, used_queries, buyer_segments, expansion_state",
      )
      .eq("id", runId)
      .maybeSingle();
    if (!run || run.scale_status !== "active") {
      return { ...last, done: true, reason: "not_active" };
    }

    // chave do Tavily da integração `search` da empresa (fallback da env)
    await primeTavilyKey(admin, run.company_id);

    const { data: campaign } = await admin
      .from("campaigns")
      .select(
        "id, company_id, name, channel, status, regions, product_id, product_text, outreach_automatic, outreach_status, outreach_base_message, outreach_personalize_ai, outreach_send_catalog, outreach_catalog_pdf_id, max_opportunities",
      )
      .eq("id", run.campaign_id)
      .maybeSingle();
    if (!campaign || campaign.status !== "active") {
      await admin.from("discovery_runs").update({ scale_status: "stopped" }).eq("id", runId);
      return { ...last, done: true, reason: "not_active" };
    }

    const pending = (Array.isArray(run.pending_queries) ? run.pending_queries : []).filter(
      (q): q is string => typeof q === "string",
    );
    const used = (Array.isArray(run.used_queries) ? run.used_queries : []).filter(
      (q): q is string => typeof q === "string",
    );

    const state: ScaleState = {
      pendingQueries: pending,
      usedQueries: used,
      batchCount: run.batch_count ?? 0,
      candidatesCount: run.candidates_count ?? 0,
      targetOpportunities: run.target_opportunities ?? campaign.max_opportunities ?? 250,
    };

    const brief = await rebuildBrief(admin, run);
    if (!brief) {
      await admin.from("discovery_runs").update({ scale_status: "stopped" }).eq("id", runId);
      return { ...last, done: true, reason: "no_brief" };
    }

    let plan = planNextBatch(state);
    if (plan.done && plan.reason === "queries_exhausted") {
      // A quantidade pedida é a quantidade FINAL de leads válidos — não para
      // só porque o plano inicial de consultas acabou. Expande a estratégia
      // (mais variações, mais segmentos via IA, mais regiões) antes de desistir.
      const expansionState = normalizeExpansionState(run.expansion_state);
      const expansion = await expandSearchStrategy({
        companyId: run.company_id,
        brief,
        usedQueries: state.usedQueries,
        expansionState,
      });

      if (expansion.queries.length > 0) {
        state.pendingQueries = expansion.queries;
        await admin
          .from("discovery_runs")
          .update({
            pending_queries: expansion.queries as unknown as Json,
            expansion_state: expansion.nextState as unknown as Json,
          })
          .eq("id", runId);
        plan = planNextBatch(state);
      } else {
        await admin
          .from("discovery_runs")
          .update({
            scale_status: "exhausted",
            expansion_state: expansion.nextState as unknown as Json,
          })
          .eq("id", runId);
        await admin.from("activities").insert({
          company_id: run.company_id,
          kind: "system",
          title: "Descoberta de leads encerrada",
          body:
            `Meta de ${state.targetOpportunities} leads válidos não atingida ` +
            `(chegou a ${state.candidatesCount}) — esgotadas todas as camadas de busca ` +
            `disponíveis (segmentos, variações de termo, regiões e fontes configuradas) ` +
            `para "${brief.audience || brief.productContext.name}" em ${brief.regions.join(", ") || "—"}.`,
        });
        return { ...last, done: true, reason: plan.reason };
      }
    }

    if (plan.done) {
      // target_reached (ou, em tese, ainda exhausted após a expansão falhar)
      await admin.from("discovery_runs").update({ scale_status: "exhausted" }).eq("id", runId);
      return { ...last, done: true, reason: plan.reason };
    }

    // dedupe contra tudo que a rodada já achou
    const { data: existing } = await admin
      .from("lead_discoveries")
      .select("dedupe_key")
      .eq("discovery_run_id", runId);
    const existingKeys = new Set((existing ?? []).map((e) => e.dedupe_key));

    const result = await runDiscovery({
      brief,
      queries: plan.queries,
      existingKeys,
      perQuery: SCALE_PER_QUERY,
      maxCandidates: 120,
    });

    const batchNo = state.batchCount + 1;
    const channelRequirement = brief.channelRequirement;

    const rows = [
      ...result.qualified.map((c) =>
        mapDiscoveryRow(c, {
          companyId: run.company_id,
          campaignId: run.campaign_id,
          runId,
          channelRequirement,
          status: "qualified" as const,
        }),
      ),
      ...result.rejected.map((c) =>
        mapDiscoveryRow(c, {
          companyId: run.company_id,
          campaignId: run.campaign_id,
          runId,
          channelRequirement,
          status: "rejected" as const,
        }),
      ),
    ];

    let inserted = 0;
    if (rows.length) {
      const { data } = await admin
        .from("lead_discoveries")
        .upsert(rows, { onConflict: "discovery_run_id,dedupe_key", ignoreDuplicates: true })
        .select("id");
      inserted = data?.length ?? 0;
    }

    await writeDiscoveryLog(
      admin,
      { companyId: run.company_id, campaignId: run.campaign_id, runId, batch: batchNo },
      result.queryLog,
    );

    const next = applyBatch(state, plan.queries, result.qualified.length);
    // Só encerra de fato ao atingir a meta. Ficar sem `pendingQueries` NÃO
    // encerra a rodada — a próxima chamada tenta expandir a estratégia
    // (`expandSearchStrategy`, no topo deste laço) antes de desistir. É
    // exatamente essa distinção que corrige o encerramento prematuro (parar
    // em 338/500 só porque a lista inicial de consultas acabou).
    const targetReached = next.candidatesCount >= next.targetOpportunities;

    await admin
      .from("discovery_runs")
      .update({
        batch_count: next.batchCount,
        candidates_count: next.candidatesCount,
        pending_queries: next.pendingQueries as unknown as Json,
        used_queries: next.usedQueries as unknown as Json,
        last_batch_at: new Date().toISOString(),
        scale_status: targetReached ? "exhausted" : "active",
        found: (run.candidates_count ?? 0) + result.qualified.length,
        qualified: next.candidatesCount,
      })
      .eq("id", runId);

    await admin
      .from("campaigns")
      .update({ last_discovery_at: new Date().toISOString() })
      .eq("id", run.campaign_id);

    // ── Envio automático desta leva ──────────────────────────────────
    let enqueued = 0;
    // ── Excedentes: se este batch ultrapassa a meta, só promove até
    // completar `targetOpportunities` — o resto fica como reserva (status
    // "qualified", visível na revisão, mas sem entrar na fila de envio
    // automaticamente). remainingCapacity=0 → nada a promover neste batch.
    const alreadyApproved = Math.max(0, next.candidatesCount - result.qualified.length);
    const remainingCapacity = capacityRemaining(alreadyApproved, state.targetOpportunities);

    if (
      campaign.outreach_automatic &&
      campaign.channel === "whatsapp" &&
      campaign.outreach_status !== "paused" &&
      result.qualified.length > 0 &&
      remainingCapacity > 0
    ) {
      try {
        const { data: co } = await admin
          .from("companies")
          .select("name")
          .eq("id", run.company_id)
          .maybeSingle();

        let discoveryIds: string[] | undefined;
        if (result.qualified.length > remainingCapacity) {
          const dedupeKeys = result.qualified.slice(0, remainingCapacity).map((c) => c.dedupeKey);
          const { data: matched } = await admin
            .from("lead_discoveries")
            .select("id, dedupe_key")
            .eq("discovery_run_id", runId)
            .in("dedupe_key", dedupeKeys);
          discoveryIds = (matched ?? []).map((m) => m.id);
        }

        const promo = await approveDiscoveries(admin, {
          companyId: run.company_id,
          campaignId: run.campaign_id,
          userId: null,
          discoveryRunId: runId,
          ...(discoveryIds ? { discoveryIds } : {}),
        });
        const enq = await enqueueOutreach(admin, {
          companyId: run.company_id,
          companyName: co?.name ?? campaign.name,
          campaign: {
            id: campaign.id,
            name: campaign.name,
            channel: campaign.channel,
            status: campaign.status,
            product_id: campaign.product_id,
            product_text: campaign.product_text,
            outreach_automatic: campaign.outreach_automatic,
            outreach_base_message: campaign.outreach_base_message,
            outreach_personalize_ai: campaign.outreach_personalize_ai,
            outreach_send_catalog: campaign.outreach_send_catalog,
            outreach_catalog_pdf_id: campaign.outreach_catalog_pdf_id,
            regions: campaign.regions,
          },
          userId: null,
          promoted: promo.promoted,
          auto: true,
        });
        enqueued = enq.enqueued;
        if (enq.enqueued > 0 && campaign.outreach_status !== "running") {
          await admin
            .from("campaigns")
            .update({
              outreach_status: "running",
              outreach_started_at: new Date().toISOString(),
              outreach_consecutive_errors: 0,
            })
            .eq("id", campaign.id);
        }
      } catch (e) {
        console.error("[scale] envio automático", e);
      }
    }

    last = {
      runId,
      ran: true,
      batch: batchNo,
      queriesUsed: plan.queries.length,
      inserted,
      qualified: result.qualified.length,
      enqueued,
      done: targetReached,
      reason: targetReached ? "target_reached" : undefined,
    };
    if (targetReached) break;
  }

  return last;
}

/** Todas as rodadas de escala ainda ativas (para o cron). */
export async function activeScaleRuns(admin: Admin): Promise<string[]> {
  const { data } = await admin
    .from("discovery_runs")
    .select("id")
    .eq("scale_status", "active")
    .order("last_batch_at", { ascending: true, nullsFirst: true });
  return (data ?? []).map((r) => r.id);
}
