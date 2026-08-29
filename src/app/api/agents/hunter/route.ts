import { NextResponse } from "next/server";
import { z } from "zod";
import { tryGetContext, canWrite } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { runHunter } from "@/lib/anthropic/agents/hunter";
import { isDemoMode } from "@/lib/anthropic/demo";
import { normalizePhoneBR, normalizeEmail } from "@/lib/utils";
import type { IcpProfile, Product } from "@/lib/supabase/database.types";

export const maxDuration = 120;

const Body = z.object({
  icpId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(30).optional(),
  query: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  const ctx = await tryGetContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!canWrite(ctx.role))
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: "payload inválido" }, { status: 400 });

  const admin = createAdminClient();

  const icpQuery = admin
    .from("icp_profiles")
    .select("*")
    .eq("company_id", ctx.company.id)
    .eq("is_active", true);
  const { data: icps } = parsed.data.icpId
    ? await icpQuery.eq("id", parsed.data.icpId)
    : await icpQuery.limit(1);
  const icp = (icps?.[0] ?? null) as IcpProfile | null;
  if (!icp)
    return NextResponse.json(
      { error: "Defina um Perfil de Cliente Ideal (ICP) antes de rodar o Hunter." },
      { status: 400 },
    );

  const { data: products } = await admin
    .from("products")
    .select("*")
    .eq("company_id", ctx.company.id);

  const found = await runHunter({
    companyId: ctx.company.id,
    icp,
    products: (products ?? []) as Product[],
    limit: parsed.data.limit,
    extraQuery: parsed.data.query,
    userId: ctx.userId,
  });

  const { data: stage } = await admin
    .from("pipeline_stages")
    .select("id")
    .eq("company_id", ctx.company.id)
    .eq("slug", "new")
    .maybeSingle();

  const { data: existing } = await admin
    .from("leads")
    .select("name")
    .eq("company_id", ctx.company.id);
  const seen = new Set(
    (existing ?? []).map((e) => e.name.trim().toLowerCase()),
  );

  const rows = found
    .filter((l) => !seen.has(l.name.trim().toLowerCase()))
    .map((l) => ({
    company_id: ctx.company.id,
    stage_id: stage?.id ?? null,
    status: "new" as const,
    source: "hunter",
    name: l.name,
    legal_name: l.legal_name,
    segment: l.segment,
    description: l.description,
    city: l.city,
    state: l.state,
    website: l.website,
    instagram: l.instagram,
    phone: l.phone,
    whatsapp: normalizePhoneBR(l.whatsapp ?? l.phone),
    email: normalizeEmail(l.email),
    products_sold: l.products_sold ?? [],
    notes: l.source_urls?.length ? `Fontes: ${l.source_urls.join(" | ")}` : null,
  }));

  let inserted = 0;
  if (rows.length) {
    const { data, error } = await admin.from("leads").insert(rows).select("id");
    if (!error) inserted = data?.length ?? 0;
  }

  return NextResponse.json({ found: found.length, inserted, demo: isDemoMode() });
}
