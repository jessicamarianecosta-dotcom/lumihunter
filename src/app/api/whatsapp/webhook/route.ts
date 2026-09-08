import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  validateWebhookHandshake,
  parseIncomingWebhook,
  verifyIncomingWebhookSignature,
} from "@/lib/whatsapp/service";

// GET: handshake de verificação da Meta (sem corpo, sem assinatura)
export async function GET(req: NextRequest) {
  const challenge = validateWebhookHandshake("meta", req.nextUrl.searchParams);
  if (challenge) return new Response(challenge, { status: 200 });
  return new Response("forbidden", { status: 403 });
}

// POST: mensagens recebidas / status
export async function POST(req: NextRequest) {
  // Corpo BRUTO — necessário para conferir a assinatura byte a byte.
  const rawBody = await req.text();

  // 1) Assinatura X-Hub-Signature-256 ANTES de qualquer parsing/processamento.
  const signature = verifyIncomingWebhookSignature("meta", rawBody, req.headers);
  if (signature === "unconfigured") {
    console.error(
      "[whatsapp/webhook] WHATSAPP_APP_SECRET ausente — não é possível validar a assinatura; requisição recusada.",
    );
    return NextResponse.json(
      { error: "webhook signature verification not configured" },
      { status: 503 },
    );
  }
  if (signature !== "valid") {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // 2) Só depois de validada, faz o parse.
  let payload: unknown = null;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    payload = null;
  }
  if (!payload) return NextResponse.json({ ok: true });

  const { messages: inbound, statuses } = parseIncomingWebhook("meta", payload);
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
    // localiza a integração pelo phone_number_id -> empresa
    const { data: integration } = await admin
      .from("integrations")
      .select("company_id")
      .eq("provider", "whatsapp")
      .contains("config", { phone_number_id: msg.channelIdentifier })
      .maybeSingle();

    const companyId = integration?.company_id;
    if (!companyId) continue;

    // localiza o lead pelo telefone
    const phone = `+${msg.from.replace(/\D/g, "")}`;
    const { data: lead } = await admin
      .from("leads")
      .select("id")
      .eq("company_id", companyId)
      .or(`whatsapp.eq.${phone},phone.eq.${phone}`)
      .maybeSingle();
    if (!lead) continue;

    // conversa (upsert lógico)
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
          provider: "meta",
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
      provider: "meta",
      provider_message_id: msg.providerMessageId,
      sent_at: new Date(Number(msg.timestamp) * 1000).toISOString(),
    });

    await admin
      .from("leads")
      .update({ status: "replied" })
      .eq("id", lead.id)
      .in("status", ["new", "qualified", "contacted"]);
  }

  return NextResponse.json({ ok: true });
}
