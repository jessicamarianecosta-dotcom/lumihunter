import { NextResponse } from "next/server";
import { tryGetContext, isAdmin } from "@/lib/auth/context";
import { healthCheck } from "@/lib/whatsapp/service";

export const maxDuration = 15;

/** Testa a conexão real com o provider de WhatsApp atualmente ativo (Meta ou YCloud). */
export async function POST() {
  const ctx = await tryGetContext();
  if (!ctx)
    return NextResponse.json({ ok: false, error: "não autenticado" }, { status: 401 });
  if (!isAdmin(ctx.role))
    return NextResponse.json({ ok: false, error: "sem permissão" }, { status: 403 });

  const result = await healthCheck(ctx.company.id);
  return NextResponse.json(result);
}
