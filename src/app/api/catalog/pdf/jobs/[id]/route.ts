import { NextResponse } from "next/server";
import { z } from "zod";
import { tryGetContext, canWrite } from "@/lib/auth/context";
import { applyImportJob, processImportJob } from "@/lib/catalog/pdf";

export const maxDuration = 60;

/** Considera "travado" um job em processing há mais de 2 min (função morreu). */
const STALE_MS = 120_000;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await tryGetContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const db = ctx.supabase;
  const read = () =>
    db
      .from("catalog_import_jobs")
      .select("*")
      .eq("id", id)
      .eq("company_id", ctx.company.id)
      .maybeSingle();

  let { data, error } = await read();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

  const stale =
    data.status === "processing" &&
    Date.now() - new Date(data.updated_at).getTime() > STALE_MS;

  // O processamento (leitura do PDF pela IA) roda aqui, no primeiro GET — com o
  // orçamento de 60s desta função, não do POST de upload. Usa o client
  // autenticado (RLS), então não depende do service-role.
  if ((data.status === "pending" || stale) && canWrite(ctx.role)) {
    try {
      await processImportJob(id, db);
    } catch (e) {
      console.error(`[catalog/pdf/jobs] processamento ${id} falhou:`, (e as Error).message);
    }
    ({ data } = await read());
  }

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
    await ctx.supabase
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
    const { created } = await applyImportJob(
      {
        jobId: id,
        companyId: ctx.company.id,
        approved: parsed.data.approved,
        edits: edits as never,
      },
      ctx.supabase,
    );
    return NextResponse.json({ created });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
