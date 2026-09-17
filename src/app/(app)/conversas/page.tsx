import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HelpTip } from "@/components/help/help-tip";
import { formatDatePtBR } from "@/lib/utils";
import { conversationBadge } from "@/lib/outreach/conversation";

export const metadata: Metadata = { title: "Conversas" };

type Filter =
  | "all"
  | "attention"
  | "waiting"
  | "replied"
  | "interested"
  | "not_interested"
  | "failed";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "attention", label: "🔥 Precisa de você" },
  { key: "waiting", label: "🟡 Aguardando resposta" },
  { key: "replied", label: "💬 Responderam" },
  { key: "interested", label: "🟢 Interessados" },
  { key: "not_interested", label: "⚪ Sem interesse" },
  { key: "failed", label: "🔴 Falharam" },
];

interface Row {
  id: string;
  channel: string;
  outreach_state: string | null;
  needs_attention: boolean;
  attention_since: string | null;
  interest_status: string | null;
  last_reply_kind: string | null;
  catalog_sent: boolean;
  last_message_preview: string | null;
  last_message_at: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  unread_count: number;
  leads: { id: string; name: string; segment: string | null; city: string | null } | null;
}

/** Uma conversa nunca aparece em duas "gavetas" que se contradizem. */
function matches(r: Row, f: Filter): boolean {
  const s = r.outreach_state;
  const notInterested = r.interest_status === "not_interested" || s === "opted_out";
  switch (f) {
    case "all":
      return true;
    case "attention":
      return r.needs_attention;
    case "waiting":
      return (
        !r.needs_attention &&
        !notInterested &&
        s !== "failed" &&
        (r.last_inbound_at === null || s === "auto_replied")
      );
    case "replied":
      return r.last_inbound_at !== null;
    case "interested":
      return r.interest_status === "interested";
    case "not_interested":
      return notInterested;
    case "failed":
      return s === "failed";
  }
}

/** Prioridade de exibição: quem precisa de você primeiro, sempre. */
function priority(r: Row): number {
  if (r.needs_attention) return 0;
  if (r.interest_status === "interested") return 1;
  if (r.outreach_state === "auto_replied") return 2;
  if (r.outreach_state === "replied") return 3;
  if (r.outreach_state === "read") return 4;
  if (r.outreach_state === "delivered") return 5;
  if (r.outreach_state === "sent" || r.outreach_state === "sending") return 6;
  if (r.outreach_state === "queued") return 7;
  if (r.outreach_state === "failed") return 8;
  return 9;
}

export default async function ConversasPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter: filterRaw } = await searchParams;
  const filter: Filter = (FILTERS.find((f) => f.key === filterRaw)?.key ??
    "all") as Filter;

  const ctx = await getAppContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("conversations")
    .select(
      "id, channel, outreach_state, needs_attention, attention_since, interest_status, last_reply_kind, catalog_sent, last_message_preview, last_message_at, last_inbound_at, last_outbound_at, unread_count, leads(id, name, segment, city)",
    )
    .eq("company_id", ctx.company.id)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(300);

  const rows = ((data ?? []) as unknown as Row[]).slice();
  const counts: Record<Filter, number> = {
    all: rows.length,
    attention: rows.filter((r) => matches(r, "attention")).length,
    waiting: rows.filter((r) => matches(r, "waiting")).length,
    replied: rows.filter((r) => matches(r, "replied")).length,
    interested: rows.filter((r) => matches(r, "interested")).length,
    not_interested: rows.filter((r) => matches(r, "not_interested")).length,
    failed: rows.filter((r) => matches(r, "failed")).length,
  };

  const visible = rows
    .filter((r) => matches(r, filter))
    .sort(
      (a, b) =>
        priority(a) - priority(b) ||
        (b.last_message_at ?? "").localeCompare(a.last_message_at ?? ""),
    );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-1.5 text-2xl font-semibold">
          Conversas
          {counts.attention > 0 && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">
              {counts.attention}
            </span>
          )}
          <HelpTip
            title="Conversas"
            text="Sua caixa de entrada de prospecção: quem respondeu, se foi resposta automática ou de uma pessoa, e quem realmente precisa de você agora. Resposta automática (fora do horário, mensagem de ausência) não vira 'precisa de você' sozinha."
            articleSlug="o-que-e-a-central-de-conversas"
          />
        </h1>
        <p className="text-sm text-muted-foreground">
          Quem respondeu e precisa de mim agora? É essa a pergunta que esta
          tela responde — não confunda resposta automática com lead
          interessado.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/conversas" : `/conversas?filter=${f.key}`}
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
              filter === f.key
                ? "border-accent bg-accent/10 text-foreground"
                : "border-input text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
            <span className="ml-1 tabular-nums opacity-60">{counts[f.key]}</span>
          </Link>
        ))}
      </div>

      <div className="space-y-2">
        {visible.map((c) => {
          const lead = c.leads;
          const badge = conversationBadge(c);
          const tone =
            badge.tone === "success"
              ? "success"
              : badge.tone === "danger"
                ? "danger"
                : badge.tone === "hot"
                  ? "default"
                  : "secondary";
          return (
            <Link key={c.id} href={`/conversas/${c.id}`} className="block">
              <Card
                className={
                  c.needs_attention
                    ? "border-red-400 dark:border-red-500"
                    : badge.tone === "success"
                      ? "border-emerald-400/60 dark:border-emerald-500/60"
                      : ""
                }
              >
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                      {lead?.name ?? "Lead"}
                      <Badge variant={tone}>
                        {badge.icon} {badge.label}
                      </Badge>
                      {c.catalog_sent && (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                          📎 catálogo
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[lead?.segment, lead?.city].filter(Boolean).join(" • ") || "—"}
                    </p>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      {c.last_message_preview ?? "—"}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {c.last_message_at ? formatDatePtBR(c.last_message_at) : ""}
                  </span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
        {visible.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {filter === "all"
              ? "Nenhuma conversa ainda. Quando uma campanha automática abordar uma empresa, ela aparece aqui."
              : "Nenhuma conversa neste filtro."}
          </p>
        )}
      </div>
    </div>
  );
}
