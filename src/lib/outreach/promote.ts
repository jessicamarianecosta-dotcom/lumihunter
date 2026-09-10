/**
 * Fase 4 — promoção automática de descobertas para a fila de envio.
 *
 *   descoberta qualificada (passou em TODOS os gates)
 *     → lead + campaign_target
 *     → mensagem gerada (anônima — nunca cita o nome da empresa)
 *     → validateProspectForAutomaticOutreach()
 *     → outreach_queue status "ready"  (sem aprovação manual)
 *
 * A fila de envio (janela / limite diário / intervalo / opt-out / disjuntor /
 * catálogo) é a MESMA da Fase 2 — nada aqui tenta burlar limites.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { normalizePhoneBR, normalizeEmail } from "@/lib/utils";
import { checkLeadQuota } from "@/lib/limits";
import { hostOf } from "@/lib/discovery/extract";
import { prepareMessages, type OutreachLead } from "./messages";
import { mentionsCompanyName } from "./vars";
import { resolveCampaignCatalogPdf } from "./catalog";
import { isBlocked } from "./optout";
import { validateProspectForAutomaticOutreach, regionMatches } from "./eligibility";
import { markConversationOutreach } from "./conversation";

type Admin = SupabaseClient<Database>;
type Discovery = Database["public"]["Tables"]["lead_discoveries"]["Row"];

export interface PromoteCampaign {
  id: string;
  name: string;
  channel: string;
  status: string;
  product_id: string | null;
  product_text: string | null;
  outreach_automatic: boolean;
  outreach_base_message: string | null;
  outreach_personalize_ai: boolean;
  outreach_send_catalog: boolean;
  outreach_catalog_pdf_id: string | null;
  /** regiões da campanha — usadas para confirmar a região por dado estruturado. */
  regions?: string[] | null;
}

export interface PromotedLead {
  discovery: Discovery;
  leadId: string;
  targetId: string;
}

export interface ApproveResult {
  approved: number;
  leadsCreated: number;
  targetsCreated: number;
  promoted: PromotedLead[];
}

/**
 * Cria/vincula lead + campaign_target para cada descoberta. NÃO envia nada.
 * `discoveryIds` opcional — sem ele, promove todas as `status='qualified'` da
 * rodada atual da campanha que ainda não foram aprovadas.
 */
export async function approveDiscoveries(
  admin: Admin,
  args: {
    companyId: string;
    campaignId: string;
    userId: string | null;
    discoveryIds?: string[];
    /** Só descobertas desta rodada (para o fluxo automático pós-busca). */
    discoveryRunId?: string | null;
  },
): Promise<ApproveResult & { quotaError?: string }> {
  let q = admin
    .from("lead_discoveries")
    .select("*")
    .eq("company_id", args.companyId)
    .eq("campaign_id", args.campaignId)
    .neq("status", "approved");
  if (args.discoveryIds?.length) q = q.in("id", args.discoveryIds);
  else q = q.eq("status", "qualified");
  if (args.discoveryRunId) q = q.eq("discovery_run_id", args.discoveryRunId);

  const { data } = await q;
  const pending = (data ?? []).filter((d) => d.status === "qualified" || args.discoveryIds?.includes(d.id));
  const empty: ApproveResult = { approved: 0, leadsCreated: 0, targetsCreated: 0, promoted: [] };
  if (pending.length === 0) return empty;

  const { data: existingLeads } = await admin
    .from("leads")
    .select("id, name, website, phone, whatsapp, city")
    .eq("company_id", args.companyId);

  const byDomain = new Map<string, string>();
  const byPhone = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const l of existingLeads ?? []) {
    if (l.website) byDomain.set(hostOf(l.website), l.id);
    for (const p of [l.phone, l.whatsapp]) {
      const digits = (p ?? "").replace(/\D/g, "");
      if (digits.length >= 10) byPhone.set(digits, l.id);
    }
    byName.set(`${l.name.trim().toLowerCase()}|${(l.city ?? "").trim().toLowerCase()}`, l.id);
  }

  const findExisting = (d: Discovery): string | null => {
    if (d.website) {
      const hit = byDomain.get(hostOf(d.website));
      if (hit) return hit;
    }
    for (const p of [d.whatsapp, d.phone]) {
      const digits = (p ?? "").replace(/\D/g, "");
      if (digits.length >= 10 && byPhone.has(digits)) return byPhone.get(digits)!;
    }
    return byName.get(`${d.company_name.trim().toLowerCase()}|${(d.city ?? "").trim().toLowerCase()}`) ?? null;
  };

  const willCreate = pending.filter((d) => !findExisting(d)).length;
  if (willCreate > 0) {
    const quota = await checkLeadQuota(admin, args.companyId, willCreate);
    if (!quota.ok) return { ...empty, quotaError: quota.message };
  }

  const { data: stage } = await admin
    .from("pipeline_stages")
    .select("id")
    .eq("company_id", args.companyId)
    .eq("slug", "new")
    .maybeSingle();

  const out: ApproveResult = { approved: 0, leadsCreated: 0, targetsCreated: 0, promoted: [] };

  for (const d of pending) {
    let leadId = findExisting(d);
    if (!leadId) {
      const { data: created, error } = await admin
        .from("leads")
        .insert({
          company_id: args.companyId,
          stage_id: stage?.id ?? null,
          status: "new",
          source: "discovery",
          name: d.company_name,
          legal_name: d.legal_name,
          segment: d.segment,
          description: d.description,
          city: d.city,
          state: d.state,
          address: d.address,
          phone: normalizePhoneBR(d.phone),
          whatsapp: normalizePhoneBR(d.whatsapp),
          email: normalizeEmail(d.email),
          website: d.website,
          instagram: d.instagram,
          notes: d.source_url ? `Descoberto via ${d.source}: ${d.source_url}` : null,
          score: d.score,
          score_reason: d.qualification_reason,
          score_factors: d.qualification_signals,
          ai_summary: d.qualification_reason,
        })
        .select("id")
        .single();
      if (error || !created) {
        console.error("[promote] lead insert", error);
        continue;
      }
      leadId = created.id;
      out.leadsCreated++;
      if (d.website) byDomain.set(hostOf(d.website), leadId);
      byName.set(`${d.company_name.trim().toLowerCase()}|${(d.city ?? "").trim().toLowerCase()}`, leadId);
    }

    let targetId: string | null = null;
    const { data: existingTarget } = await admin
      .from("campaign_targets")
      .select("id")
      .eq("campaign_id", args.campaignId)
      .eq("lead_id", leadId)
      .maybeSingle();
    if (existingTarget) {
      targetId = existingTarget.id;
    } else {
      const { data: t, error: tErr } = await admin
        .from("campaign_targets")
        .insert({
          company_id: args.companyId,
          campaign_id: args.campaignId,
          lead_id: leadId,
          status: "pending",
        })
        .select("id")
        .single();
      if (tErr || !t) continue;
      targetId = t.id;
      out.targetsCreated++;
    }

    await admin
      .from("lead_discoveries")
      .update({
        status: "approved",
        lead_id: leadId,
        approved_at: new Date().toISOString(),
        approved_by: args.userId,
      })
      .eq("id", d.id);
    out.approved++;
    out.promoted.push({ discovery: d, leadId, targetId });
  }

  return out;
}

export interface EnqueueResult {
  enqueued: number;
  skipped: { leadId: string; reason: string }[];
  aiUsed: boolean;
  nameLeaksFixed: number;
  catalog: string | null;
}

/**
 * Região compatível — SEM exigir frase dentro de `evidence`.
 *
 *  1. a descoberta já é `qualified`/`approved` → a região JÁ foi confirmada no
 *     gate duro da descoberta (`qualify()` reprova quem não bate a região);
 *  2. cidade/UF estruturada da descoberta bate com as regiões da campanha;
 *  3. (legado) marcador "Na região" na evidência ou sinal "Região compatível".
 */
const regionConfirmed = (d: Discovery, regions?: string[] | null): boolean => {
  if (d.status === "qualified" || d.status === "approved") return true;
  if (regionMatches(regions ?? [], d.city, d.state)) return true;
  const inEvidence =
    Array.isArray(d.evidence) &&
    (d.evidence as unknown[]).some(
      (e) => typeof e === "string" && e.startsWith("Na região"),
    );
  if (inEvidence) return true;
  const inSignals =
    Array.isArray(d.qualification_signals) &&
    (d.qualification_signals as { label?: string }[]).some(
      (s) => typeof s?.label === "string" && s.label.startsWith("Região"),
    );
  return inSignals;
};

/**
 * Gera a mensagem, valida cada contato em `validateProspectForAutomaticOutreach`
 * e insere na `outreach_queue`. `auto=true` → status "ready" (envio automático);
 * `auto=false` → status "draft" (revisão manual, comportamento da Fase 2).
 */
export async function enqueueOutreach(
  admin: Admin,
  args: {
    companyId: string;
    companyName: string;
    campaign: PromoteCampaign;
    userId: string | null;
    promoted: PromotedLead[];
    auto: boolean;
  },
): Promise<EnqueueResult> {
  const { campaign } = args;
  const result: EnqueueResult = { enqueued: 0, skipped: [], aiUsed: false, nameLeaksFixed: 0, catalog: null };
  if (args.promoted.length === 0) return result;

  // produto foco
  let productName = campaign.product_text?.trim() || "";
  if (!productName && campaign.product_id) {
    const { data: p } = await admin
      .from("products")
      .select("name")
      .eq("id", campaign.product_id)
      .maybeSingle();
    productName = p?.name ?? "";
  }

  const { data: catalogProducts } = await admin
    .from("products")
    .select("name, keywords")
    .eq("company_id", args.companyId)
    .eq("is_active", true)
    .limit(40);
  const catalogItems = (catalogProducts ?? []).map((p) => p.name);
  const catalogKeywords = (catalogProducts ?? []).flatMap((p) => p.keywords ?? []);

  const catalogPdf = campaign.outreach_send_catalog
    ? await resolveCampaignCatalogPdf(
        admin,
        args.companyId,
        { outreach_catalog_pdf_id: campaign.outreach_catalog_pdf_id, product_id: campaign.product_id },
        args.companyName,
      )
    : null;
  result.catalog = catalogPdf?.filename ?? null;

  // pula quem já tem item na fila
  const { data: existingQ } = await admin
    .from("outreach_queue")
    .select("campaign_target_id")
    .eq("campaign_id", campaign.id);
  const inQueue = new Set((existingQ ?? []).map((e) => e.campaign_target_id));

  const fresh = args.promoted.filter((pr) => !inQueue.has(pr.targetId));
  if (fresh.length === 0) return result;

  // leads (whatsapp + segmento) para a geração de mensagem
  const leadIds = fresh.map((pr) => pr.leadId);
  const { data: leadRows } = await admin
    .from("leads")
    .select("id, name, city, state, segment, whatsapp, phone, website, instagram")
    .in("id", leadIds)
    .eq("company_id", args.companyId);
  const leadById = new Map((leadRows ?? []).map((l) => [l.id, l]));

  const outreachLeads: OutreachLead[] = fresh.map((pr) => {
    const l = leadById.get(pr.leadId);
    const d = pr.discovery;
    return {
      leadId: pr.leadId,
      companyName: l?.name ?? d.company_name,
      city: l?.city ?? d.city,
      state: l?.state ?? d.state,
      segment: l?.segment ?? d.segment,
      contactName: null,
      website: l?.website ?? d.website,
      instagram: l?.instagram ?? d.instagram,
      evidence: Array.isArray(d.evidence) ? (d.evidence as string[]) : [],
      buyerFit: d.buyer_fit_score,
      productFit: d.product_fit_score,
    };
  });

  const prepared = await prepareMessages({
    companyId: args.companyId,
    campaignId: campaign.id,
    productName: productName || "materiais personalizados",
    catalogItems,
    catalogKeywords,
    baseMessage: campaign.outreach_base_message,
    personalizeAi: campaign.outreach_personalize_ai,
    leads: outreachLeads,
    userId: args.userId,
    anonymize: true,
  });
  result.aiUsed = prepared.some((m) => m.by === "ai");
  result.nameLeaksFixed = prepared.filter((m) => m.nameLeakFixed).length;
  const msgByLead = new Map(prepared.map((m) => [m.leadId, m]));

  const now = new Date().toISOString();
  const rows: Database["public"]["Tables"]["outreach_queue"]["Insert"][] = [];

  for (const pr of fresh) {
    const d = pr.discovery;
    const l = leadById.get(pr.leadId);
    const message = msgByLead.get(pr.leadId)?.body ?? null;
    const to = normalizePhoneBR(l?.whatsapp ?? l?.phone ?? d.whatsapp ?? null);
    const blocked = await isBlocked(admin, args.companyId, to);

    const { count: inbound } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", pr.leadId)
      .eq("direction", "inbound");

    const check = validateProspectForAutomaticOutreach({
      individualBusiness: d.individual_business,
      competitor: d.competitor,
      resultType: d.result_type,
      regionConfirmed: regionConfirmed(d, campaign.regions),
      whatsappVerified: d.whatsapp_verified,
      whatsapp: to,
      buyerFit: d.buyer_fit_score,
      productFit: d.product_fit_score,
      productMatchName: d.product_match_name,
      blocked,
      campaignActive: campaign.status === "active",
      automaticEnabled: args.auto ? campaign.outreach_automatic : true,
      channel: campaign.channel,
      hasMessage: !!message?.trim(),
      messageMentionsName: mentionsCompanyName(message ?? "", l?.name ?? d.company_name),
      alreadyInFlightOrDone: false,
      alreadyReplied: (inbound ?? 0) > 0,
    });

    if (!check.ok) {
      result.skipped.push({ leadId: pr.leadId, reason: check.reason ?? "inelegível" });
      // registra o descarte para auditoria (não bloqueia a fila)
      rows.push({
        company_id: args.companyId,
        campaign_id: campaign.id,
        campaign_target_id: pr.targetId,
        lead_id: pr.leadId,
        status: "skipped",
        message_body: message,
        personalized_by: msgByLead.get(pr.leadId)?.by ?? "base",
        catalog_included: !!catalogPdf,
        auto_enqueued: args.auto,
        failure_code: check.code ?? "ineligible",
        failure_reason: check.reason ?? null,
        created_by: args.userId,
      });
      continue;
    }

    rows.push({
      company_id: args.companyId,
      campaign_id: campaign.id,
      campaign_target_id: pr.targetId,
      lead_id: pr.leadId,
      status: args.auto ? "ready" : "draft",
      scheduled_at: args.auto ? now : null,
      message_body: message,
      personalized_by: msgByLead.get(pr.leadId)?.by ?? "base",
      catalog_included: !!catalogPdf,
      auto_enqueued: args.auto,
      created_by: args.userId,
    });
    result.enqueued++;
  }

  if (rows.length) {
    const { error } = await admin
      .from("outreach_queue")
      .upsert(rows, { onConflict: "campaign_target_id", ignoreDuplicates: true });
    if (error) {
      console.error("[promote] enqueue insert", error);
      return { ...result, enqueued: 0 };
    }
  }

  // cria a conversa "Na fila" para cada abordagem enfileirada — ela já aparece
  // em Conversas com estado claro (não finge que foi enviada)
  for (const r of rows) {
    if (r.status !== "ready" && r.status !== "draft") continue;
    await markConversationOutreach(admin, {
      companyId: args.companyId,
      leadId: r.lead_id!,
      campaignId: campaign.id,
      state: "queued",
      preview: r.message_body ?? null,
    });
  }

  return result;
}

/**
 * Reprocessa os contatos que ficaram travados como `outreach_queue.status =
 * 'skipped'` (ex.: barrados por um portão antigo que já foi corrigido).
 *
 *   apaga os itens 'skipped' da campanha  → NÃO conta como envio, não há
 *   provider_message_id, não havia conversa criada
 *     → reconstrói a lista de aprovados (lead + campaign_target)
 *     → chama enqueueOutreach(auto=true): gera mensagem, revalida no portão
 *       ATUAL e enfileira 'ready' (ou volta a 'skipped' com o motivo real).
 *
 * Itens que JÁ estão `ready/sending/sent/delivered/read/replied` não são
 * tocados — sem risco de envio em dobro.
 */
export async function reprocessSkipped(
  admin: Admin,
  args: {
    companyId: string;
    companyName: string;
    campaign: PromoteCampaign;
    userId: string | null;
  },
): Promise<{ deletedSkipped: number; promoted: number } & EnqueueResult> {
  const { campaign } = args;

  const { data: skipped } = await admin
    .from("outreach_queue")
    .select("id, campaign_target_id, lead_id")
    .eq("company_id", args.companyId)
    .eq("campaign_id", campaign.id)
    .eq("status", "skipped");

  const stuck = (skipped ?? []).filter((s) => s.lead_id && s.campaign_target_id);
  const empty: { deletedSkipped: number; promoted: number } & EnqueueResult = {
    deletedSkipped: 0,
    promoted: 0,
    enqueued: 0,
    skipped: [],
    aiUsed: false,
    nameLeaksFixed: 0,
    catalog: null,
  };
  if (stuck.length === 0) return empty;

  await admin
    .from("outreach_queue")
    .delete()
    .in(
      "id",
      stuck.map((s) => s.id),
    );

  // descobertas correspondentes (para buyer/product fit, evidências, gates)
  const leadIds = [...new Set(stuck.map((s) => s.lead_id as string))];
  const { data: discs } = await admin
    .from("lead_discoveries")
    .select("*")
    .eq("company_id", args.companyId)
    .eq("campaign_id", campaign.id)
    .in("lead_id", leadIds);
  const discByLead = new Map((discs ?? []).map((d) => [d.lead_id, d]));

  const promoted: PromotedLead[] = [];
  for (const s of stuck) {
    const d = discByLead.get(s.lead_id as string);
    if (!d) continue;
    promoted.push({
      discovery: d as Discovery,
      leadId: s.lead_id as string,
      targetId: s.campaign_target_id as string,
    });
  }
  if (promoted.length === 0) return { ...empty, deletedSkipped: stuck.length };

  const enq = await enqueueOutreach(admin, {
    companyId: args.companyId,
    companyName: args.companyName,
    campaign,
    userId: args.userId,
    promoted,
    auto: true,
  });

  return { deletedSkipped: stuck.length, promoted: promoted.length, ...enq };
}
