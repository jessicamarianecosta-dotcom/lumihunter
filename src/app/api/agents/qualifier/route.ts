import { NextResponse } from "next/server";
import { z } from "zod";
import { tryGetContext, canWrite } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { runQualifier } from "@/lib/anthropic/agents/qualifier";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";
import type { IcpProfile, Lead, Product } from "@/lib/supabase/database.types";

export const maxDuration = 60;

const Body = z.object({ leadId: z.string().uuid() });

export async function POST(req: Request) {
  const ctx = await tryGetContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!canWrite(ctx.role))
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const limited = await enforceRateLimit("ai", ctx.company.id, LIMITS.ai);
  if (limited) return limited;

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: "payload inválido" }, { status: 400 });

  const admin = createAdminClient();
  const { data: lead } = await admin
    .from("leads")
    .select("*")
    .eq("id", parsed.data.leadId)
    .eq("company_id", ctx.company.id)
    .maybeSingle();
  if (!lead) return NextResponse.json({ error: "lead não encontrado" }, { status: 404 });

  const [{ data: products }, { data: icps }] = await Promise.all([
    admin.from("products").select("*").eq("company_id", ctx.company.id),
    admin
      .from("icp_profiles")
      .select("*")
      .eq("company_id", ctx.company.id)
      .eq("is_active", true)
      .limit(1),
  ]);

  const result = await runQualifier({
    companyId: ctx.company.id,
    lead: lead as Lead,
    icp: (icps?.[0] ?? null) as IcpProfile | null,
    products: (products ?? []) as Product[],
    userId: ctx.userId,
  });

  const recIds = (result.recommended_product_names ?? [])
    .map(
      (n) =>
        (products ?? []).find(
          (p) => p.name.toLowerCase() === n.toLowerCase(),
        )?.id,
    )
    .filter((v): v is string => Boolean(v));

  await admin
    .from("leads")
    .update({
      score: result.score,
      score_reason: result.reason,
      score_factors: result.factors,
      ai_summary: result.summary,
      recommended_product_ids: recIds,
      status: lead.status === "new" && result.score >= 60 ? "qualified" : lead.status,
    })
    .eq("id", lead.id);

  await admin.from("activities").insert({
    company_id: ctx.company.id,
    lead_id: lead.id,
    actor_id: ctx.userId,
    kind: "ai",
    title: `Qualifier: score ${result.score}`,
    body: result.reason,
  });

  return NextResponse.json(result);
}
