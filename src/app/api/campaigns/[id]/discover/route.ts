import { NextResponse } from "next/server";
import { tryGetContext, canWrite } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";
import { enforceAiQuota } from "@/lib/limits";
import {
  runDiscovery,
  discoverySourcesConfigured,
  getCampaignProductContext,
  deriveBuyerProfile,
  TavilyError,
  tavilyErrorMessage,
  type CampaignBrief,
} from "@/lib/discovery";
import { resolveRowStatus, runStats } from "@/lib/discovery/run";

export const maxDuration = 300;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await tryGetContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!canWrite(ctx.role))
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const limited = await enforceRateLimit("ai", ctx.company.id, LIMITS.ai);
  if (limited) return limited;

  const admin = createAdminClient();
  const quota = await enforceAiQuota(admin, ctx.company.id);
  if (quota) return quota;

  const { data: campaign } = await admin
    .from("campaigns")
    .select(
      "id, name, channel, product_id, product_text, audience_text, regions, segment, city, goal",
    )
    .eq("id", id)
    .eq("company_id", ctx.company.id)
    .maybeSingle();
  if (!campaign)
    return NextResponse.json({ error: "campanha não encontrada" }, { status: 404 });

  // ── Produto real da campanha = regra de negócio da busca ───────────────
  const productContext = await getCampaignProductContext(admin, ctx.company.id, campaign);
  if (!productContext) {
    return NextResponse.json(
      {
        error:
          "Defina o produto ou serviço que deseja prospectar (no catálogo ou no campo de texto) antes de procurar leads.",
        code: "no_product",
      },
      { status: 400 },
    );
  }

  const audience = campaign.audience_text?.trim() || campaign.segment?.trim() || "";
  const regions = (
    campaign.regions && campaign.regions.length
      ? campaign.regions
      : campaign.city
        ? [campaign.city]
        : []
  )
    .map((r) => r.trim())
    .filter(Boolean);

  const missing: string[] = [];
  if (!audience) missing.push("público-alvo");
  if (regions.length === 0) missing.push("região");
  if (missing.length) {
    return NextResponse.json(
      {
        error: `Antes de buscar, defina ${missing.join(" e ")} nesta campanha.`,
        code: "campaign_incomplete",
      },
      { status: 400 },
    );
  }

  if (!discoverySourcesConfigured()) {
    return NextResponse.json(
      {
        error:
          "A busca de leads não está disponível: a integração do Tavily não está configurada no servidor (TAVILY_API_KEY).",
        code: "not_configured",
      },
      { status: 503 },
    );
  }

  // ── Concorrência: uma rodada por vez ──────────────────────────────────
  const staleCutoff = new Date(Date.now() - 6 * 60_000).toISOString();
  const { data: running } = await admin
    .from("discovery_runs")
    .select("id, started_at")
    .eq("campaign_id", id)
    .eq("status", "running")
    .gt("started_at", staleCutoff)
    .limit(1);
  if (running && running.length > 0) {
    return NextResponse.json(
      {
        error: "Já existe uma pesquisa em andamento para esta campanha. Aguarde ela terminar.",
        code: "run_in_progress",
      },
      { status: 409 },
    );
  }
  // marca rodadas travadas como falhas (não deixam a campanha bloqueada)
  await admin
    .from("discovery_runs")
    .update({ status: "failed", error: "timeout", completed_at: new Date().toISOString() })
    .eq("campaign_id", id)
    .eq("status", "running")
    .lte("started_at", staleCutoff);

  // ── Abre a nova rodada JÁ (trava concorrência durante a derivação do perfil) ─
  const { data: run, error: runErr } = await admin
    .from("discovery_runs")
    .insert({
      company_id: ctx.company.id,
      campaign_id: id,
      status: "running",
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (runErr || !run) {
    console.error("[campaigns/discover] run insert", runErr);
    return NextResponse.json(
      { error: "Não foi possível iniciar a pesquisa. Tente novamente." },
      { status: 500 },
    );
  }
  const runId = run.id;

  async function failRun(message: string) {
    await admin
      .from("discovery_runs")
      .update({ status: "failed", error: message, completed_at: new Date().toISOString() })
      .eq("id", runId);
  }

  const buyerProfile = await deriveBuyerProfile(
    ctx.company.id,
    productContext,
    audience,
  );
  await admin
    .from("discovery_runs")
    .update({
      buyer_profile_source: buyerProfile.source,
      buyer_segments: buyerProfile.buyerSegments as unknown as Json,
    })
    .eq("id", runId);

  const channelRequirement: "whatsapp" | "email" | "none" =
    campaign.channel === "whatsapp"
      ? "whatsapp"
      : campaign.channel === "email"
        ? "email"
        : "none";

  const brief: CampaignBrief = {
    id: campaign.id,
    companyId: ctx.company.id,
    name: campaign.name,
    product: productContext.name,
    productContext,
    buyerProfile,
    audience,
    regions,
    channel: campaign.channel,
    channelRequirement,
  };

  let result;
  try {
    result = await runDiscovery({ brief, userId: ctx.userId });
  } catch (e) {
    if (e instanceof TavilyError) {
      console.error("[campaigns/discover] tavily", e.code, e.message);
      await failRun(`tavily:${e.code}`);
      return NextResponse.json(
        { error: tavilyErrorMessage(e.code), code: e.code },
        { status: 502 },
      );
    }
    console.error("[campaigns/discover] erro", e);
    await failRun(String(e).slice(0, 300));
    return NextResponse.json(
      { error: "Não foi possível concluir a busca. A pesquisa anterior continua disponível." },
      { status: 500 },
    );
  }

  // ── Descobertas já aprovadas nesta campanha (carregam status entre rodadas) ─
  const { data: approvedBefore } = await admin
    .from("lead_discoveries")
    .select("dedupe_key, lead_id, approved_at, approved_by")
    .eq("campaign_id", id)
    .eq("status", "approved");
  const approvedByKey = new Map(
    (approvedBefore ?? []).map((a) => [a.dedupe_key, a]),
  );

  // ── Persistência ──────────────────────────────────────────────────────
  const allCandidates = [...result.qualified, ...result.rejected];
  const rows = allCandidates.map((c) => {
    const prior = approvedByKey.get(c.dedupeKey);
    const status = resolveRowStatus(c, prior ?? undefined);
    return {
      company_id: ctx.company.id,
      campaign_id: id,
      discovery_run_id: runId,
      lead_id: prior?.lead_id ?? null,
      approved_at: prior?.approved_at ?? null,
      approved_by: prior?.approved_by ?? null,
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
      channel_requirement: channelRequirement,
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
      status,
    };
  });

  let inserted = 0;
  if (rows.length) {
    const { data, error } = await admin
      .from("lead_discoveries")
      .upsert(rows, { onConflict: "discovery_run_id,dedupe_key", ignoreDuplicates: true })
      .select("id");
    if (error) {
      console.error("[campaigns/discover] insert", error);
      await failRun(`insert:${error.message}`.slice(0, 300));
      return NextResponse.json(
        { error: "A busca rodou, mas houve falha ao salvar. A pesquisa anterior continua disponível." },
        { status: 500 },
      );
    }
    inserted = data?.length ?? 0;
  }

  const base = runStats(result.qualified, result.rejected);
  const hardFiltered = Object.values(result.discardReasons).reduce((a, b) => a + b, 0)
    - result.rejected.length;
  const stats = {
    ...base,
    // "qualificados" da rodada = os efetivamente gravados como 'qualified'
    // (não conta os que carregaram 'approved' de rodadas anteriores)
    qualified: rows.filter((r) => r.status === "qualified").length,
    prospectable: base.found,
    discarded: result.rejected.length + Math.max(0, hardFiltered),
    rawResults: result.rawCount,
    queries: result.queries.length,
    aiUsed: result.aiUsed,
  };

  // ── Fecha a rodada e aponta a campanha para ela ──────────────────────
  await admin
    .from("discovery_runs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      queries_count: stats.queries,
      raw_count: stats.rawResults,
      found: stats.found,
      prospectable: stats.prospectable,
      qualified: stats.qualified,
      competitors: stats.competitors,
      no_whatsapp: stats.noWhatsapp,
      discarded: stats.discarded,
      ai_used: stats.aiUsed,
    })
    .eq("id", runId);

  await admin
    .from("campaigns")
    .update({
      current_discovery_run_id: runId,
      last_discovery_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("company_id", ctx.company.id);

  return NextResponse.json({
    runId,
    inserted,
    ...stats,
    discardReasons: result.discardReasons,
    buyerProfileSource: buyerProfile.source,
    buyerSegments: buyerProfile.buyerSegments.slice(0, 8),
  });
}
