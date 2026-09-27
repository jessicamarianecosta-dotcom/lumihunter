import { NextResponse } from "next/server";
import { tryGetContext } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await tryGetContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: sweep } = await admin
    .from("number_sweeps")
    .select("*")
    .eq("id", id)
    .eq("company_id", ctx.company.id)
    .maybeSingle();
  if (!sweep) return NextResponse.json({ error: "não encontrada" }, { status: 404 });

  const { data: attempts } = await admin
    .from("number_sweep_attempts")
    .select("phone, status, failure_reason, attempted_at")
    .eq("sweep_id", id)
    .order("attempted_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ sweep, attempts: attempts ?? [] });
}
