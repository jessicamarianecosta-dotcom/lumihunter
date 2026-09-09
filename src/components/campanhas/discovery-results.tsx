"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Globe,
  Instagram,
  MessageCircle,
  Phone,
  Mail,
  ExternalLink,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface DiscoveryRow {
  id: string;
  company_name: string;
  segment: string | null;
  description: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  source: string;
  source_url: string | null;
  discovery_query: string | null;
  score: number | null;
  buyer_fit_score: number | null;
  product_fit_score: number | null;
  business_fit_score: number | null;
  result_type: string | null;
  business_type: string | null;
  individual_business: boolean;
  competitor: boolean;
  whatsapp_verified: boolean;
  whatsapp_evidence: string | null;
  product_match_name: string | null;
  product_match_reason: string | null;
  discard_reason: string | null;
  qualification: string | null;
  qualification_reason: string | null;
  qualification_signals: { label: string; detail?: string }[];
  evidence: string[];
  qualified_by: string | null;
  recommended_approach: string | null;
  status: string;
  discovered_at: string;
}

type Filter = "qualified" | "approved" | "rejected" | "all";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "qualified", label: "🔥 Leads de alto potencial" },
  { key: "approved", label: "Já adicionados" },
  { key: "rejected", label: "Descartados (auditoria)" },
  { key: "all", label: "Todos" },
];

const SELECTABLE = new Set(["qualified"]);

function qualLabel(q: string | null): { text: string; variant: "success" | "warning" | "danger" | "secondary" } {
  if (q === "high") return { text: "Alto potencial", variant: "success" };
  if (q === "medium") return { text: "Médio potencial", variant: "warning" };
  if (q === "low") return { text: "Baixo potencial", variant: "danger" };
  return { text: "—", variant: "secondary" };
}

function statusBadge(s: string) {
  if (s === "approved") return <Badge variant="success">Aprovado</Badge>;
  if (s === "rejected") return <Badge variant="danger">Rejeitado</Badge>;
  if (s === "qualified") return <Badge variant="secondary">Qualificado</Badge>;
  return <Badge variant="secondary">Encontrado</Badge>;
}

function FitBar({ label, value }: { label: string; value: number | null }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  const color =
    v >= 70 ? "bg-emerald-500" : v >= 45 ? "bg-amber-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
      <span className="w-20 shrink-0">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
        <span
          className={`block h-full rounded-full ${color}`}
          style={{ width: `${v}%` }}
        />
      </span>
      <span className="w-7 shrink-0 text-right tabular-nums">{value ?? "—"}</span>
    </div>
  );
}

export function DiscoveryResults({
  campaignId,
  rows,
  automatic = false,
}: {
  campaignId: string;
  rows: DiscoveryRow[];
  /** modo automático: sem aprovação manual — a lista é só acompanhamento. */
  automatic?: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("qualified");
  const [region, setRegion] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<null | "approve" | "reject">(null);
  const [msg, setMsg] = useState<string | null>(null);

  const cities = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.city).filter((c): c is string => !!c))).sort(
        (a, b) => a.localeCompare(b, "pt-BR"),
      ),
    [rows],
  );

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (region && r.city !== region) return false;
      switch (filter) {
        case "qualified":
          return r.status === "qualified" || r.status === "approved";
        case "approved":
          return r.status === "approved";
        case "rejected":
          return r.status === "rejected";
        default:
          return true;
      }
    });
  }, [rows, filter, region]);

  const counts = useMemo(() => {
    const leads = rows.filter(
      (r) => r.status === "qualified" || r.status === "approved",
    ).length;
    const approved = rows.filter((r) => r.status === "approved").length;
    const discarded = rows.filter((r) => r.status === "rejected").length;
    return { leads, approved, discarded, screened: rows.length };
  }, [rows]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function selectAll() {
    setSelected(new Set(rows.filter((r) => SELECTABLE.has(r.status)).map((r) => r.id)));
  }
  function selectFiltered() {
    setSelected(
      new Set(filtered.filter((r) => SELECTABLE.has(r.status)).map((r) => r.id)),
    );
  }

  async function submit(action: "approve" | "reject") {
    if (selected.size === 0) return;
    setBusy(action);
    setMsg(null);
    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/discoveries/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: [...selected], action }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.error ?? "Falha na operação.");
      } else if (action === "approve") {
        setMsg(
          `${data.approved} aprovados · ${data.leadsCreated} leads criados · ${data.targetsCreated} adicionados à campanha.`,
        );
        setSelected(new Set());
        router.refresh();
      } else {
        setMsg(`${data.rejected} descartados.`);
        setSelected(new Set());
        router.refresh();
      }
    } catch {
      setMsg("Erro de rede.");
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum lead descoberto ainda. Use o botão “🔎 Procurar possíveis leads”.
      </p>
    );
  }

  const selCount = selected.size;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span>
          🔥 <strong className="tabular-nums">{counts.leads}</strong> leads de alto
          potencial
        </span>
        <span className="text-muted-foreground">
          <strong className="tabular-nums text-foreground">{counts.approved}</strong>{" "}
          já adicionados
        </span>
        <span className="text-muted-foreground">
          <strong className="tabular-nums text-foreground">{counts.discarded}</strong>{" "}
          descartados · {counts.screened} analisados
        </span>
        {selCount > 0 && (
          <span className="text-accent">
            <strong className="tabular-nums">{selCount}</strong> selecionados
          </span>
        )}
      </div>

      {/* filtros */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
              filter === f.key
                ? "border-accent bg-accent/10 text-foreground"
                : "border-input text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
        {cities.length > 1 && (
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="rounded-full border border-input bg-background px-2.5 py-1 text-xs"
          >
            <option value="">Todas as cidades</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* ações em massa */}
      <div className={`flex flex-wrap items-center gap-2 ${automatic ? "hidden" : ""}`}>
        <Button size="sm" variant="outline" onClick={selectAll}>
          Selecionar todos
        </Button>
        <Button size="sm" variant="outline" onClick={selectFiltered}>
          Selecionar filtrados
        </Button>
        {selCount > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelected(new Set())}
          >
            Limpar
          </Button>
        )}
        <div className="flex-1" />
        <Button
          size="sm"
          onClick={() => submit("approve")}
          disabled={selCount === 0 || busy !== null}
        >
          {busy === "approve" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : null}
          Aprovar selecionados
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => submit("reject")}
          disabled={selCount === 0 || busy !== null}
        >
          {busy === "reject" ? <Loader2 className="size-4 animate-spin" /> : null}
          Rejeitar
        </Button>
      </div>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}

      {/* lista */}
      <div className="grid gap-3 lg:grid-cols-2">
        {filtered.map((r) => {
          const q = qualLabel(r.qualification);
          const canSelect = !automatic && SELECTABLE.has(r.status);
          const isOpen = expanded.has(r.id);
          return (
            <div
              key={r.id}
              className="rounded-xl border bg-card p-3.5 text-sm"
            >
              <div className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  className={`mt-1 size-4 ${automatic ? "hidden" : ""}`}
                  checked={selected.has(r.id)}
                  disabled={!canSelect}
                  onChange={() => toggle(r.id)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.company_name}</span>
                    {statusBadge(r.status)}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {r.segment ?? "segmento não identificado"}
                    {r.city ? ` · ${r.city}` : ""}
                    {r.state ? `/${r.state}` : ""}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant={q.variant}>
                      {r.score ?? "—"} · {q.text}
                    </Badge>
                    {r.competitor ? (
                      <Badge variant="danger">Concorrente</Badge>
                    ) : r.whatsapp_verified ? (
                      <Badge variant="success">WhatsApp ✓</Badge>
                    ) : (
                      <Badge variant="warning">Sem WhatsApp</Badge>
                    )}
                    {r.product_match_name && (
                      <Badge variant="secondary">🎯 {r.product_match_name}</Badge>
                    )}
                    {r.qualified_by === "ai" && (
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        IA
                      </span>
                    )}
                  </div>

                  <div className="mt-2 space-y-1">
                    <FitBar label="Buyer fit" value={r.buyer_fit_score} />
                    <FitBar label="Product fit" value={r.product_fit_score} />
                  </div>

                  {r.discard_reason && r.status !== "qualified" && (
                    <p className="mt-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                      ⚠ {r.discard_reason}
                    </p>
                  )}

                  {r.qualification_signals.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {r.qualification_signals.slice(0, isOpen ? 99 : 3).map((s, i) => (
                        <span
                          key={i}
                          className="rounded bg-secondary px-1.5 py-0.5 text-[11px] text-secondary-foreground"
                        >
                          ✓ {s.label}
                          {s.detail ? ` (${s.detail})` : ""}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {r.website && (
                      <a
                        href={r.website}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        <Globe className="size-3.5" /> Site
                      </a>
                    )}
                    {r.instagram && (
                      <a
                        href={r.instagram}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        <Instagram className="size-3.5" /> Instagram
                      </a>
                    )}
                    {r.whatsapp && (
                      <span className="inline-flex items-center gap-1">
                        <MessageCircle className="size-3.5" /> {r.whatsapp}
                      </span>
                    )}
                    {r.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="size-3.5" /> {r.phone}
                      </span>
                    )}
                    {r.email && (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="size-3.5" /> {r.email}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => toggleExpand(r.id)}
                    className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline"
                  >
                    <ChevronDown
                      className={`size-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                    {isOpen ? "Menos" : "Ver detalhes"}
                  </button>

                  {isOpen && (
                    <div className="mt-2 space-y-1.5 border-t pt-2 text-xs text-muted-foreground">
                      {r.qualification_reason && (
                        <p>
                          <span className="font-medium text-foreground">
                            Por que é um bom lead:{" "}
                          </span>
                          {r.qualification_reason}
                        </p>
                      )}
                      {r.product_match_reason && (
                        <p>
                          <span className="font-medium text-foreground">
                            Produto do catálogo:{" "}
                          </span>
                          {r.product_match_reason}
                        </p>
                      )}
                      {r.whatsapp_evidence && (
                        <p>
                          <span className="font-medium text-foreground">
                            Evidência de WhatsApp:{" "}
                          </span>
                          {r.whatsapp_evidence}
                        </p>
                      )}
                      {r.evidence?.length > 0 && (
                        <div>
                          <span className="font-medium text-foreground">
                            Evidências:
                          </span>
                          <ul className="ml-4 list-disc">
                            {r.evidence.map((e, i) => (
                              <li key={i}>{e}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {(r.business_type || r.result_type) && (
                        <p>
                          <span className="font-medium text-foreground">
                            Classificação:{" "}
                          </span>
                          {r.result_type ?? "—"}
                          {r.business_type ? ` · ${r.business_type}` : ""}
                        </p>
                      )}
                      {r.description && (
                        <p>
                          <span className="font-medium text-foreground">
                            Descrição:{" "}
                          </span>
                          {r.description}
                        </p>
                      )}
                      {r.recommended_approach && (
                        <p>
                          <span className="font-medium text-foreground">
                            Abordagem sugerida:{" "}
                          </span>
                          {r.recommended_approach}
                        </p>
                      )}
                      <p>
                        <span className="font-medium text-foreground">Origem: </span>
                        {r.source}
                        {r.source_url && (
                          <>
                            {" · "}
                            <a
                              href={r.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-0.5 hover:text-foreground"
                            >
                              abrir fonte <ExternalLink className="size-3" />
                            </a>
                          </>
                        )}
                      </p>
                      {r.discovery_query && (
                        <p>
                          <span className="font-medium text-foreground">
                            Consulta:{" "}
                          </span>
                          “{r.discovery_query}”
                        </p>
                      )}
                      <p>
                        <span className="font-medium text-foreground">
                          Descoberto em:{" "}
                        </span>
                        {new Date(r.discovered_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum lead para este filtro.
          </p>
        )}
      </div>
    </div>
  );
}
