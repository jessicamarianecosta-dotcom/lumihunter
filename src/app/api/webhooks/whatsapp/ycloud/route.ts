import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateWebhookHandshake, parseIncomingWebhook } from "@/lib/whatsapp/service";

/**
 * Webhook dedicado ao provider YCloud — endpoint separado do webhook da Meta
 * (/api/whatsapp/webhook) porque cada BSP tem seu próprio formato de payload
 * e é registrado como uma URL distinta no respectivo painel.
 *
 * ⚠️ Ainda não funcional de verdade: `ycloudProvider` (src/lib/whatsapp/providers/ycloud.ts)
 * está aguardando confirmação da documentação oficial do YCloud (endpoint,
 * autenticação e formato exato do payload). A rota já está pronta e cablada
 * na arquitetura — assim que o provider for implementado, esta rota funciona
 * sem mudanças adicionais.
 */

export async function GET(req: NextRequest) {
  const challenge = validateWebhookHandshake("ycloud", req.nextUrl.searchParams);
  if (challenge) return new Response(challenge, { status: 200 });
  return new Response("forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => null);
  if (!payload) return NextResponse.json({ ok: true });

  const { messages: inbound, statuses } = parseIncomingWebhook("ycloud", payload);
  if (inbound.length === 0 && statuses.length === 0)
    return NextResponse.json({ ok: true });

  const admin = createAdminClient();

  for (const s of statuses) {
    await admin
      .from("messages")
      .update({ status: s.status })
      .eq("provider_message_id", s.providerMessageId);
  }

  for (const msg of inbound) {
    // TODO: quando o parseWebhook do YCloud estiver implementado, confirmar
    // como identificar a empresa a partir do payload (ex: número conectado)
    // — mesmo padrão usado no webhook da Meta, adaptado ao campo real do YCloud.
    const { data: integration } = await admin
      .from("integrations")
      .select("company_id")
      .eq("provider", "whatsapp")
      .contains("config", { ycloud: { channel_identifier: msg.channelIdentifier } })
      .maybeSingle();

    const companyId = integration?.company_id;
    if (!companyId) continue;

    const phone = `+${msg.from.replace(/\D/g, "")}`;
    const { data: lead } = await admin
      .from("leads")
      .select("id")
      .eq("company_id", companyId)
      .or(`whatsapp.eq.${phone},phone.eq.${phone}`)
      .maybeSingle();
    if (!lead) continue;

    let { data: conversation } = await admin
      .from("conversations")
      .select("id")
      .eq("lead_id", lead.id)
      .eq("channel", "whatsapp")
      .maybeSingle();

    if (!conversation) {
      const { data: created } = await admin
        .from("conversations")
        .insert({
          company_id: companyId,
          lead_id: lead.id,
          channel: "whatsapp",
          external_id: msg.from,
          status: "open",
          provider: "ycloud",
        })
        .select("id")
        .single();
      conversation = created;
    }
    if (!conversation) continue;

    await admin.from("messages").insert({
      company_id: companyId,
      conversation_id: conversation.id,
      lead_id: lead.id,
      channel: "whatsapp",
      direction: "inbound",
      status: "received",
      body: msg.text,
      provider: "ycloud",
      provider_message_id: msg.providerMessageId,
      sent_at: new Date(msg.timestamp).toISOString(),
    });

    await admin
      .from("leads")
      .update({ status: "replied" })
      .eq("id", lead.id)
      .in("status", ["new", "qualified", "contacted"]);
  }

  return NextResponse.json({ ok: true });
}
