import { NextResponse } from "next/server";
import { tryGetContext, canWrite } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { runCopywriter } from "@/lib/anthropic/agents/copywriter";
import { sendMessage as sendWhatsAppMessage } from "@/lib/whatsapp/service";
import { sendEmail } from "@/lib/integrations/resend";
import { getIntegrationConfig, type ResendConfig } from "@/lib/integrations/config";
import { normalizePhoneBR } from "@/lib/utils";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";
import { enforceMessageQuota } from "@/lib/limits";
import type { Lead, Product } from "@/lib/supabase/database.types";

export const maxDuration = 300;
const BATCH = 10;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await tryGetContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!canWrite(ctx.role))
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const limited = await enforceRateLimit("dispatch", ctx.company.id, LIMITS.dispatch);
  if (limited) return limited;

  const admin = createAdminClient();
  const quota = await enforceMessageQuota(admin, ctx.company.id);
  if (quota) return quota;

  const { data: campaign } = await admin
    .from("campaigns")
    .select("id, channel, product_id")
    .eq("id", id)
    .eq("company_id", ctx.company.id)
    .maybeSingle();
  if (!campaign) return NextResponse.json({ error: "campanha não encontrada" }, { status: 404 });

  const channel = campaign.channel === "email" ? "email" : "whatsapp";
  const resendConfig =
    channel === "email" ? await getIntegrationConfig<ResendConfig>(ctx.company.id, "resend") : null;

  let product: Pick<Product, "name" | "description" | "price_avg" | "applications"> | null = null;
  if (campaign.product_id) {
    const { data } = await admin
      .from("products")
      .select("name, description, price_avg, applications")
      .eq("id", campaign.product_id)
      .maybeSingle();
    product = data ?? null;
  }

  const { data: targets } = await admin
    .from("campaign_targets")
    .select("id, lead_id")
    .eq("campaign_id", id)
    .eq("status", "pending")
    .limit(BATCH);

  const { data: blacklist } = await admin
    .from("blacklist")
    .select("value")
    .eq("company_id", ctx.company.id)
    .eq("channel", channel);
  const blocked = new Set((blacklist ?? []).map((b) => b.value));

  let sent = 0;
  let skipped = 0;
  let simulated = false;

  for (const t of targets ?? []) {
    const { data: lead } = await admin
      .from("leads")
      .select("*")
      .eq("id", t.lead_id)
      .maybeSingle();
    if (!lead) {
      await admin.from("campaign_targets").update({ status: "skipped" }).eq("id", t.id);
      skipped++;
      continue;
    }

    const target =
      channel === "whatsapp"
        ? normalizePhoneBR(lead.whatsapp ?? lead.phone)
        : lead.email;
    if (!target || blocked.has(target)) {
      await admin.from("campaign_targets").update({ status: "skipped" }).eq("id", t.id);
      skipped++;
      continue;
    }

    let body = "";
    let subject: string | undefined;
    try {
      const copy = await runCopywriter({
        companyId: ctx.company.id,
        company: ctx.company,
        lead: lead as Lead,
        product,
        kind: "first_touch",
        userId: ctx.userId,
      });
      body = channel === "email" ? copy.email.body : copy.whatsapp;
      subject = copy.email.subject;
    } catch {
      await admin.from("campaign_targets").update({ status: "skipped" }).eq("id", t.id);
      skipped++;
      continue;
    }

    // conversa
    let { data: conv } = await admin
      .from("conversations")
      .select("id")
      .eq("lead_id", lead.id)
      .eq("channel", channel)
      .maybeSingle();
    if (!conv) {
      const { data: created } = await admin
        .from("conversations")
        .insert({ company_id: ctx.company.id, lead_id: lead.id, channel, status: "open" })
        .select("id")
        .single();
      conv = created;
    }

    const result =
      channel === "whatsapp"
        ? await sendWhatsAppMessage(ctx.company.id, { to: target, body })
        : await sendEmail({
            to: target,
            subject: subject ?? `Contato de ${ctx.company.name}`,
            html: body.replace(/\n/g, "<br>"),
            apiKey: resendConfig?.config.api_key,
            from: resendConfig?.config.from_email,
          });
    if (result.simulated) simulated = true;

    await admin.from("messages").insert({
      company_id: ctx.company.id,
      conversation_id: conv!.id,
      lead_id: lead.id,
      campaign_id: id,
      channel,
      direction: "outbound",
      status: result.ok ? "sent" : "failed",
      subject: channel === "email" ? subject : null,
      body,
      provider_message_id: result.providerMessageId ?? null,
      error: result.error ?? null,
      sent_by: ctx.userId,
      sent_at: result.ok ? new Date().toISOString() : null,
    });

    await admin
      .from("campaign_targets")
      .update({
        status: result.ok ? "sent" : "skipped",
        last_message_at: new Date().toISOString(),
      })
      .eq("id", t.id);

    if (result.ok) {
      sent++;
      if (lead.status === "new" || lead.status === "qualified") {
        await admin.from("leads").update({ status: "contacted" }).eq("id", lead.id);
      }
    } else skipped++;
  }

  const { count: remaining } = await admin
    .from("campaign_targets")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", id)
    .eq("status", "pending");

  return NextResponse.json({ sent, skipped, simulated, remaining: remaining ?? 0 });
}
