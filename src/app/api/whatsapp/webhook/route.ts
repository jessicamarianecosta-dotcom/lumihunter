import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhook, parseInbound } from "@/lib/integrations/whatsapp";

// GET: handshake de verificação da Meta
export async function GET(req: NextRequest) {
  const challenge = verifyWebhook(req.nextUrl.searchParams);
  if (challenge) return new Response(challenge, { status: 200 });
  return new Response("forbidden", { status: 403 });
}

// POST: mensagens recebidas / status
export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => null);
  if (!payload) return NextResponse.json({ ok: true });

  const inbound = parseInbound(payload);
  if (inbound.length === 0) return NextResponse.json({ ok: true });

  const admin = createAdminClient();

  for (const msg of inbound) {
    // localiza a integração pelo phone_number_id -> empresa
    const { data: integration } = await admin
      .from("integrations")
      .select("company_id")
      .eq("provider", "whatsapp")
      .contains("config", { phone_number_id: msg.phoneNumberId })
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
      provider_message_id: msg.waMessageId,
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
