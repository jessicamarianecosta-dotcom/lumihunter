import { NextResponse } from "next/server";
import { z } from "zod";
import { tryGetContext, canWrite } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { runSalesCoach } from "@/lib/anthropic/agents/sales-coach";
import type { Lead } from "@/lib/supabase/database.types";

export const maxDuration = 60;

const Body = z.object({ conversationId: z.string().uuid() });

export async function POST(req: Request) {
  const ctx = await tryGetContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!canWrite(ctx.role))
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const { conversationId } = Body.parse(await req.json().catch(() => ({})));
  const admin = createAdminClient();

  const { data: conv } = await admin
    .from("conversations")
    .select("id, lead_id")
    .eq("id", conversationId)
    .eq("company_id", ctx.company.id)
    .maybeSingle();
  if (!conv) return NextResponse.json({ error: "conversa não encontrada" }, { status: 404 });

  const [{ data: lead }, { data: msgs }, { data: kb }] = await Promise.all([
    admin.from("leads").select("*").eq("id", conv.lead_id).maybeSingle(),
    admin
      .from("messages")
      .select("direction, body")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(40),
    admin
      .from("knowledge_entries")
      .select("title, content")
      .eq("company_id", ctx.company.id)
      .eq("is_active", true)
      .limit(20),
  ]);
  if (!lead) return NextResponse.json({ error: "lead não encontrado" }, { status: 404 });

  const result = await runSalesCoach({
    companyId: ctx.company.id,
    company: ctx.company,
    lead: lead as Lead,
    messages: (msgs ?? []) as { direction: "inbound" | "outbound"; body: string | null }[],
    knowledge: (kb ?? []) as { title: string; content: string }[],
    userId: ctx.userId,
  });

  await admin
    .from("conversations")
    .update({
      ai_classification: result.classification,
      ai_summary: result.summary,
    })
    .eq("id", conversationId);

  return NextResponse.json(result);
}
