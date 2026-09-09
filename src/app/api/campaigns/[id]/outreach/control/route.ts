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
  if (!canWrite(ctx.role))
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: "payload inválido" }, { status: 400 });

  const admin = createAdminClient();
  const { data: campaign } = await admin
    .from("campaigns")
    .select("id, channel, status, outreach_send_catalog, product_id, outreach_catalog_product_id")
    .eq("id", id)
    .eq("company_id", ctx.company.id)
    .maybeSingle();
  if (!campaign)
    return NextResponse.json({ error: "campanha não encontrada" }, { status: 404 });

  if (parsed.data.action === "pause") {
    await admin
      .from("campaigns")
      .update({ outreach_status: "paused" })
      .eq("id", id)
      .eq("company_id", ctx.company.id);
    return NextResponse.json({ outreach_status: "paused" });
  }

  // start
  if (campaign.channel !== "whatsapp")
    return NextResponse.json(
      { error: "Só é possível iniciar a fila em campanhas com canal WhatsApp." },
      { status: 400 },
    );

  const { count: ready } = await admin
    .from("outreach_queue")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", id)
    .eq("status", "ready");
  if ((ready ?? 0) === 0)
    return NextResponse.json(
      { error: "Nenhuma mensagem aprovada na fila. Gere e aprove as mensagens primeiro." },
      { status: 400 },
    );

  await admin
    .from("campaigns")
    .update({
      outreach_status: "running",
      outreach_started_at: new Date().toISOString(),
      outreach_consecutive_errors: 0,
      ...(campaign.status === "draft" ? { status: "active" as never } : {}),
    })
    .eq("id", id)
    .eq("company_id", ctx.company.id);

  return NextResponse.json({ outreach_status: "running", ready: ready ?? 0 });
}
