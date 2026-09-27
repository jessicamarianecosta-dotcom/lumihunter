"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface SweepSummary {
  id: string;
  name: string;
  ddd: string;
  quantity_target: number;
  sent_count: number;
  attempted_count: number;
  invalid_count: number;
  skipped_count: number;
  failed_count: number;
  status: string;
  interval_seconds: number;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "rascunho",
  running: "enviando",
  paused: "pausada",
  completed: "concluída",
};

export function SweepPanel({
  sweeps,
  catalogs,
}: {
  sweeps: SweepSummary[];
  catalogs: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [ddd, setDdd] = useState("41");
  const [startNumber, setStartNumber] = useState("991111111");
  const [quantityTarget, setQuantityTarget] = useState("100");
  const [intervalSeconds, setIntervalSeconds] = useState("30");
  const [catalogPdfId, setCatalogPdfId] = useState("");
  const [templatesText, setTemplatesText] = useState(
    "Oi, tudo bem?\nOlá, tudo bem?\nBom dia! Tudo bem?\nBoa tarde! Tudo bem?",
  );
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function create() {
    const messageTemplates = templatesText
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);
    if (!name.trim() || messageTemplates.length === 0) {
      setFeedback({ kind: "err", text: "Preencha o nome e ao menos uma mensagem de abertura." });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/sweeps", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          ddd,
          startNumber,
          quantityTarget: Number(quantityTarget),
          intervalSeconds: Number(intervalSeconds),
          catalogPdfId: catalogPdfId || null,
          messageTemplates,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "não foi possível criar");
      await fetch(`/api/sweeps/${data.id}/control`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      setFeedback({ kind: "ok", text: "Lista criada e envio iniciado." });
      setName("");
      router.refresh();
    } catch (e) {
      setFeedback({ kind: "err", text: e instanceof Error ? e.message : "erro inesperado" });
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id: string, action: "start" | "pause") {
    await fetch(`/api/sweeps/${id}/control`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="sweep-name">Nome da lista</Label>
              <Input
                id="sweep-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Curitiba — DDD 41"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ddd">DDD</Label>
              <Input id="ddd" value={ddd} onChange={(e) => setDdd(e.target.value)} maxLength={2} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="start-number">Número inicial</Label>
              <Input
                id="start-number"
                value={startNumber}
                onChange={(e) => setStartNumber(e.target.value)}
                placeholder="991111111"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qty">Quantidade de envios efetivos</Label>
              <Input
                id="qty"
                type="number"
                min={1}
                max={5000}
                value={quantityTarget}
                onChange={(e) => setQuantityTarget(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Números inválidos não contam — o LumiHunter pula para o próximo automaticamente.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="interval">Intervalo entre envios (segundos)</Label>
              <Input
                id="interval"
                type="number"
                min={10}
                max={3600}
                value={intervalSeconds}
                onChange={(e) => setIntervalSeconds(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="catalog">Catálogo</Label>
              <select
                id="catalog"
                value={catalogPdfId}
                onChange={(e) => setCatalogPdfId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— sem catálogo —</option>
                {catalogs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="templates">Mensagens de abertura (uma por linha)</Label>
            <Textarea
              id="templates"
              rows={5}
              value={templatesText}
              onChange={(e) => setTemplatesText(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              O envio alterna entre as versões cadastradas, para não repetir sempre o mesmo texto.
            </p>
          </div>

          <Button onClick={create} disabled={busy} className="w-full sm:w-auto">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {busy ? "Criando…" : "Criar e iniciar envio"}
          </Button>

          {feedback && (
            <p className={feedback.kind === "ok" ? "text-sm text-emerald-600" : "text-sm text-destructive"}>
              {feedback.text}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {sweeps.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma lista criada ainda.</p>
        )}
        {sweeps.map((s) => (
          <Card key={s.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{s.name}</span>
                  <Badge variant={s.status === "running" ? "default" : "outline"}>
                    {STATUS_LABEL[s.status] ?? s.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {s.sent_count}/{s.quantity_target} enviados · {s.invalid_count} inválidos ·{" "}
                  {s.failed_count} falhas · DDD {s.ddd}
                </p>
              </div>
              {s.status === "running" ? (
                <Button variant="outline" size="sm" onClick={() => toggle(s.id, "pause")}>
                  <Pause className="size-4" /> Pausar
                </Button>
              ) : s.status !== "completed" ? (
                <Button variant="outline" size="sm" onClick={() => toggle(s.id, "start")}>
                  <Play className="size-4" /> Retomar
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
