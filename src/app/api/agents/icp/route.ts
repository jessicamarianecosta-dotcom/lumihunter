import { NextResponse } from "next/server";
import { z } from "zod";
import { tryGetContext, canWrite } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { runIcpAssistant } from "@/lib/anthropic/agents/icp-assistant";
import { isDemoMode } from "@/lib/anthropic/demo";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";
import { enforceAiQuota } from "@/lib/limits";
import type { Product } from "@/lib/supabase/database.types";

export const maxDuration = 60;

const Body = z.object({ apply: z.boolean().optional() });

export async function POST(req: Request) {
  const ctx = await tryGetContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!canWrite(ctx.role))
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const limited = await enforceRateLimit("ai", ctx.company.id, LIMITS.ai);
  if (limited) return limited;

  const admin = createAdminClient();
  const quota = await enforceAiQuota(admin, ctx.company.id);
  if (quota) return quota;

  const { apply } = Body.parse(await req.json().catch(() => ({})));

  const { data: products } = await admin
    .from("products")
    .select("name")
    .eq("company_id", ctx.company.id);

  const suggestion = await runIcpAssistant({
    companyId: ctx.company.id,
    company: ctx.company,
    products: (products ?? []) as Pick<Product, "name">[],
    userId: ctx.userId,
  });

  let icpId: string | null = null;
  if (apply) {
    // cria produtos sugeridos (se a empresa não tinha nenhum)
    if ((products ?? []).length === 0 && suggestion.suggested_products.length) {
      await admin.from("products").insert(
        suggestion.suggested_products.slice(0, 12).map((p) => ({
          company_id: ctx.company.id,
          name: p.name,
          description: p.description,
          keywords: p.keywords ?? [],
          example_buyers: p.example_buyers ?? [],
        })),
      );
    }
    const { data: icp } = await admin
      .from("icp_profiles")
      .insert({
        company_id: ctx.company.id,
        name: suggestion.name,
        description: `${suggestion.description}\n\n${suggestion.reasoning}`,
        states: suggestion.states ?? [],
        cities: suggestion.cities ?? [],
        regions: suggestion.regions ?? [],
        segments: suggestion.segments ?? [],
        company_sizes: suggestion.company_sizes ?? [],
        keywords: suggestion.keywords ?? [],
      })
      .select("id")
      .single();
    icpId = icp?.id ?? null;
  }

  return NextResponse.json({ suggestion, icpId, demo: isDemoMode() });
}
