"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface LeadRow {
  discovery_id: string;
  company_name: string | null;
  segment: string | null;
  city: string | null;
  state: string | null;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  website: string | null;
  product_match_name: string | null;
  product_match_reason: string | null;
  lead_status: string;
  failure_reason: string | null;
}

const STATUS_META: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "success" | "warning" | "danger" }> = {
  awaiting: { label: "🔎 Aguardando abordagem", variant: "outline" },
  queued: { label: "📋 Na fila de envio", variant: "secondary" },
  sending: { label: "📤 Enviando", variant: "secondary" },
  sent: { label: "✅ Enviado", variant: "success" },
  delivered: { label: "✅ Entregue", variant: "success" },
  read: { label: "👁️ Lido", variant: "success" },
  replied: { label: "💬 Respondeu", variant: "success" },
  needs_attention: { label: "🔴 Precisa de você", variant: "danger" },
  failed: { label: "❌ Falhou", variant: "danger" },
  skipped: { label: "⏭️ Pulado", variant: "outline" },
  opted_out: { label: "🚫 Não contatar", variant: "outline" },
};

const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "awaiting", label: "Aguardando abordagem" },
  { value: "queued", label: "Na fila" },
  { value: "sent", label: "Enviado" },
  { value: "read", label: "Lido" },
  { value: "replied", label: "Respondeu" },
  { value: "needs_attention", label: "Precisa de você" },
  { value: "failed", label: "Falhou" },
  { value: "skipped", label: "Pulado" },
  { value: "opted_out", label: "Não contatar" },
];

function statusMeta(s: string) {
  return STATUS_META[s] ?? { label: s, variant: "outline" as const };
}

export function LeadsDiscoveryList({
  campaignId,
  runId,
}: {
  campaignId: string;
  runId: string | null;
}) {
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const pageSize = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(q ? { q } : {}),
        ...(status ? { status } : {}),
        ...(runId ? { runId } : { campaignId }),
      });
      const res = await fetch(`/api/leads/discoveries?${params}`);
      const data = await res.json();
      if (res.ok) {
        setRows(data.rows ?? []);
        setTotal(data.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [campaignId, runId, page, q, status]);

  useEffect(() => {
    load();
  }, [load]);

  // busca/filtro reseta para a primeira página
  useEffect(() => {
    setPage(1);
  }, [q, status]);

  useEffect(() => {
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por empresa, segmento ou WhatsApp…"
            className="pl-8"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs text-muted-foreground">
        {total} lead(s) {q || status ? "encontrados com esse filtro" : "no total"}
        {loading && <Loader2 className="ml-2 inline size-3 animate-spin" />}
      </p>

      {/* Desktop: tabela. Celular: cards. */}
      <div className="hidden overflow-x-auto rounded-lg border sm:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Empresa</th>
              <th className="px-3 py-2 font-medium">Segmento</th>
              <th className="px-3 py-2 font-medium">WhatsApp</th>
              <th className="px-3 py-2 font-medium">Oportunidade</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const meta = statusMeta(r.lead_status);
              return (
                <tr key={r.discovery_id} className="border-t">
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.company_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {[r.city, r.state].filter(Boolean).join(", ")}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.segment ?? "—"}</td>
                  <td className="px-3 py-2">{r.whatsapp ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.product_match_name ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  Nenhum lead encontrado com esse filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 sm:hidden">
        {rows.map((r) => {
          const meta = statusMeta(r.lead_status);
          return (
            <Card key={r.discovery_id}>
              <CardContent className="space-y-1.5 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">🏪 {r.company_name}</span>
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {r.segment ?? "Segmento não identificado"}
                  {r.city ? ` · ${r.city}` : ""}
                </p>
                <p className="text-xs">
                  <span className="text-muted-foreground">WhatsApp: </span>
                  {r.whatsapp ?? "não encontrado"}
                </p>
                {r.product_match_name && (
                  <p className="text-xs">
                    <span className="text-muted-foreground">Oportunidade: </span>
                    {r.product_match_name}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
        {rows.length === 0 && !loading && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum lead encontrado com esse filtro.
          </p>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 disabled:opacity-40"
            >
              <ChevronLeft className="size-4" /> Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 disabled:opacity-40"
            >
              Próxima <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
