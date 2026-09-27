import { NextResponse } from "next/server";
import { z } from "zod";
import { tryGetContext, canWrite } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";

const Body = z.object({ action: z.enum(["start", "pause"]) });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await tryGetContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!canWrite(ctx.role)) return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "payload inválido" }, { status: 400 });

  const admin = createAdminClient();
  const { data: sweep } = await admin
    .from("number_sweeps")
    .select("id, status")
    .eq("id", id)
    .eq("company_id", ctx.company.id)
    .maybeSingle();
  if (!sweep) return NextResponse.json({ error: "não encontrada" }, { status: 404 });

  if (parsed.data.action === "pause") {
    await admin.from("number_sweeps").update({ status: "paused" }).eq("id", id);
    return NextResponse.json({ status: "paused" });
  }

  if (sweep.status === "completed")
    return NextResponse.json({ error: "sweep já concluída" }, { status: 400 });

  await admin
    .from("number_sweeps")
    .update({ status: "running", consecutive_errors: 0 })
    .eq("id", id);
  return NextResponse.json({ status: "running" });
}
