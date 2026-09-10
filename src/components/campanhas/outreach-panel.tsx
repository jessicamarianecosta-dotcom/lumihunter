"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Play,
  Pause,
  Sparkles,
  Loader2,
  Check,
  RefreshCw,
  Trash2,
  Send,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface QueueRow {
  id: string;
  lead_id: string;
  lead_name: string | null;
  whatsapp: string | null;
  buyer_fit: number | null;
  product_fit: number | null;
  status: string;
  message_body: string | null;
  personalized_by: string | null;
  catalog_included: boolean;
  failure_reason: string | null;
}

interface Props {
  campaignId: string;
  outreachStatus: string; // idle | running | paused
  minIntervalSeconds: number;
  dailyLimit: number;
  windowStart: string;
  windowEnd: string;
  catalogEnabled: boolean;
  catalogFilename: string | null;
  approvedTargets: number;
  withWhatsapp: number;
  rows: QueueRow[];
}

const STATUS_UI: Record<string, { label: string; variant: "success" | "warning" | "danger" | "secondary" | "default" }> = {
  draft: { label: "Rascunho", variant: "secondary" },
  ready: { label: "Na fila", variant: "warning" },
  scheduled: { label: "Programado", variant: "warning" },
  sending: { label: "Enviando", variant: "default" },
  sent: { label: "Enviado", variant: "success" },
  delivered: { label: "Entregue", variant: "success" },
  read: { label: "Lido", variant: "success" },
  replied: { label: "Respondeu", variant: "default" },
  failed: { label: "Falhou", variant: "danger" },
  opted_out: { label: "Opt-out", variant: "danger" },
  skipped: { label: "Pulado", variant: "secondary" },
  cancelled: { label: "Removido", variant: "secondary" },
};

export function OutreachPanel(p: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [confirmStart, setConfirmStart] = useState(false);
  const running = p.outreachStatus === "running";
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const drafts = p.rows.filter((r) => r.status === "draft");
  const ready = p.rows.filter((r) => r.status === "ready" || r.status === "scheduled");
  const stuck = p.rows.filter((r) => r.status === "skipped");

  const call = useCallback(
    async (path: string, body?: unknown) => {
      const res = await fetch(`/api/campaigns/${p.campaignId}/outreach/${path}`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      return { ok: res.ok, data: await res.json().catch(() => ({})) };
    },
    [p.campaignId],
  );

  // polling enquanto a prospecção está ativa
  useEffect(() => {
    if (!running) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    const interval = Math.max(8, p.minIntervalSeconds) * 1000;
    pollRef.current = setInterval(async () => {
      const { data } = await call("tick");
      if (data?.kind === "sent" || data?.kind === "failed" || data?.kind === "skipped") {
        router.refresh();
      }
      if (["paused", "limit_reached", "empty"].includes(data?.kind)) {
        router.refresh();
      }
    }, interval);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [running, p.minIntervalSeconds, call, router]);

  async function generate() {
    setBusy("generate");
    setMsg(null);
    const { ok, data } = await call("prepare");
    setBusy(null);
    setMsg(
      ok
        ? `${data.prepared ?? 0} mensagens preparadas${data.aiUsed ? " (com IA)" : ""}${data.catalog ? ` · catálogo: ${data.catalog}` : ""}.`
        : data.error ?? "Falha ao gerar mensagens.",
    );
    router.refresh();
  }

  async function reprocess() {
    setBusy("reprocess");
    setMsg(null);
    const { ok, data } = await call("reprocess");
    setBusy(null);
    setMsg(
      ok
        ? `${data.deletedSkipped ?? 0} travados reprocessados · ${data.enqueued ?? 0} entraram na fila` +
            (data.stillSkipped
              ? ` · ${data.stillSkipped} ainda barrados (${Object.entries(
                  data.stillSkippedReasons ?? {},
                )
                  .map(([r, n]) => `${r}: ${n}`)
                  .join(", ")})`
              : "")
        : data.error ?? "Falha ao reprocessar.",
    );
    router.refresh();
  }

  async function approveAll() {
    setBusy("approve");
    const { ok, data } = await call("approve", { all: true });
    setBusy(null);
    setMsg(ok ? `${data.approved ?? 0} mensagens aprovadas para envio.` : data.error);
    router.refresh();
  }

  async function control(action: "start" | "pause") {
    setBusy(action);
    const { ok, data } = await call("control", { action });
    setBusy(null);
    setConfirmStart(false);
    if (!ok) setMsg(data.error ?? "Falha.");
    router.refresh();
  }

  async function item(queueId: string, action: string, messageBody?: string) {
    setBusy(queueId + action);
    const { ok, data } = await call("item", { queueId, action, messageBody });
    setBusy(null);
    if (action === "regenerate" && ok && data.message) {
      setEditing((e) => ({ ...e, [queueId]: data.message }));
    }
    if (!ok) setMsg(data.error ?? "Falha.");
    if (action !== "regenerate") router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* passo 3 */}
      <div className="space-y-2">
        <p className="text-sm font-medium">3. Preparar abordagem</p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            {p.approvedTargets} aprovados · {p.withWhatsapp} com WhatsApp ·{" "}
            {p.rows.length} na fila
          </span>
          {p.catalogEnabled && (
            <Badge variant={p.catalogFilename ? "success" : "danger"}>
              {p.catalogFilename
                ? `Catálogo: ${p.catalogFilename}`
                : "Catálogo ativado, mas nenhum PDF disponível"}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={generate} disabled={busy !== null}>
            {busy === "generate" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Gerar mensagens personalizadas
          </Button>
          {drafts.length > 0 && (
            <Button size="sm" variant="outline" onClick={approveAll} disabled={busy !== null}>
              <Check className="size-4" /> Aprovar {drafts.length} mensagens
            </Button>
          )}
          {stuck.length > 0 && (
            <Button size="sm" variant="outline" onClick={reprocess} disabled={busy !== null}>
              {busy === "reprocess" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Reprocessar {stuck.length} travados
            </Button>
          )}
        </div>
      </div>

      {/* passo 4 */}
      <div className="space-y-2 border-t pt-3">
        <p className="text-sm font-medium">4. Fila de WhatsApp</p>
        <p className="text-xs text-muted-foreground">
          Limite {p.dailyLimit}/dia · {p.windowStart}–{p.windowEnd} · intervalo{" "}
          {p.minIntervalSeconds}s. Sem tentativas de burlar limites — envio
          controlado pela API oficial.
        </p>

        {p.outreachStatus === "running" ? (
          <div className="flex items-center gap-2">
            <Badge variant="default">
              <Loader2 className="mr-1 inline size-3 animate-spin" /> Prospecção ativa
            </Badge>
            <Button size="sm" variant="outline" onClick={() => control("pause")} disabled={busy !== null}>
              <Pause className="size-4" /> Pausar
            </Button>
          </div>
        ) : confirmStart ? (
          <div className="rounded-lg border bg-card p-3 text-sm">
            <p className="font-medium">Você está prestes a iniciar a prospecção pelo WhatsApp.</p>
            <ul className="mt-1 text-xs text-muted-foreground">
              <li>Mensagens aprovadas na fila: {ready.length}</li>
              <li>Limite diário: {p.dailyLimit}</li>
              <li>Horário: {p.windowStart}–{p.windowEnd}</li>
              <li>Intervalo: {p.minIntervalSeconds}s</li>
              <li>Catálogo: {p.catalogEnabled ? (p.catalogFilename ?? "indisponível") : "desativado"}</li>
            </ul>
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => control("start")} disabled={busy !== null}>
                {busy === "start" ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                Iniciar prospecção
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmStart(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button
            size="sm"
            onClick={() => setConfirmStart(true)}
            disabled={ready.length === 0 || busy !== null}
          >
            <Play className="size-4" />
            {p.outreachStatus === "paused" ? "Retomar prospecção" : "Iniciar prospecção"}
          </Button>
        )}
      </div>

      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}

      {/* prévia / fila */}
      {p.rows.length > 0 && (
        <div className="space-y-2 border-t pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Prévia das mensagens
          </p>
          <div className="grid gap-2">
            {p.rows.map((r) => {
              const ui = STATUS_UI[r.status] ?? { label: r.status, variant: "secondary" as const };
              const value = editing[r.id] ?? r.message_body ?? "";
              const canEdit = ["draft", "ready", "scheduled", "failed"].includes(r.status);
              return (
                <div key={r.id} className="rounded-lg border bg-card p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.lead_name ?? "—"}</span>
                    <Badge variant={ui.variant}>{ui.label}</Badge>
                    {r.whatsapp && (
                      <span className="text-xs text-muted-foreground">{r.whatsapp}</span>
                    )}
                    {(r.buyer_fit != null || r.product_fit != null) && (
                      <span className="text-[11px] text-muted-foreground">
                        buyer {r.buyer_fit ?? "—"} · produto {r.product_fit ?? "—"}
                      </span>
                    )}
                    {r.catalog_included && (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                        ✓ catálogo
                      </span>
                    )}
                    {r.personalized_by && (
                      <span className="text-[10px] uppercase text-muted-foreground">
                        {r.personalized_by}
                      </span>
                    )}
                  </div>

                  {canEdit ? (
                    <textarea
                      className="mt-2 w-full rounded-md border border-input bg-background p-2 text-xs"
                      rows={4}
                      value={value}
                      onChange={(e) =>
                        setEditing((prev) => ({ ...prev, [r.id]: e.target.value }))
                      }
                    />
                  ) : (
                    <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
                      {r.message_body}
                    </p>
                  )}
                  {r.failure_reason && (
                    <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">
                      ⚠ {r.failure_reason}
                    </p>
                  )}

                  {canEdit && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {editing[r.id] !== undefined &&
                        editing[r.id] !== (r.message_body ?? "") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => item(r.id, "edit", editing[r.id])}
                            disabled={busy !== null}
                          >
                            <Pencil className="size-3.5" /> Salvar
                          </Button>
                        )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => item(r.id, "regenerate")}
                        disabled={busy !== null}
                      >
                        {busy === r.id + "regenerate" ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="size-3.5" />
                        )}
                        Regenerar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => item(r.id, "send_now")}
                        disabled={busy !== null}
                      >
                        <Send className="size-3.5" /> Enviar agora
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => item(r.id, "remove")}
                        disabled={busy !== null}
                      >
                        <Trash2 className="size-3.5" /> Remover
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
