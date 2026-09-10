"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface ProspeccaoPanelProps {
  defaults: {
    segment: string;
    regions: string;
    quantity: number;
    catalogPdfId: string;
    message: string;
  };
  catalogs: { id: string; label: string }[];
}

export function ProspeccaoPanel({ defaults, catalogs }: ProspeccaoPanelProps) {
  const router = useRouter();
  const [segment, setSegment] = useState(defaults.segment);
  const [regions, setRegions] = useState(defaults.regions);
  const [quantity, setQuantity] = useState(String(defaults.quantity || 100));
  const [catalogPdfId, setCatalogPdfId] = useState(defaults.catalogPdfId);
  const [message, setMessage] = useState(defaults.message);

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<
    { kind: "ok" | "err"; text: string } | null
  >(null);

  async function run() {
    if (!segment.trim() || !regions.trim()) {
      setFeedback({ kind: "err", text: "Preencha o segmento e a região." });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const save = await fetch("/api/prospeccao", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          segment,
          regions,
          quantity: Number(quantity),
          catalogPdfId: catalogPdfId || null,
          message,
        }),
      });
      const saved = await save.json();
      if (!save.ok) throw new Error(saved.error || "não foi possível salvar");

      const res = await fetch(
        `/api/campaigns/${saved.campaignId}/discover`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "a pesquisa falhou");

      const found = data.found ?? 0;
      const enqueued = data.automatic?.enqueued ?? 0;
      const scaleActive = data.scale?.status === "active";
      setFeedback({
        kind: "ok",
        text:
          `Pesquisa concluída: ${found} contato(s) elegíveis, ` +
          `${enqueued} entraram na fila de abordagem.` +
          (scaleActive
            ? " A busca continua em segundo plano até completar a quantidade."
            : ""),
      });
      router.refresh();
    } catch (e) {
      setFeedback({
        kind: "err",
        text: e instanceof Error ? e.message : "erro inesperado",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="segment">Segmento</Label>
          <Input
            id="segment"
            value={segment}
            onChange={(e) => setSegment(e.target.value)}
            placeholder="Confeitarias, pet shops, academias…"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="regions">Região</Label>
          <Input
            id="regions"
            value={regions}
            onChange={(e) => setRegions(e.target.value)}
            placeholder="Curitiba, São José dos Pinhais"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="quantity">Quantidade de contatos</Label>
          <Input
            id="quantity"
            type="number"
            min={10}
            max={2000}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="catalog">Catálogo</Label>
          <select
            id="catalog"
            value={catalogPdfId}
            onChange={(e) => setCatalogPdfId(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">— usar o padrão da empresa —</option>
            {catalogs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="message">Mensagem</Label>
        <Textarea
          id="message"
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Olá! Tudo bem? Somos da LumiLife…"
        />
        <p className="text-xs text-muted-foreground">
          A mensagem nunca cita o nome da empresa prospectada. Use{" "}
          <code>{"{{produto}}"}</code> para inserir o produto.
        </p>
      </div>

      <Button onClick={run} disabled={busy} className="w-full sm:w-auto">
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Rocket className="size-4" />
        )}
        {busy ? "Pesquisando e abordando…" : "Pesquisar e abordar"}
      </Button>

      {feedback && (
        <p
          className={
            feedback.kind === "ok"
              ? "text-sm text-emerald-600"
              : "text-sm text-destructive"
          }
        >
          {feedback.text}
        </p>
      )}
    </div>
  );
}
