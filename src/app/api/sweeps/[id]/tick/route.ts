import { NextResponse } from "next/server";
import { tryGetContext, canWrite } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNextForSweep } from "@/lib/sweeps/worker";

/** Envio manual imediato (ignora janela/intervalo) — usado pelo botão "Enviar agora" na tela. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await tryGetContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!canWrite(ctx.role)) return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const admin = createAdminClient();
  const { data: sweep } = await admin
    .from("number_sweeps")
    .select("id")
    .eq("id", id)
    .eq("company_id", ctx.company.id)
    .maybeSingle();
  if (!sweep) return NextResponse.json({ error: "não encontrada" }, { status: 404 });

  const result = await sendNextForSweep(admin, id, { manual: true });
  return NextResponse.json(result);
}
