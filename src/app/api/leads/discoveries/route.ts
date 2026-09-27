import { NextResponse, type NextRequest } from "next/server";
import { tryGetContext } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";

const PAGE_SIZE_DEFAULT = 50;
const PAGE_SIZE_MAX = 200;

/**
 * Lista completa de leads de uma rodada de descoberta (Prospecção). Cada
 * linha já vem com o status real de abordagem/conversa
 * (`lead_discovery_status`, view que junta lead_discoveries + outreach_queue
 * + conversations). Paginado — a UI carrega em blocos, mas TODOS os leads
 * ficam acessíveis (sem teto artificial de 20/50/100).
 */
export async function GET(req: NextRequest) {
  const ctx = await tryGetContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const url = new URL(req.url);
  const campaignId = url.searchParams.get("campaignId");
  const runId = url.searchParams.get("runId");
  if (!campaignId && !runId)
    return NextResponse.json({ error: "campaignId ou runId obrigatório" }, { status: 400 });

  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(
    PAGE_SIZE_MAX,
    Math.max(1, Number(url.searchParams.get("pageSize") ?? String(PAGE_SIZE_DEFAULT)) || PAGE_SIZE_DEFAULT),
  );
  const q = url.searchParams.get("q")?.trim() ?? "";
  const status = url.searchParams.get("status")?.trim() ?? "";

  const admin = createAdminClient();
  let query = admin
    .from("lead_discovery_status")
    .select("*", { count: "exact" })
    .eq("company_id", ctx.company.id);

  if (runId) query = query.eq("discovery_run_id", runId);
  else if (campaignId) query = query.eq("campaign_id", campaignId);

  // só a lista principal (qualificados) — descartados ficam de fora daqui
  query = query.neq("discovery_status", "rejected");

  if (status) query = query.eq("lead_status", status);
  if (q) {
    const like = `%${q.replace(/[%_]/g, "\\$&")}%`;
    query = query.or(
      `company_name.ilike.${like},segment.ilike.${like},whatsapp.ilike.${like}`,
    );
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    rows: data ?? [],
    total: count ?? 0,
    page,
    pageSize,
  });
}
