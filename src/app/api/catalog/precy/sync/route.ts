import { NextResponse } from "next/server";
import { tryGetContext, canWrite } from "@/lib/auth/context";
import { hasRealProvider } from "@/lib/catalog/providers";
import { syncPrecyCatalog } from "@/lib/catalog/sync";
import { logCatalogEvent } from "@/lib/catalog/sources";

export const maxDuration = 60;

export async function POST() {
  const ctx = await tryGetContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!canWrite(ctx.role))
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  if (!hasRealProvider("precy")) {
    await logCatalogEvent(ctx.company.id, "sync_error", { reason: "provider off" });
    return NextResponse.json(
      { ok: false, message: "Integração Precy+ desabilitada nesta instância." },
      { status: 501 },
    );
  }

  try {
    const r = await syncPrecyCatalog(ctx.company.id, ctx.supabase);
    console.log(
      `[catalog/precy/sync] company ${ctx.company.id}: found=${r.found} created=${r.created} updated=${r.updated} removed=${r.removed} errors=${r.errors.length}`,
    );
    if (!r.ok) {
      return NextResponse.json(
        { ...r, message: r.errors[0] ?? "Falha na sincronização." },
        { status: 502 },
      );
    }
    return NextResponse.json({
      ...r,
      message: `${r.found} encontrado(s) · ${r.created} novo(s) · ${r.updated} atualizado(s)${
        r.removed ? ` · ${r.removed} removido(s)` : ""
      }${r.needsReview ? ` · ${r.needsReview} p/ revisão` : ""}`,
    });
  } catch (e) {
    const msg = (e as Error).message;
    console.error("[catalog/precy/sync] erro:", msg);
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
