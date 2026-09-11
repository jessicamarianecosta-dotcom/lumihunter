import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConversationThread } from "@/components/conversas/thread";
import { outreachStateLabel } from "@/lib/outreach/conversation";
import { assumeConversation } from "../actions";

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

  const { data: messagesRaw } = await supabase
    .from("messages")
    .select("id, direction, body, channel, status, error, attachments, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  // assina uma URL fresca (o bucket "attachments" é privado) para cada
  // anexo — nunca expõe o storage direto ao navegador.
  const messages = await Promise.all(
    (messagesRaw ?? []).map(async (m) => {
      const rawAttachments = Array.isArray(m.attachments)
        ? (m.attachments as { kind: string; path: string; filename: string; mimeType: string }[])
        : [];
      const attachments = await Promise.all(
        rawAttachments.map(async (a) => {
          const { data: signed } = await supabase.storage
            .from("attachments")
            .createSignedUrl(a.path, 3600);
          return { ...a, url: signed?.signedUrl ?? null };
        }),
      );
      return { ...m, attachments };
    }),
  );

  const campaignName = conv.outreach_campaign_id
    ? (
        await supabase
          .from("campaigns")
          .select("name")
          .eq("id", conv.outreach_campaign_id)
          .maybeSingle()
      ).data?.name ?? null
    : null;
  const st = outreachStateLabel(conv.outreach_state);

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
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold">
            {lead?.name ?? "Lead"}
            <Badge variant="outline">{conv.channel}</Badge>
            {conv.outreach_state && !conv.needs_attention && (
              <Badge
                variant={
                  st.tone === "success"
                    ? "success"
                    : st.tone === "danger"
                      ? "danger"
                      : "secondary"
                }
              >
                {st.icon} {st.label}
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            {lead?.segment ?? "—"} · {lead?.city ?? "—"}
            {lead?.state ? `/${lead.state}` : ""}
            {campaignName ? ` · campanha: ${campaignName}` : ""}
            {conv.catalog_sent ? " · 📎 catálogo enviado" : ""}
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

      {conv.needs_attention && (
        <Card className="border-red-400 bg-red-500/5 dark:border-red-500">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-semibold">🔥 O cliente respondeu</p>
              <p className="text-xs text-muted-foreground">
                A prospecção automática já parou para este contato. Assuma o
                atendimento para continuar a conversa.
              </p>
            </div>
            <form action={assumeConversation.bind(null, conv.id)}>
              <Button size="sm" type="submit">
                Assumir atendimento
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

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
        companyId={ctx.company.id}
        channel={conv.channel === "email" ? "email" : "whatsapp"}
        messages={messages}
      />
    </div>
  );
}
