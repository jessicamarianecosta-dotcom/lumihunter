import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export interface PlanLimits {
  leads: number;
  ai_runs_month: number;
  messages_month: number;
  seats: number;
}

/** -1 = ilimitado. */
export const PLAN_LIMITS: Record<string, PlanLimits> = {
  free: { leads: 100, ai_runs_month: 200, messages_month: 200, seats: 1 },
  starter: { leads: 1000, ai_runs_month: 2000, messages_month: 2000, seats: 2 },
  pro: { leads: 10000, ai_runs_month: -1, messages_month: -1, seats: 6 },
  business: { leads: -1, ai_runs_month: -1, messages_month: -1, seats: -1 },
};

export async function getLimits(
  db: Client,
  companyId: string,
): Promise<PlanLimits> {
  const { data: sub } = await db
    .from("subscriptions")
    .select("plan, limits")
    .eq("company_id", companyId)
    .maybeSingle();

  const base = PLAN_LIMITS[sub?.plan ?? "free"] ?? PLAN_LIMITS.free;
  const overrides = (sub?.limits ?? {}) as Partial<PlanLimits>;
  return { ...base, ...overrides };
}

export interface QuotaCheck {
  ok: boolean;
  current: number;
  limit: number;
  message?: string;
}

function startOfMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

async function count(
  db: Client,
  table: "leads" | "ai_runs" | "messages",
  companyId: string,
  sinceColumn?: string,
): Promise<number> {
  let q = db
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);
  if (sinceColumn) q = q.gte(sinceColumn, startOfMonthISO());
  const { count: c } = await q;
  return c ?? 0;
}

export async function checkLeadQuota(
  db: Client,
  companyId: string,
  adding = 1,
): Promise<QuotaCheck> {
  const limits = await getLimits(db, companyId);
  if (limits.leads < 0) return { ok: true, current: 0, limit: -1 };
  const current = await count(db, "leads", companyId);
  const ok = current + adding <= limits.leads;
  return {
    ok,
    current,
    limit: limits.leads,
    message: ok
      ? undefined
      : `Limite do plano atingido (${limits.leads} leads). Arquive leads antigos ou faça upgrade.`,
  };
}

export async function checkAiQuota(
  db: Client,
  companyId: string,
): Promise<QuotaCheck> {
  const limits = await getLimits(db, companyId);
  if (limits.ai_runs_month < 0) return { ok: true, current: 0, limit: -1 };
  const current = await count(db, "ai_runs", companyId, "created_at");
  const ok = current < limits.ai_runs_month;
  return {
    ok,
    current,
    limit: limits.ai_runs_month,
    message: ok
      ? undefined
      : `Limite mensal de execuções de IA atingido (${limits.ai_runs_month}). Faça upgrade para continuar.`,
  };
}

export async function checkMessageQuota(
  db: Client,
  companyId: string,
): Promise<QuotaCheck> {
  const limits = await getLimits(db, companyId);
  if (limits.messages_month < 0) return { ok: true, current: 0, limit: -1 };
  const current = await count(db, "messages", companyId, "created_at");
  const ok = current < limits.messages_month;
  return {
    ok,
    current,
    limit: limits.messages_month,
    message: ok
      ? undefined
      : `Limite mensal de mensagens atingido (${limits.messages_month}). Faça upgrade para continuar.`,
  };
}

/** Guarda para rotas de API: 402 se estourou a cota mensal de IA. */
export async function enforceAiQuota(
  db: Client,
  companyId: string,
): Promise<NextResponse | null> {
  const q = await checkAiQuota(db, companyId);
  if (q.ok) return null;
  return NextResponse.json({ error: q.message }, { status: 402 });
}

/** Guarda para rotas de API: 402 se estourou a cota mensal de mensagens. */
export async function enforceMessageQuota(
  db: Client,
  companyId: string,
): Promise<NextResponse | null> {
  const q = await checkMessageQuota(db, companyId);
  if (q.ok) return null;
  return NextResponse.json({ error: q.message }, { status: 402 });
}

export async function checkSeatQuota(
  db: Client,
  companyId: string,
): Promise<QuotaCheck> {
  const limits = await getLimits(db, companyId);
  if (limits.seats < 0) return { ok: true, current: 0, limit: -1 };
  const [members, invites] = await Promise.all([
    db
      .from("company_members")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId),
    db
      .from("invitations")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .is("accepted_at", null),
  ]);
  const current = (members.count ?? 0) + (invites.count ?? 0);
  const ok = current < limits.seats;
  return {
    ok,
    current,
    limit: limits.seats,
    message: ok
      ? undefined
      : `Limite de usuários do plano atingido (${limits.seats}). Faça upgrade para adicionar mais.`,
  };
}
