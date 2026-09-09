import { NextResponse } from "next/server";
import { z } from "zod";
import { tryGetContext, canWrite } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { markConversationOutreach } from "@/lib/outreach/conversation";

const Body = z.object({
  ids: z.array(z.string().uuid()).optional(),
  all: z.boolean().optional(),
});

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
  let q = admin
    .from("outreach_queue")
    .update({ status: "ready", scheduled_at: new Date().toISOString() })
    .eq("campaign_id", id)
    .eq("company_id", ctx.company.id)
    .eq("status", "draft")
    .not("message_body", "is", null);
  if (parsed.data.ids?.length) q = q.in("id", parsed.data.ids);
  else if (!parsed.data.all)
    return NextResponse.json({ error: "informe ids ou all=true" }, { status: 400 });

  const { data, error } = await q.select("id, lead_id, message_body");
  if (error)
    return NextResponse.json({ error: "falha ao aprovar mensagens" }, { status: 500 });

  // cada mensagem aprovada → conversa "Na fila" em Conversas
  for (const row of data ?? []) {
    await markConversationOutreach(admin, {
      companyId: ctx.company.id,
      leadId: row.lead_id,
      campaignId: id,
      state: "queued",
      preview: row.message_body,
    });
  }

  return NextResponse.json({ approved: data?.length ?? 0 });
}
