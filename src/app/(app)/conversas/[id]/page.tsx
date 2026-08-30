import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConversationThread } from "@/components/conversas/thread";

export const metadata: Metadata = { title: "Conversa" };

export default async function ConversaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getAppContext();
  const supabase = await createClient();

  const { data: conv } = await supabase
    .from("conversations")
    .select("*, leads(id, name, segment, city, state, whatsapp, email)")
    .eq("id", id)
    .eq("company_id", ctx.company.id)
    .maybeSingle();
  if (!conv) notFound();

  const lead = conv.leads as {
    id: string;
    name: string;
    segment: string | null;
    city: string | null;
    state: string | null;
  } | null;

  const { data: messages } = await supabase
    .from("messages")
    .select("id, direction, body, channel, status, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  // zera não lidas
  if (conv.unread_count > 0) {
    await supabase.from("conversations").update({ unread_count: 0 }).eq("id", id);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link
        href="/conversas"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Todas as conversas
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">
            {lead?.name ?? "Lead"}{" "}
            <Badge variant="outline">{conv.channel}</Badge>
          </h1>
          <p className="text-sm text-muted-foreground">
            {lead?.segment ?? "—"} · {lead?.city ?? "—"}
            {lead?.state ? `/${lead.state}` : ""}
          </p>
        </div>
        {lead && (
          <Link
            href={`/leads/${lead.id}`}
            className="text-sm text-accent hover:underline"
          >
            Abrir lead →
          </Link>
        )}
      </div>

      {conv.ai_summary && (
        <Card>
          <CardContent className="p-4 text-sm">
            <p className="font-medium">Resumo da IA</p>
            <p className="mt-1 text-muted-foreground">{conv.ai_summary}</p>
            {conv.ai_classification && (
              <Badge variant="secondary" className="mt-2">
                {conv.ai_classification}
              </Badge>
            )}
          </CardContent>
        </Card>
      )}

      <ConversationThread
        conversationId={conv.id}
        leadId={conv.lead_id}
        channel={conv.channel === "email" ? "email" : "whatsapp"}
        messages={messages ?? []}
      />
    </div>
  );
}
