import { NextResponse } from "next/server";
import { z } from "zod";
import { tryGetContext, canWrite } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyImportJob } from "@/lib/catalog/pdf";

export const maxDuration = 60;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await tryGetContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data, error } = await createAdminClient()
    .from("catalog_import_jobs")
    .select("*")
    .eq("id", id)
    .eq("company_id", ctx.company.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  return NextResponse.json({ job: data });
}

const ApplyBody = z.object({
  action: z.literal("apply"),
  approved: z.array(z.number().int().nonnegative()).max(500),
  edits: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
});
const CancelBody = z.object({ action: z.literal("cancel") });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await tryGetContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!canWrite(ctx.role))
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const raw = await req.json().catch(() => ({}));
  const parsed = z.union([ApplyBody, CancelBody]).safeParse(raw);
  if (!parsed.success)
    return NextResponse.json({ error: "payload inválido" }, { status: 400 });

  if (parsed.data.action === "cancel") {
    await createAdminClient()
      .from("catalog_import_jobs")
      .update({ status: "canceled" })
      .eq("id", id)
      .eq("company_id", ctx.company.id);
    return NextResponse.json({ ok: true });
  }

  try {
    const edits = parsed.data.edits
      ? Object.fromEntries(
          Object.entries(parsed.data.edits).map(([k, v]) => [Number(k), v]),
        )
      : undefined;
    const { created } = await applyImportJob({
      jobId: id,
      companyId: ctx.company.id,
      approved: parsed.data.approved,
      edits: edits as never,
    });
    return NextResponse.json({ created });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
