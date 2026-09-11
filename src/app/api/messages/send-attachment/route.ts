import { NextResponse } from "next/server";
import { z } from "zod";
import { tryGetContext, canWrite } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendDocument, sendImage } from "@/lib/whatsapp/service";
import { normalizePhoneBR } from "@/lib/utils";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";
import { enforceMessageQuota } from "@/lib/limits";
import { markConversationHandled } from "@/lib/outreach/conversation";
import { classifyAttachment } from "@/lib/whatsapp/media-limits";

/**
 * Envia um anexo (imagem/documento) manual numa conversa de WhatsApp.
 *
 * O arquivo já foi enviado pelo navegador DIRETO ao Storage privado
 * (bucket "attachments", mesmo padrão do catálogo PDF) — esta rota só
 * recebe o caminho, valida, assina uma URL temporária e chama a Meta Cloud
 * API. O token/credencial nunca passa pelo navegador.
 */
const Body = z.object({
  leadId: z.string().uuid(),
  path: z.string().min(1).max(500),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(150),
  size: z.number().int().positive(),
  caption: z.string().max(1024).optional(),
});

export async function POST(req: Request) {
  const ctx = await tryGetContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!canWrite(ctx.role))
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const limited = await enforceRateLimit("send", ctx.company.id, LIMITS.send);
  if (limited) return limited;

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: "payload inválido" }, { status: 400 });
  const { leadId, path, filename, mimeType, size, caption } = parsed.data;

  // segurança: o caminho tem que estar sob a pasta da própria empresa —
  // nunca confia no que o navegador manda sem checar.
  if (!path.startsWith(`${ctx.company.id}/`)) {
    return NextResponse.json({ error: "caminho de arquivo inválido" }, { status: 400 });
  }

  const media = classifyAttachment(mimeType);
  if (!media) {
    return NextResponse.json(
      { error: `Tipo de arquivo não suportado: ${mimeType}.` },
      { status: 400 },
    );
  }
  if (size > media.maxBytes) {
    return NextResponse.json(
      {
        error: `Arquivo muito grande (${(size / 1024 / 1024).toFixed(1)} MB) — limite de ${(media.maxBytes / 1024 / 1024).toFixed(0)} MB para ${media.kind === "image" ? "imagens" : "documentos"}.`,
      },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const quota = await enforceMessageQuota(admin, ctx.company.id);
  if (quota) return quota;

  const { data: lead } = await admin
    .from("leads")
    .select("id, whatsapp, phone, status")
    .eq("id", leadId)
    .eq("company_id", ctx.company.id)
    .maybeSingle();
  if (!lead) return NextResponse.json({ error: "lead não encontrado" }, { status: 404 });

  const to = normalizePhoneBR(lead.whatsapp ?? lead.phone);
  if (!to) return NextResponse.json({ error: "Lead sem WhatsApp." }, { status: 400 });

  const { data: blocked } = await admin
    .from("blacklist")
    .select("id")
    .eq("company_id", ctx.company.id)
    .eq("channel", "whatsapp")
    .eq("value", to)
    .maybeSingle();
  if (blocked)
    return NextResponse.json({ error: "Contato na blacklist (opt-out)." }, { status: 409 });

  const { data: signed, error: signErr } = await admin.storage
    .from("attachments")
    .createSignedUrl(path, 3600);
  if (signErr || !signed?.signedUrl) {
    return NextResponse.json(
      { error: `Não foi possível acessar o arquivo enviado: ${signErr?.message ?? "erro desconhecido"}.` },
      { status: 500 },
    );
  }

  let conversation = (
    await admin
      .from("conversations")
      .select("id")
      .eq("lead_id", lead.id)
      .eq("channel", "whatsapp")
      .maybeSingle()
  ).data;
  if (!conversation) {
    const { data: created } = await admin
      .from("conversations")
      .insert({ company_id: ctx.company.id, lead_id: lead.id, channel: "whatsapp", status: "open" })
      .select("id")
      .single();
    conversation = created;
  }
  if (!conversation)
    return NextResponse.json({ error: "falha ao abrir conversa" }, { status: 500 });

  const result =
    media.kind === "image"
      ? await sendImage(ctx.company.id, { to, link: signed.signedUrl, caption })
      : await sendDocument(ctx.company.id, { to, link: signed.signedUrl, filename, caption });

  const attachments = [{ kind: media.kind, path, filename, mimeType, size }];

  await admin.from("messages").insert({
    company_id: ctx.company.id,
    conversation_id: conversation.id,
    lead_id: lead.id,
    channel: "whatsapp",
    direction: "outbound",
    status: result.ok ? "sent" : "failed",
    body: caption ?? null,
    attachments,
    provider: "meta",
    provider_message_id: result.providerMessageId ?? null,
    error: result.ok ? null : (result.error ?? "falha ao enviar o anexo"),
    sent_by: ctx.userId,
    sent_at: result.ok ? new Date().toISOString() : null,
  });

  if (result.ok) {
    if (lead.status === "new" || lead.status === "qualified") {
      await admin.from("leads").update({ status: "contacted" }).eq("id", lead.id);
    }
    await admin
      .from("conversations")
      .update({
        last_message_preview: caption?.slice(0, 160) || `📎 ${filename}`,
        last_message_at: new Date().toISOString(),
      })
      .eq("id", conversation.id);
    await markConversationHandled(admin, { conversationId: conversation.id, userId: ctx.userId });
  }

  return NextResponse.json({
    ok: result.ok,
    simulated: result.simulated ?? false,
    error: result.error,
  });
}
