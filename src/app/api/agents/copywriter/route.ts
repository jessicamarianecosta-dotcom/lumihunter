import { NextResponse } from "next/server";
import { z } from "zod";
import { tryGetContext, canWrite } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { runCopywriter } from "@/lib/anthropic/agents/copywriter";
import type { Lead, Product } from "@/lib/supabase/database.types";

export const maxDuration = 60;

const Body = z.object({
  leadId: z.string().uuid(),
  productId: z.string().uuid().optional(),
  kind: z.enum(["first_touch", "followup", "reply", "quote"]).default("first_touch"),
  context: z.string().max(2000).optional(),
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
  const { data: lead } = await admin
    .from("leads")
    .select("*")
    .eq("id", parsed.data.leadId)
    .eq("company_id", ctx.company.id)
    .maybeSingle();
  if (!lead) return NextResponse.json({ error: "lead não encontrado" }, { status: 404 });

  let product: Product | null = null;
  const pid = parsed.data.productId ?? lead.recommended_product_ids?.[0];
  if (pid) {
    const { data } = await admin
      .from("products")
      .select("*")
      .eq("id", pid)
      .eq("company_id", ctx.company.id)
      .maybeSingle();
    product = (data ?? null) as Product | null;
  }

  const out = await runCopywriter({
    companyId: ctx.company.id,
    company: ctx.company,
    lead: lead as Lead,
    product,
    kind: parsed.data.kind,
    context: parsed.data.context,
    userId: ctx.userId,
  });

  return NextResponse.json(out);
}
