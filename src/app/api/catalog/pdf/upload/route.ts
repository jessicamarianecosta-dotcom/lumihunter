import { NextResponse } from "next/server";
import { z } from "zod";
import { tryGetContext, canWrite } from "@/lib/auth/context";
import { logCatalogEvent } from "@/lib/catalog/sources";

export const maxDuration = 30;

const MAX_MB = Number(process.env.CATALOG_PDF_MAX_MB || 20);

/**
 * Registro de um catálogo PDF.
 *
 * O ARQUIVO já foi enviado pelo navegador DIRETO ao Supabase Storage
 * (bucket `catalogs`, pasta `<company_id>/`, protegida por RLS). Aqui só chega
 * JSON pequeno.
 *
 * Duas opções INDEPENDENTES:
 *  - useForSending: o PDF fica disponível para envio nas campanhas de WhatsApp;
 *  - importProducts: a IA lê o PDF e extrai produtos (fluxo de revisão).
 * Pode marcar as duas.
 */
const Body = z.object({
  path: z.string().min(3).max(300),
  fileName: z.string().min(1).max(200),
  size: z.number().int().positive().optional(),
  useForSending: z.boolean().optional(),
  importProducts: z.boolean().optional(),
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
  const useForSending = parsed.data.useForSending ?? true;
  const importProducts = parsed.data.importProducts ?? false;
  const prefix = `${ctx.company.id}/`;

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

  // Confirma que o arquivo chegou ao Storage.
  const folder = path.slice(0, path.lastIndexOf("/"));
  const name = path.slice(path.lastIndexOf("/") + 1);
  const { data: listed, error: listErr } = await db.storage
    .from("catalogs")
    .list(folder, { search: name, limit: 1 });
  if (listErr) {
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
    // ── Catálogo PDF (sempre registrado primeiro — é o artefato principal) ──
    const { count: existingDefault } = await db
      .from("catalog_pdfs")
      .select("id", { count: "exact", head: true })
      .eq("company_id", ctx.company.id)
      .eq("is_default", true);

    const { data: pdf, error: pdfErr } = await db
      .from("catalog_pdfs")
      .insert({
        company_id: ctx.company.id,
        file_path: path,
        file_name: fileName,
        file_size: size ?? null,
        use_for_sending: useForSending,
        is_default: useForSending && (existingDefault ?? 0) === 0,
        uploaded_by: ctx.userId,
      })
      .select("id")
      .single();
    if (pdfErr) throw pdfErr;

    let jobId: string | null = null;

    // ── Importação de produtos (opcional) ─────────────────────────────────
    if (importProducts) {
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
      jobId = job.id;
      await db
        .from("catalog_pdfs")
        .update({ import_job_id: jobId })
        .eq("id", pdf.id);
    }

    await logCatalogEvent(
      ctx.company.id,
      "catalog_pdf_uploaded",
      { pdf: pdf.id, job: jobId, name: fileName, sending: useForSending, importing: importProducts },
      db,
    );

    return NextResponse.json({ pdfId: pdf.id, jobId });
  } catch (e) {
    const msg = (e as { message?: string; code?: string })?.message ?? String(e);
    const code = (e as { code?: string })?.code;
    if (code === "42P01" || /relation .* does not exist|Could not find the table/i.test(msg)) {
      return NextResponse.json(
        { error: "Base Comercial ainda não ativada no banco." },
        { status: 503 },
      );
    }
    if (code === "42501" || /row-level security|permission denied/i.test(msg)) {
      return NextResponse.json({ error: "Sem permissão (RLS)." }, { status: 403 });
    }
    console.error("[catalog/pdf/upload] erro:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
