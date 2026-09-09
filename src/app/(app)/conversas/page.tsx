import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HelpTip } from "@/components/help/help-tip";
import { formatDatePtBR } from "@/lib/utils";
import { outreachStateLabel } from "@/lib/outreach/conversation";

export const metadata: Metadata = { title: "Conversas" };

type Filter =
  | "all"
  | "attention"
  | "queued"
  | "sent"
  | "delivered"
  | "read"
  | "replied"
  | "waiting"
  | "failed"
  | "opted_out";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "attention", label: "🔥 Precisa de você" },
  { key: "queued", label: "🟡 Na fila" },
  { key: "sent", label: "✓ Enviadas" },
  { key: "delivered", label: "✓✓ Entregues" },
  { key: "read", label: "👁 Lidas" },
  { key: "replied", label: "💬 Responderam" },
  { key: "waiting", label: "⏳ Aguardando resposta" },
  { key: "failed", label: "🔴 Falharam" },
  { key: "opted_out", label: "🚫 Opt-out" },
];

interface Row {
  id: string;
  channel: string;
  outreach_state: string | null;
  needs_attention: boolean;
  attention_since: string | null;
  catalog_sent: boolean;
  last_message_preview: string | null;
  last_message_at: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  unread_count: number;
  leads: { id: string; name: string; city: string | null } | null;
}

function matches(r: Row, f: Filter): boolean {
  const s = r.outreach_state;
  switch (f) {
    case "all":
      return true;
    case "attention":
      return r.needs_attention;
    case "queued":
      return s === "queued" || s === "sending";
    case "sent":
      return s === "sent";
    case "delivered":
      return s === "delivered";
    case "read":
      return s === "read";
    case "replied":
      return s === "replied" || r.needs_attention;
    case "waiting":
      return (s === "sent" || s === "delivered" || s === "read") && !r.needs_attention;
    case "failed":
      return s === "failed";
    case "opted_out":
      return s === "opted_out";
  }
}

/** Prioridade: quem respondeu e precisa de você primeiro. */
function priority(r: Row): number {
  if (r.needs_attention) return 0;
  if (r.outreach_state === "replied") return 1;
  if (r.outreach_state === "read") return 2;
  if (r.outreach_state === "delivered") return 3;
  if (r.outreach_state === "sent" || r.outreach_state === "sending") return 4;
  if (r.outreach_state === "queued") return 5;
  if (r.outreach_state === "failed") return 6;
  return 7;
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
      "id, channel, outreach_state, needs_attention, attention_since, catalog_sent, last_message_preview, last_message_at, last_inbound_at, last_outbound_at, unread_count, leads(id, name, city)",
    )
    .eq("company_id", ctx.company.id)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(300);

  const rows = ((data ?? []) as unknown as Row[]).slice();
  const counts: Record<Filter, number> = {
    all: rows.length,
    attention: rows.filter((r) => matches(r, "attention")).length,
    queued: rows.filter((r) => matches(r, "queued")).length,
    sent: rows.filter((r) => matches(r, "sent")).length,
    delivered: rows.filter((r) => matches(r, "delivered")).length,
    read: rows.filter((r) => matches(r, "read")).length,
    replied: rows.filter((r) => matches(r, "replied")).length,
    waiting: rows.filter((r) => matches(r, "waiting")).length,
    failed: rows.filter((r) => matches(r, "failed")).length,
    opted_out: rows.filter((r) => matches(r, "opted_out")).length,
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
            text="Aqui você acompanha o que realmente aconteceu no WhatsApp: na fila → enviado → entregue → lido → respondeu. Quem respondeu aparece primeiro e precisa do seu atendimento."
            articleSlug="o-que-e-a-central-de-conversas"
          />
        </h1>
        <p className="text-sm text-muted-foreground">
          Acompanhamento real dos envios. &ldquo;WhatsApp ✓&rdquo; na descoberta
          significa só que existe um número — aqui você vê se a mensagem saiu,
          chegou, foi lida e se responderam.
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
          const st = outreachStateLabel(c.outreach_state);
          return (
            <Link key={c.id} href={`/conversas/${c.id}`} className="block">
              <Card
                className={
                  c.needs_attention ? "border-red-400 dark:border-red-500" : ""
                }
              >
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                      {lead?.name ?? "Lead"}
                      <Badge variant="outline">{c.channel}</Badge>
                      {c.needs_attention ? (
                        <Badge variant="danger">🔥 Precisa de atendimento</Badge>
                      ) : (
                        <Badge
                          variant={
                            st.tone === "success"
                              ? "success"
                              : st.tone === "danger"
                                ? "danger"
                                : st.tone === "hot"
                                  ? "default"
                                  : "secondary"
                          }
                        >
                          {st.icon} {st.label}
                        </Badge>
                      )}
                      {c.catalog_sent && (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                          📎 catálogo
                        </span>
                      )}
                    </p>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      {lead?.city ? `${lead.city} · ` : ""}
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
