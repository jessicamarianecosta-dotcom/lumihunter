import { NextResponse } from "next/server";
import { tryGetContext, canWrite } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";
import { enforceAiQuota } from "@/lib/limits";
import { reprocessSkipped } from "@/lib/outreach/promote";

export const maxDuration = 120;

/**
 * Reprocessa os contatos travados como `outreach_queue.status = 'skipped'`
 * (barrados por um portão que já foi corrigido). Não envia nada aqui — só
 * recoloca na fila 'ready'; o worker/cron/tick faz o envio com todos os
 * controles. Não duplica: itens já em envio/enviados não são tocados.
 */
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
      "id, name, channel, status, product_id, product_text, outreach_automatic, outreach_base_message, outreach_personalize_ai, outreach_send_catalog, outreach_catalog_pdf_id, outreach_status",
    )
    .eq("id", id)
    .eq("company_id", ctx.company.id)
    .maybeSingle();
  if (!campaign)
    return NextResponse.json({ error: "campanha não encontrada" }, { status: 404 });
  if (campaign.channel !== "whatsapp")
    return NextResponse.json(
      { error: "A fila de WhatsApp só vale para campanhas com canal WhatsApp." },
      { status: 400 },
    );

  const result = await reprocessSkipped(admin, {
    companyId: ctx.company.id,
    companyName: ctx.company.name,
    campaign: {
      id: campaign.id,
      name: campaign.name,
      channel: campaign.channel,
      status: campaign.status,
      product_id: campaign.product_id,
      product_text: campaign.product_text,
      outreach_automatic: campaign.outreach_automatic,
      outreach_base_message: campaign.outreach_base_message,
      outreach_personalize_ai: campaign.outreach_personalize_ai,
      outreach_send_catalog: campaign.outreach_send_catalog,
      outreach_catalog_pdf_id: campaign.outreach_catalog_pdf_id,
    },
    userId: ctx.userId,
  });

  // Se algo entrou na fila e a campanha está ativa e não pausada, liga o worker.
  if (
    result.enqueued > 0 &&
    campaign.status === "active" &&
    campaign.outreach_status !== "paused"
  ) {
    await admin
      .from("campaigns")
      .update({
        outreach_status: "running",
        outreach_started_at: new Date().toISOString(),
        outreach_consecutive_errors: 0,
      })
      .eq("id", id)
      .eq("company_id", ctx.company.id);
  }

  return NextResponse.json({
    deletedSkipped: result.deletedSkipped,
    promoted: result.promoted,
    enqueued: result.enqueued,
    stillSkipped: result.skipped.length,
    stillSkippedReasons: result.skipped.reduce<Record<string, number>>((acc, s) => {
      acc[s.reason] = (acc[s.reason] ?? 0) + 1;
      return acc;
    }, {}),
    nameLeaksFixed: result.nameLeaksFixed,
    catalog: result.catalog,
  });
}
