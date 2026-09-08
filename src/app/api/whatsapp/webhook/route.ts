import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { phoneMatchCandidates } from "@/lib/utils";
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

/** Mascara um telefone para os logs: nunca o número inteiro. */
function maskPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  return d.length <= 4 ? "••" : `••••${d.slice(-4)} (${d.length}d)`;
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
  console.log(
    `[whatsapp/webhook] recebido: ${inbound.length} mensagem(ns), ${statuses.length} status`,
  );
  if (inbound.length === 0 && statuses.length === 0)
    return NextResponse.json({ ok: true });

  const admin = createAdminClient();

  // ── Atualizações de status (entregue/lido/falhou) ────────────────────────
  for (const s of statuses) {
    const { error } = await admin
      .from("messages")
      .update({ status: s.status })
      .eq("provider_message_id", s.providerMessageId);
    if (error)
      console.error(
        `[whatsapp/webhook] falha ao atualizar status ${s.status}: ${error.message}`,
      );
  }

  // ── Mensagens recebidas ─────────────────────────────────────────────────
  for (const msg of inbound) {
    // empresa dona da linha que recebeu (pelo phone_number_id)
    const { data: integration } = await admin
      .from("integrations")
      .select("company_id")
      .eq("provider", "whatsapp")
      .contains("config", { phone_number_id: msg.channelIdentifier })
      .maybeSingle();

    const companyId = integration?.company_id;
    if (!companyId) {
      console.warn(
        `[whatsapp/webhook] nenhuma integração com phone_number_id=${msg.channelIdentifier}; mensagem de ${maskPhone(msg.from)} ignorada`,
      );
      continue;
    }

    // idempotência: Meta reenvia webhooks — não duplica a mensagem
    const { data: existing } = await admin
      .from("messages")
      .select("id")
      .eq("company_id", companyId)
      .eq("provider_message_id", msg.providerMessageId)
      .limit(1);
    if (existing && existing.length) {
      console.log(
        `[whatsapp/webhook] mensagem ${msg.providerMessageId} já registrada — ignorando reenvio`,
      );
      continue;
    }

    // casa o lead pelo telefone (robusto a "+", DDI e 9º dígito BR)
    const candidates = phoneMatchCandidates(msg.from);
    let lead: { id: string } | null = null;
    for (const col of ["whatsapp", "phone"] as const) {
      if (candidates.length === 0) break;
      const { data } = await admin
        .from("leads")
        .select("id")
        .eq("company_id", companyId)
        .in(col, candidates)
        .limit(1);
      if (data && data.length) {
        lead = data[0];
        break;
      }
    }
    if (!lead) {
      console.warn(
        `[whatsapp/webhook] nenhum lead para ${maskPhone(msg.from)} na empresa ${companyId} (testados ${candidates.length} formatos)`,
      );
      continue;
    }

    // conversa (1 por lead+canal)
    let { data: conversation } = await admin
      .from("conversations")
      .select("id")
      .eq("lead_id", lead.id)
      .eq("channel", "whatsapp")
      .maybeSingle();

    if (!conversation) {
      const { data: created, error } = await admin
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
      if (error) {
        console.error(
          `[whatsapp/webhook] falha ao criar conversa (lead ${lead.id}): ${error.message}`,
        );
        continue;
      }
      conversation = created;
    }
    if (!conversation) continue;

    const { error: msgErr } = await admin.from("messages").insert({
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
    if (msgErr) {
      console.error(
        `[whatsapp/webhook] falha ao inserir mensagem (lead ${lead.id}): ${msgErr.message}`,
      );
      continue;
    }

    await admin
      .from("leads")
      .update({ status: "replied" })
      .eq("id", lead.id)
      .in("status", ["new", "qualified", "contacted"]);

    console.log(
      `[whatsapp/webhook] OK — conversa ${conversation.id} + mensagem inbound para o lead ${lead.id}`,
    );
  }

  return NextResponse.json({ ok: true });
}
