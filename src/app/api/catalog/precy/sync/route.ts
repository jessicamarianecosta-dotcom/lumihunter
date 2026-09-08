import { NextResponse } from "next/server";
import { tryGetContext, canWrite } from "@/lib/auth/context";
import { hasRealProvider } from "@/lib/catalog/providers";
import { logCatalogEvent } from "@/lib/catalog/sources";

export const maxDuration = 60;

export async function POST() {
  const ctx = await tryGetContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!canWrite(ctx.role))
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  if (!hasRealProvider("precy")) {
    await logCatalogEvent(ctx.company.id, "precy_sync_blocked", {});
    return NextResponse.json(
      {
        ok: false,
        message:
          "A sincronização automática com o catálogo online do Precy+ ainda não está disponível: falta confirmar com o Precy+ o método oficial de acesso (API dedicada ou uso do PostgREST público). A URL fica salva e o botão \"Abrir catálogo\" funciona. A arquitetura já está pronta para ligar a sincronização quando isso for definido.",
      },
      { status: 501 },
    );
  }

  // Quando `PRECY_ENABLED=true` e a listagem por loja estiver confirmada, o
  // sync real entra aqui (listProducts → upsert por external_id → diff).
  return NextResponse.json({ ok: false, message: "sync real ainda não implementado" }, { status: 501 });
}
