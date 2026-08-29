import { NextResponse } from "next/server";
import { z } from "zod";
import { tryGetContext, canWrite } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppText } from "@/lib/integrations/whatsapp";
import { sendEmail } from "@/lib/integrations/resend";
import { normalizePhoneBR } from "@/lib/utils";

const Body = z.object({
  leadId: z.string().uuid(),
  channel: z.enum(["whatsapp", "email"]),
  body: z.string().min(1).max(4000),
  subject: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  const ctx = await tryGetContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!canWrite(ctx.role))
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: "payload inválido" }, { status: 400 });
  const { leadId, channel, body, subject } = parsed.data;

  const admin = createAdminClient();
  const { data: lead } = await admin
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .eq("company_id", ctx.company.id)
    .maybeSingle();
  if (!lead) return NextResponse.json({ error: "lead não encontrado" }, { status: 404 });

  const target =
    channel === "whatsapp"
      ? normalizePhoneBR(lead.whatsapp ?? lead.phone)
      : lead.email;
  if (!target)
    return NextResponse.json(
      { error: `Lead sem ${channel === "whatsapp" ? "WhatsApp" : "e-mail"}.` },
      { status: 400 },
    );

  // blacklist / opt-out
  const { data: blocked } = await admin
    .from("blacklist")
    .select("id")
    .eq("company_id", ctx.company.id)
    .eq("channel", channel)
    .eq("value", target)
    .maybeSingle();
  if (blocked)
    return NextResponse.json({ error: "Contato na blacklist (opt-out)." }, { status: 409 });

  // conversa
  let { data: conversation } = await admin
    .from("conversations")
    .select("id")
    .eq("lead_id", lead.id)
    .eq("channel", channel)
    .maybeSingle();
  if (!conversation) {
    const { data: created } = await admin
      .from("conversations")
      .insert({
        company_id: ctx.company.id,
        lead_id: lead.id,
        channel,
        status: "open",
      })
      .select("id")
      .single();
    conversation = created;
  }
  if (!conversation)
    return NextResponse.json({ error: "falha ao abrir conversa" }, { status: 500 });

  const result =
    channel === "whatsapp"
      ? await sendWhatsAppText({ to: target, body })
      : await sendEmail({
          to: target,
          subject: subject ?? `Contato de ${ctx.company.name}`,
          html: body.replace(/\n/g, "<br>"),
        });

  await admin.from("messages").insert({
    company_id: ctx.company.id,
    conversation_id: conversation.id,
    lead_id: lead.id,
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

  if (result.ok && (lead.status === "new" || lead.status === "qualified")) {
    await admin
      .from("leads")
      .update({ status: "contacted" })
      .eq("id", lead.id);
  }

  return NextResponse.json({
    ok: result.ok,
    simulated: result.simulated ?? false,
    error: result.error,
  });
}
