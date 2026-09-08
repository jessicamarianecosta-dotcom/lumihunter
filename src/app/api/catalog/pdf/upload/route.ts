import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { tryGetContext, canWrite } from "@/lib/auth/context";
import { catalogAdmin } from "@/lib/catalog/db";
import { upsertSource, logCatalogEvent } from "@/lib/catalog/sources";
import { processImportJob } from "@/lib/catalog/pdf";

export const maxDuration = 60;

const MAX_MB = Number(process.env.CATALOG_PDF_MAX_MB || 15);

export async function POST(req: Request) {
  const ctx = await tryGetContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!canWrite(ctx.role))
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "envie um arquivo em 'file'" }, { status: 400 });
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "apenas PDF é aceito" }, { status: 415 });
  }
  if (file.size > MAX_MB * 1024 * 1024) {
    return NextResponse.json(
      { error: `PDF acima do limite de ${MAX_MB} MB` },
      { status: 413 },
    );
  }

  const admin = catalogAdmin();
  const path = `${ctx.company.id}/${randomUUID()}.pdf`;

  const { error: upErr } = await admin.storage
    .from("catalogs")
    .upload(path, Buffer.from(await file.arrayBuffer()), {
      contentType: "application/pdf",
      upsert: false,
    });
  if (upErr) {
    return NextResponse.json(
      { error: `falha ao guardar o PDF: ${upErr.message}` },
      { status: 500 },
    );
  }

  try {
    const source = await upsertSource({
      companyId: ctx.company.id,
      kind: "pdf",
      createdBy: ctx.userId,
      patch: { status: "processing", file_path: path, file_name: file.name },
    });

    const { data: job, error: jobErr } = await admin
      .from("catalog_import_jobs")
      .insert({
        company_id: ctx.company.id,
        source_id: source.id,
        file_path: path,
        file_name: file.name,
        status: "pending",
        created_by: ctx.userId,
      })
      .select("id")
      .single();
    if (jobErr || !job) throw new Error(jobErr?.message ?? "falha ao criar job");

    await logCatalogEvent(ctx.company.id, "pdf_uploaded", {
      job: job.id,
      name: file.name,
      bytes: file.size,
    });

    // processa de forma síncrona (dentro do maxDuration)
    await processImportJob(job.id).catch((e) => {
      console.error("[catalog/pdf] processamento falhou:", e);
    });

    return NextResponse.json({ jobId: job.id });
  } catch (e) {
    const msg = (e as Error).message;
    if (/relation .* does not exist|Could not find the table/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            "Base Comercial ainda não ativada. Aplique a migration 20260908210000_base_comercial.sql.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
