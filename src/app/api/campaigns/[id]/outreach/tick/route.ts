import { NextResponse } from "next/server";
import { tryGetContext, canWrite } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";
import { enforceMessageQuota } from "@/lib/limits";
import { sendNextForCampaign } from "@/lib/outreach/worker";

export const maxDuration = 60;

/**
 * Envia o PRÓXIMO item da fila da campanha. Chamado:
 *  - pela página da campanha (polling enquanto a prospecção está ativa);
 *  - pelo cron (drena todas as filas 1x/dia).
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

  const limited = await enforceRateLimit("send", ctx.company.id, LIMITS.send);
  if (limited) return limited;

  const admin = createAdminClient();

  // a campanha tem de ser da empresa do usuário
  const { data: campaign } = await admin
    .from("campaigns")
    .select("id")
    .eq("id", id)
    .eq("company_id", ctx.company.id)
    .maybeSingle();
  if (!campaign)
    return NextResponse.json({ error: "campanha não encontrada" }, { status: 404 });

  const quota = await enforceMessageQuota(admin, ctx.company.id);
  if (quota) return quota;

  const outcome = await sendNextForCampaign(admin, id);
  return NextResponse.json(outcome);
}
