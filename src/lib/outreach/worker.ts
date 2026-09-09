/**
 * Worker da fila de prospecção. Envia UM item por vez, respeitando:
 * campanha ativa · janela de horário · limite diário · intervalo mínimo ·
 * opt-out · WhatsApp confirmado · disjuntor de erros consecutivos.
 *
 * Nada aqui tenta burlar limites ou detecção — os controles são operacionais.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { normalizePhoneBR } from "@/lib/utils";
import { sendMessage, sendDocument } from "@/lib/whatsapp/service";
import { resolveCampaignCatalogPdf } from "./catalog";
import { isBlocked } from "./optout";
import { markConversationOutreach } from "./conversation";
import { checkEligibility, classifyWhatsAppError } from "./eligibility";
import {
  withinWindow,
  nextWindowStart,
  intervalElapsed,
  localDayStartUtc,
} from "./window";

type Admin = SupabaseClient<Database>;

const CIRCUIT_BREAKER = 5;
const MAX_ATTEMPTS = 3;
const SENT_STATUSES = ["sent", "delivered", "read", "replied"];

export type TickOutcome =
  | { kind: "sent"; leadId: string; simulated: boolean; remaining: number }
  | { kind: "skipped"; reason: string; remaining: number }
  | { kind: "failed"; reason: string; retry: boolean; remaining: number }
  | { kind: "empty" }
  | { kind: "waiting"; reason: string; nextAt: string | null }
  | { kind: "limit_reached"; sentToday: number; dailyLimit: number }
  | { kind: "paused"; reason: string }
  | { kind: "not_running"; reason: string };

async function remainingInQueue(admin: Admin, campaignId: string): Promise<number> {
  const { count } = await admin
    .from("outreach_queue")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .in("status", ["ready", "scheduled"]);
  return count ?? 0;
}

export async function sendNextForCampaign(
  admin: Admin,
  campaignId: string,
  opts: { manual?: boolean; manualQueueId?: string } = {},
): Promise<TickOutcome> {
  const now = new Date();

  const { data: campaign } = await admin
    .from("campaigns")
    .select(
      "id, company_id, name, channel, status, outreach_status, outreach_daily_limit, outreach_window_start, outreach_window_end, outreach_min_interval_seconds, outreach_timezone, outreach_send_catalog, outreach_catalog_pdf_id, outreach_consecutive_errors, outreach_last_sent_at, product_id",
    )
    .eq("id", campaignId)
    .maybeSingle();
  if (!campaign) return { kind: "not_running", reason: "campanha não encontrada" };

  if (campaign.channel !== "whatsapp")
    return { kind: "not_running", reason: "canal da campanha não é WhatsApp" };
  if (campaign.status !== "active")
    return { kind: "not_running", reason: "campanha não está ativa" };
  if (!opts.manual && campaign.outreach_status !== "running")
    return { kind: "not_running", reason: "fila de prospecção não está ativa" };

  if ((campaign.outreach_consecutive_errors ?? 0) >= CIRCUIT_BREAKER) {
    await admin
      .from("campaigns")
      .update({ outreach_status: "paused" })
      .eq("id", campaignId);
    await admin.from("activities").insert({
      company_id: campaign.company_id,
      kind: "system",
      title: "Fila de prospecção pausada",
      body: "Pausada automaticamente após erros consecutivos. Verifique a integração do WhatsApp.",
    });
    return { kind: "paused", reason: "erros consecutivos" };
  }

  const tz = campaign.outreach_timezone || "America/Sao_Paulo";
  if (
    !opts.manual &&
    !withinWindow(
      now,
      campaign.outreach_window_start,
      campaign.outreach_window_end,
      tz,
    )
  ) {
    return {
      kind: "waiting",
      reason: "fora do horário permitido",
      nextAt: nextWindowStart(
        now,
        campaign.outreach_window_start,
        campaign.outreach_window_end,
        tz,
      ).toISOString(),
    };
  }

  if (
    !opts.manual &&
    !intervalElapsed(
      campaign.outreach_last_sent_at,
      campaign.outreach_min_interval_seconds,
      now,
    )
  ) {
    const nextAt = campaign.outreach_last_sent_at
      ? new Date(
          new Date(campaign.outreach_last_sent_at).getTime() +
            campaign.outreach_min_interval_seconds * 1000,
        ).toISOString()
      : null;
    return { kind: "waiting", reason: "aguardando intervalo mínimo", nextAt };
  }

  const dayStart = localDayStartUtc(now, tz).toISOString();
  const { count: sentToday } = await admin
    .from("outreach_queue")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .in("status", SENT_STATUSES)
    .gte("sent_at", dayStart);
  if ((sentToday ?? 0) >= campaign.outreach_daily_limit) {
    return {
      kind: "limit_reached",
      sentToday: sentToday ?? 0,
      dailyLimit: campaign.outreach_daily_limit,
    };
  }

  // ── Reivindica o próximo item (lock otimista) ─────────────────────────
  let sel = admin
    .from("outreach_queue")
    .select("id, attempt_count, lead_id, campaign_target_id, message_body")
    .eq("campaign_id", campaignId)
    .in("status", ["ready", "scheduled"]);
  if (opts.manualQueueId) sel = sel.eq("id", opts.manualQueueId);
  const { data: candidates } = await sel
    .order("created_at", { ascending: true })
    .limit(1);
  const candidate = candidates?.[0];
  if (!candidate) return { kind: "empty" };

  const { data: claimed } = await admin
    .from("outreach_queue")
    .update({
      status: "sending",
      last_attempt_at: now.toISOString(),
      attempt_count: candidate.attempt_count + 1,
    })
    .eq("id", candidate.id)
    .in("status", ["ready", "scheduled"])
    .select("id")
    .maybeSingle();
  if (!claimed) return { kind: "empty" }; // outro processo pegou primeiro

  const remaining = () => remainingInQueue(admin, campaignId);
  const item = candidate;

  // ── Lead + elegibilidade ─────────────────────────────────────────────
  const { data: lead } = await admin
    .from("leads")
    .select("id, name, whatsapp, phone, status, city, state, segment")
    .eq("id", item.lead_id)
    .eq("company_id", campaign.company_id)
    .maybeSingle();

  const to = normalizePhoneBR(lead?.whatsapp ?? lead?.phone ?? null);
  const blocked = await isBlocked(admin, campaign.company_id, to);
  const { count: inboundCount } = await admin
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", item.lead_id)
    .eq("direction", "inbound");

  const catalog = campaign.outreach_send_catalog
    ? await resolveCampaignCatalogPdf(
        admin,
        campaign.company_id,
        { outreach_catalog_pdf_id: campaign.outreach_catalog_pdf_id, product_id: campaign.product_id },
        campaign.name,
      )
    : null;

  const elig = checkEligibility({
    whatsappVerified: !!to,
    whatsapp: to,
    blocked,
    invalidNumber: false,
    campaignStatus: campaign.status,
    channel: campaign.channel,
    hasMessage: !!item.message_body?.trim(),
    catalogRequired: campaign.outreach_send_catalog,
    catalogAvailable: !!catalog,
    alreadyReplied: lead?.status === "replied" || (inboundCount ?? 0) > 0,
    whatsappIntegrationReady: true,
  });

  if (!elig.ok) {
    await admin
      .from("outreach_queue")
      .update({
        status: elig.code === "opted_out" ? "opted_out" : "skipped",
        failure_code: elig.code ?? "ineligible",
        failure_reason: elig.reason,
      })
      .eq("id", item.id);
    if (elig.code === "opted_out")
      await markConversationOutreach(admin, {
        companyId: campaign.company_id,
        leadId: item.lead_id,
        state: "opted_out",
      });
    return { kind: "skipped", reason: elig.reason ?? "inelegível", remaining: await remaining() };
  }

  // ── Conversa ─────────────────────────────────────────────────────────
  let { data: conv } = await admin
    .from("conversations")
    .select("id")
    .eq("lead_id", item.lead_id)
    .eq("channel", "whatsapp")
    .maybeSingle();
  if (!conv) {
    const { data: created } = await admin
      .from("conversations")
      .insert({
        company_id: campaign.company_id,
        lead_id: item.lead_id,
        channel: "whatsapp",
        status: "open",
        provider: "meta",
      })
      .select("id")
      .single();
    conv = created;
  }

  await markConversationOutreach(admin, {
    companyId: campaign.company_id,
    conversationId: conv!.id,
    leadId: item.lead_id,
    campaignId: campaignId,
    state: "sending",
  });

  // ── Envia o texto ────────────────────────────────────────────────────
  const body = item.message_body!.trim();
  const textResult = await sendMessage(campaign.company_id, { to: to!, body });

  if (!textResult.ok) {
    const err = classifyWhatsAppError(textResult.error);
    const canRetry = err.transient && item.attempt_count + 1 < MAX_ATTEMPTS;
    await admin
      .from("outreach_queue")
      .update({
        status: canRetry ? "ready" : "failed",
        failed_at: canRetry ? null : now.toISOString(),
        failure_code: err.code,
        failure_reason: textResult.error ?? "falha no envio",
      })
      .eq("id", item.id);
    await admin
      .from("campaigns")
      .update({
        outreach_consecutive_errors: (campaign.outreach_consecutive_errors ?? 0) + 1,
      })
      .eq("id", campaignId);
    if (!canRetry)
      await markConversationOutreach(admin, {
        companyId: campaign.company_id,
        conversationId: conv!.id,
        leadId: item.lead_id,
        state: "failed",
      });
    return {
      kind: "failed",
      reason: textResult.error ?? "falha no envio",
      retry: canRetry,
      remaining: await remaining(),
    };
  }

  await admin.from("messages").insert({
    company_id: campaign.company_id,
    conversation_id: conv!.id,
    lead_id: item.lead_id,
    campaign_id: campaignId,
    channel: "whatsapp",
    direction: "outbound",
    status: "sent",
    body,
    provider: "meta",
    provider_message_id: textResult.providerMessageId ?? null,
    sent_at: now.toISOString(),
  });

  // ── Catálogo PDF (não bloqueia o item se falhar — o texto já foi) ─────
  let catalogMessageId: string | null = null;
  if (catalog) {
    const docResult = await sendDocument(campaign.company_id, {
      to: to!,
      link: catalog.url,
      filename: catalog.filename,
    });
    if (docResult.ok) {
      catalogMessageId = docResult.providerMessageId ?? null;
      await admin.from("messages").insert({
        company_id: campaign.company_id,
        conversation_id: conv!.id,
        lead_id: item.lead_id,
        campaign_id: campaignId,
        channel: "whatsapp",
        direction: "outbound",
        status: "sent",
        body: `[catálogo] ${catalog.filename}`,
        provider: "meta",
        provider_message_id: catalogMessageId,
        sent_at: new Date().toISOString(),
      });
    } else {
      console.error("[outreach] catálogo não enviado:", docResult.error);
    }
  }

  // ── Sucesso ──────────────────────────────────────────────────────────
  await admin
    .from("outreach_queue")
    .update({
      status: "sent",
      sent_at: now.toISOString(),
      provider_message_id: textResult.providerMessageId ?? null,
      catalog_message_id: catalogMessageId,
      catalog_included: !!catalogMessageId,
      failure_code: null,
      failure_reason: null,
    })
    .eq("id", item.id);

  await admin
    .from("campaigns")
    .update({
      outreach_last_sent_at: now.toISOString(),
      outreach_consecutive_errors: 0,
    })
    .eq("id", campaignId);

  await admin
    .from("campaign_targets")
    .update({ status: "sent", last_message_at: now.toISOString() })
    .eq("id", item.campaign_target_id);

  await markConversationOutreach(admin, {
    companyId: campaign.company_id,
    conversationId: conv!.id,
    leadId: item.lead_id,
    campaignId: campaignId,
    state: "sent",
    at: now.toISOString(),
    preview: body,
    catalogSent: !!catalogMessageId,
  });

  if (lead && (lead.status === "new" || lead.status === "qualified")) {
    await admin.from("leads").update({ status: "contacted" }).eq("id", lead.id);
  }

  await admin.from("activities").insert({
    company_id: campaign.company_id,
    lead_id: item.lead_id,
    kind: "whatsapp",
    title: textResult.simulated ? "WhatsApp enviado (simulação)" : "WhatsApp enviado",
    body: catalog ? `Mensagem + catálogo (${catalog.filename})` : "Mensagem de abordagem",
  });

  return {
    kind: "sent",
    leadId: item.lead_id,
    simulated: !!textResult.simulated,
    remaining: await remaining(),
  };
}

/** Para o cron: drena as campanhas com fila ativa, respeitando o intervalo. */
export async function drainRunningCampaigns(
  admin: Admin,
  opts: { budgetMs?: number } = {},
): Promise<{ campaigns: number; sent: number; skipped: number; failed: number }> {
  const budgetMs = opts.budgetMs ?? 240_000;
  const deadline = Date.now() + budgetMs;

  const { data: campaigns } = await admin
    .from("campaigns")
    .select("id, outreach_min_interval_seconds")
    .eq("outreach_status", "running")
    .eq("status", "active")
    .eq("channel", "whatsapp");

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const touched = new Set<string>();

  for (const c of campaigns ?? []) {
    while (Date.now() < deadline) {
      const r = await sendNextForCampaign(admin, c.id);
      touched.add(c.id);
      if (r.kind === "sent") {
        sent++;
        // respeita o intervalo antes do próximo envio DESTA campanha
        const waitMs = Math.min(
          (c.outreach_min_interval_seconds || 30) * 1000,
          Math.max(0, deadline - Date.now()),
        );
        if (waitMs > 0 && r.remaining > 0)
          await new Promise((res) => setTimeout(res, waitMs));
        continue;
      }
      if (r.kind === "skipped") {
        skipped++;
        continue;
      }
      if (r.kind === "failed") {
        failed++;
        if (!r.retry) continue;
        break; // erro transitório — deixa para a próxima execução
      }
      break; // empty | waiting | limit | paused | not_running
    }
  }

  return { campaigns: touched.size, sent, skipped, failed };
}
