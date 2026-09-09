import { NextResponse } from "next/server";
import { z } from "zod";
import { tryGetContext, canWrite } from "@/lib/auth/context";
import { logCatalogEvent } from "@/lib/catalog/sources";

const Body = z.object({
  id: z.string().uuid(),
  action: z.enum(["set_default", "toggle_sending", "delete"]),
});

export async function POST(req: Request) {
  const ctx = await tryGetContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!canWrite(ctx.role))
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: "payload inválido" }, { status: 400 });
  const { id, action } = parsed.data;

  const db = ctx.supabase;
  const { data: pdf } = await db
    .from("catalog_pdfs")
    .select("id, file_path, use_for_sending, is_default")
    .eq("id", id)
    .eq("company_id", ctx.company.id)
    .maybeSingle();
  if (!pdf)
    return NextResponse.json({ error: "catálogo não encontrado" }, { status: 404 });

  if (action === "set_default") {
    // só um padrão por empresa
    await db
      .from("catalog_pdfs")
      .update({ is_default: false })
      .eq("company_id", ctx.company.id)
      .eq("is_default", true);
    await db
      .from("catalog_pdfs")
      .update({ is_default: true, use_for_sending: true })
      .eq("id", id);
    await logCatalogEvent(ctx.company.id, "catalog_pdf_default", { pdf: id }, db);
    return NextResponse.json({ ok: true });
  }

  if (action === "toggle_sending") {
    const next = !pdf.use_for_sending;
    await db
      .from("catalog_pdfs")
      .update({ use_for_sending: next, ...(next ? {} : { is_default: false }) })
      .eq("id", id);
    return NextResponse.json({ ok: true, use_for_sending: next });
  }

  // delete: remove o registro + o arquivo do storage
  await db.from("catalog_pdfs").delete().eq("id", id);
  if (pdf.file_path.startsWith(`${ctx.company.id}/`)) {
    await db.storage.from("catalogs").remove([pdf.file_path]);
  }
  await logCatalogEvent(ctx.company.id, "catalog_pdf_deleted", { pdf: id }, db);
  return NextResponse.json({ ok: true });
}
