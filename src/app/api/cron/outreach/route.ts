import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { drainRunningCampaigns } from "@/lib/outreach/worker";

export const maxDuration = 300;

/**
 * Drena as filas de prospecção ativas. Também é chamado pelo cron diário
 * `/api/cron/followups`. Aqui fica disponível para acionamento manual/externo.
 * Protegido por CRON_SECRET (Authorization: Bearer ...).
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const admin = createAdminClient();
  const result = await drainRunningCampaigns(admin, { budgetMs: 260_000 });
  return NextResponse.json(result);
}
