import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { listCatalogPdfs } from "@/lib/catalog/pdfs";
import { SweepPanel } from "@/components/app/sweep-panel";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { conversationBadge } from "@/lib/outreach/conversation";

export const metadata: Metadata = { title: "Números WhatsApp" };

type Filter = "all" | "sent" | "read" | "waiting" | "replied" | "interested" | "attention" | "failed";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "sent", label: "📤 Enviadas" },
  { key: "read", label: "👁️ Lidas" },
  { key: "waiting", label: "🟡 Aguardando resposta" },
  { key: "replied", label: "💬 Responderam" },
  { key: "interested", label: "🟢 Interessados" },
  { key: "attention", label: "🔥 Precisa de você" },
  { key: "failed", label: "🔴 Falharam" },
];

interface ConvRow {
  id: string;
  outreach_state: string | null;
  needs_attention: boolean;
  interest_status: string | null;
  last_message_preview: string | null;
  last_message_at: string | null;
  last_inbound_at: string | null;
  leads: { id: string; name: string; whatsapp: string | null } | null;
}

function matches(r: ConvRow, f: Filter): boolean {
  const s = r.outreach_state;
  const notInterested = r.interest_status === "not_interested" || s === "opted_out";
  switch (f) {
    case "all":
      return true;
    case "sent":
      return s === "sent" || s === "sending";
    case "read":
      return s === "read";
    case "waiting":
      return !r.needs_attention && !notInterested && s !== "failed" && r.last_inbound_at === null;
    case "replied":
      return r.last_inbound_at !== null;
    case "interested":
      return r.interest_status === "interested";
    case "attention":
      return r.needs_attention;
    case "failed":
      return s === "failed";
  }
}

export default async function ListaNumerosPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter: filterRaw } = await searchParams;
  const filter: Filter = (FILTERS.find((f) => f.key === filterRaw)?.key ?? "all") as Filter;

  const ctx = await getAppContext();
  const admin = createAdminClient();

  const [{ data: sweeps }, pdfs, { data: convData }] = await Promise.all([
    admin
      .from("number_sweeps")
      .select(
        "id, name, ddd, quantity_target, sent_count, attempted_count, invalid_count, skipped_count, failed_count, status, interval_seconds, created_at",
      )
      .eq("company_id", ctx.company.id)
      .order("created_at", { ascending: false }),
    listCatalogPdfs(admin, ctx.company.id).catch(() => []),
    admin
      .from("conversations")
      .select(
        "id, outreach_state, needs_attention, interest_status, last_message_preview, last_message_at, last_inbound_at, leads!inner(id, name, whatsapp, source)",
      )
      .eq("company_id", ctx.company.id)
      .eq("leads.source", "number_sweep")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(300),
  ]);

  const rows = ((convData ?? []) as unknown as ConvRow[]).slice();
  const counts: Record<Filter, number> = {
    all: rows.length,
    sent: rows.filter((r) => matches(r, "sent")).length,
    read: rows.filter((r) => matches(r, "read")).length,
    waiting: rows.filter((r) => matches(r, "waiting")).length,
    replied: rows.filter((r) => matches(r, "replied")).length,
    interested: rows.filter((r) => matches(r, "interested")).length,
    attention: rows.filter((r) => matches(r, "attention")).length,
    failed: rows.filter((r) => matches(r, "failed")).length,
  };
  const visible = rows.filter((r) => matches(r, filter));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Números WhatsApp</h1>
        <p className="text-sm text-muted-foreground">
          Informe um DDD e um número inicial e o LumiHunter gera os candidatos
          sequenciais e envia até atingir a quantidade de{" "}
          <strong>envios efetivos</strong> (números inválidos não contam e são
          pulados automaticamente).
        </p>
      </div>
      <SweepPanel
        sweeps={sweeps ?? []}
        catalogs={pdfs.map((p) => ({ id: p.id, label: p.file_name }))}
      />

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Conversas desta lista
          {counts.attention > 0 && (
            <span className="ml-2 rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">
              {counts.attention}
            </span>
          )}
        </h2>

        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={f.key === "all" ? "/lista-numeros" : `/lista-numeros?filter=${f.key}`}
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
                <Card className={c.needs_attention ? "border-red-400 dark:border-red-500" : ""}>
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                        {c.leads?.whatsapp ?? c.leads?.name ?? "Contato"}
                        <Badge variant={tone}>
                          {badge.icon} {badge.label}
                        </Badge>
                      </p>
                      {c.last_message_preview && (
                        <p className="truncate text-xs text-muted-foreground">
                          {c.last_message_preview}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
          {visible.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma conversa nesse filtro ainda.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
