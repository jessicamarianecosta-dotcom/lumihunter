import { NextResponse } from "next/server";
import { z } from "zod";
import { tryGetContext, canWrite } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseDdd, parseStartNumber } from "@/lib/sweeps/candidates";

const CreateBody = z.object({
  name: z.string().min(1).max(120),
  ddd: z.string().min(2).max(3),
  startNumber: z.string().min(1),
  quantityTarget: z.coerce.number().int().min(1).max(5000),
  catalogPdfId: z.string().uuid().nullable().optional(),
  intervalSeconds: z.coerce.number().int().min(10).max(3600).default(30),
  messageTemplates: z.array(z.string().min(1)).min(1).max(10),
  windowStart: z.string().nullable().optional(),
  windowEnd: z.string().nullable().optional(),
});

export async function GET() {
  const ctx = await tryGetContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("number_sweeps")
    .select(
      "id, name, ddd, quantity_target, sent_count, attempted_count, invalid_count, skipped_count, failed_count, status, interval_seconds, created_at",
    )
    .eq("company_id", ctx.company.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sweeps: data ?? [] });
}

export async function POST(req: Request) {
  const ctx = await tryGetContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!canWrite(ctx.role)) return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const parsed = CreateBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: "payload inválido", details: parsed.error.flatten() }, { status: 400 });

  const ddd = parseDdd(parsed.data.ddd);
  if (!ddd) return NextResponse.json({ error: "DDD inválido — use 2 dígitos, ex: 41" }, { status: 400 });

  const startNumber = parseStartNumber(parsed.data.startNumber);
  if (!startNumber)
    return NextResponse.json(
      { error: "Número inicial inválido — use um celular BR de 9 dígitos começando em 9, ex: 991111111" },
      { status: 400 },
    );

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("number_sweeps")
    .insert({
      company_id: ctx.company.id,
      name: parsed.data.name,
      ddd,
      start_number: Number(startNumber),
      next_number: Number(startNumber),
      quantity_target: parsed.data.quantityTarget,
      catalog_pdf_id: parsed.data.catalogPdfId || null,
      interval_seconds: parsed.data.intervalSeconds,
      message_templates: parsed.data.messageTemplates,
      window_start: parsed.data.windowStart || null,
      window_end: parsed.data.windowEnd || null,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
