import { NextResponse } from "next/server";
import { z } from "zod";
import { tryGetContext, canWrite } from "@/lib/auth/context";
import { logCatalogEvent } from "@/lib/catalog/sources";

export const maxDuration = 30;

const MAX_MB = Number(process.env.CATALOG_PDF_MAX_MB || 20);

/**
 * Registro da importação de catálogo PDF.
 *
 * O ARQUIVO já foi enviado pelo navegador DIRETO ao Supabase Storage
 * (bucket `catalogs`, pasta `<company_id>/`, protegida por RLS). Aqui só chega
 * JSON pequeno — o binário nunca passa pela função (a Vercel recusa corpos
 * acima de ~4,5 MB, que era a causa do "Erro de rede ao enviar o PDF").
 *
 * Usa o client autenticado do usuário (RLS), não o service-role.
 */
const Body = z.object({
  path: z.string().min(3).max(300),
  fileName: z.string().min(1).max(200),
  size: z.number().int().positive().optional(),
});

export async function POST(req: Request) {
  const ctx = await tryGetContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!canWrite(ctx.role))
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: "payload inválido" }, { status: 400 });

  const { path, fileName, size } = parsed.data;
  const prefix = `${ctx.company.id}/`;

  // Isolamento multi-tenant: o caminho TEM que estar sob a pasta da empresa.
  if (!path.startsWith(prefix) || path.includes("..") || !path.endsWith(".pdf")) {
    console.warn(`[catalog/pdf/upload] caminho recusado (company ${ctx.company.id})`);
    return NextResponse.json({ error: "caminho inválido" }, { status: 400 });
  }
  if (size && size > MAX_MB * 1024 * 1024) {
    return NextResponse.json(
      { error: `PDF acima do limite de ${MAX_MB} MB` },
      { status: 413 },
    );
  }

  const db = ctx.supabase;

  // Confirma que o arquivo chegou ao Storage (RLS permite o membro ler a
  // própria pasta).
  const folder = path.slice(0, path.lastIndexOf("/"));
  const name = path.slice(path.lastIndexOf("/") + 1);
  const { data: listed, error: listErr } = await db.storage
    .from("catalogs")
    .list(folder, { search: name, limit: 1 });
  if (listErr) {
    console.error("[catalog/pdf/upload] storage.list falhou:", listErr.message);
    return NextResponse.json(
      { error: `Não foi possível confirmar o upload: ${listErr.message}` },
      { status: 502 },
    );
  }
  if (!listed || !listed.some((f) => f.name === name)) {
    return NextResponse.json(
      { error: "O arquivo não chegou ao Storage. Reenvie o PDF." },
      { status: 409 },
    );
  }

  try {
    const { data: source, error: srcErr } = await db
      .from("catalog_sources")
      .upsert(
        {
          company_id: ctx.company.id,
          kind: "pdf",
          status: "processing",
          file_path: path,
          file_name: fileName,
          created_by: ctx.userId,
        },
        { onConflict: "company_id,kind" },
      )
      .select("id")
      .single();
    if (srcErr) throw srcErr;

    const { data: job, error: jobErr } = await db
      .from("catalog_import_jobs")
      .insert({
        company_id: ctx.company.id,
        source_id: source?.id ?? null,
        file_path: path,
        file_name: fileName,
        status: "pending",
        created_by: ctx.userId,
      })
      .select("id")
      .single();
    if (jobErr || !job) throw new Error(jobErr?.message ?? "falha ao criar job");

    await logCatalogEvent(
      ctx.company.id,
      "pdf_uploaded",
      { job: job.id, name: fileName, bytes: size ?? null },
      db,
    );
    console.log(`[catalog/pdf/upload] job ${job.id} criado (company ${ctx.company.id})`);

    // O processamento (leitura do PDF pela IA) roda no primeiro GET do job.
    return NextResponse.json({ jobId: job.id });
  } catch (e) {
    const msg = (e as { message?: string; code?: string })?.message ?? String(e);
    const code = (e as { code?: string })?.code;
    if (code === "42P01" || /relation .* does not exist|Could not find the table/i.test(msg)) {
      return NextResponse.json(
        { error: "Base Comercial ainda não ativada no banco (migration base_comercial)." },
        { status: 503 },
      );
    }
    if (code === "42501" || /row-level security|permission denied/i.test(msg)) {
      return NextResponse.json(
        { error: "Sem permissão para gravar a importação (RLS)." },
        { status: 403 },
      );
    }
    console.error("[catalog/pdf/upload] erro:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
