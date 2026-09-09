import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { activeScaleRuns, runScaleBatch } from "@/lib/discovery/scale";

export const maxDuration = 300;

/**
 * Dá continuidade às rodadas de descoberta em escala (`discovery_runs` com
 * `scale_status = 'active'`). Cada invocação drena alguns batches por rodada,
 * dentro de um orçamento de tempo. Agendado via pg_cron do Supabase (o Vercel
 * Hobby só permite 1 cron/dia) — ver migração 20260910120000_discovery_escala.
 *
 * Protegido por CRON_SECRET (Authorization: Bearer ...).
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const deadline = Date.now() + 240_000;
  const runs = await activeScaleRuns(admin);

  const results: unknown[] = [];
  for (const runId of runs) {
    if (Date.now() > deadline) break;
    try {
      const r = await runScaleBatch(admin, runId, { batches: 3 });
      results.push(r);
    } catch (e) {
      console.error("[cron/discovery]", runId, e);
      results.push({ runId, error: String(e).slice(0, 200) });
    }
  }

  return NextResponse.json({ activeRuns: runs.length, processed: results.length, results });
}
