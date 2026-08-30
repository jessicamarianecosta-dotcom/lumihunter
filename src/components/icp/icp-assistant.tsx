"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { IcpSuggestion } from "@/lib/anthropic/agents/icp-assistant";

export function IcpAssistant({ hasProducts }: { hasProducts: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"idle" | "suggest" | "apply">("idle");
  const [sug, setSug] = useState<IcpSuggestion | null>(null);
  const [demo, setDemo] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function call(apply: boolean) {
    setLoading(apply ? "apply" : "suggest");
    setErr(null);
    try {
      const res = await fetch("/api/agents/icp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Falha ao gerar sugestão.");
      } else if (apply) {
        router.refresh();
        setSug(null);
      } else {
        setSug(data.suggestion);
        setDemo(!!data.demo);
      }
    } catch {
      setErr("Erro de rede.");
    } finally {
      setLoading("idle");
    }
  }

  return (
    <Card className="border-accent/40 bg-accent/5">
      <CardContent className="p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Wand2 className="size-4 text-accent" />
          Não sabe definir o cliente ideal? Deixe a IA montar
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          A partir do ramo e da cidade da sua empresa, o Estrategista sugere
          regiões, segmentos, porte e palavras-chave
          {!hasProducts && " — e também os produtos típicos do seu ramo"}.
        </p>

        {!sug && (
          <Button
            className="mt-3"
            size="sm"
            onClick={() => call(false)}
            disabled={loading !== "idle"}
          >
            <Sparkles className="size-3.5" />
            {loading === "suggest" ? "Analisando…" : "Sugerir com IA"}
          </Button>
        )}
        {err && <p className="mt-2 text-xs text-destructive">{err}</p>}

        {sug && (
          <div className="mt-3 space-y-3 rounded-lg border bg-card p-3 text-sm">
            {demo && (
              <Badge variant="warning" className="mb-1">
                modo demo
              </Badge>
            )}
            <p className="font-medium">{sug.name}</p>
            <p className="text-muted-foreground">{sug.description}</p>
            <p className="text-xs italic text-muted-foreground">
              💡 {sug.reasoning}
            </p>
            <Field label="Estados" values={sug.states} />
            <Field label="Cidades" values={sug.cities} />
            <Field label="Regiões" values={sug.regions} />
            <Field label="Segmentos de clientes" values={sug.segments} />
            <Field label="Porte" values={sug.company_sizes} />
            <Field label="Palavras-chave" values={sug.keywords} />
            {sug.suggested_products?.length > 0 && (
              <div>
                <p className="text-xs font-medium">Produtos sugeridos</p>
                <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
                  {sug.suggested_products.map((p) => (
                    <li key={p.name}>
                      <strong>{p.name}</strong> — {p.description}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                size="sm"
                onClick={() => call(true)}
                disabled={loading !== "idle"}
              >
                {loading === "apply" ? "Criando…" : "Aplicar (criar ICP)"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSug(null)}
                disabled={loading !== "idle"}
              >
                Descartar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => call(false)}
                disabled={loading !== "idle"}
              >
                Gerar outra
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, values }: { label: string; values: string[] }) {
  if (!values?.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      <span className="text-xs font-medium">{label}:</span>
      {values.map((v) => (
        <Badge key={v} variant="secondary">
          {v}
        </Badge>
      ))}
    </div>
  );
}
