"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  campaignId: string;
  regions: string[];
  /** true quando a campanha já tem produto + público + região. */
  ready: boolean;
  configured: boolean;
}

export function DiscoveryPanel({ campaignId, regions, ready, configured }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  async function run() {
    setLoading(true);
    setResult(null);
    setError(null);
    const regionLabel = regions.slice(0, 2).join(", ") || "sua região";
    setProgress("Preparando busca…");
    timers.current.push(
      setTimeout(() => setProgress(`Procurando empresas em ${regionLabel}…`), 1200),
      setTimeout(() => setProgress("Analisando resultados…"), 6000),
      setTimeout(() => setProgress("Qualificando empresas encontradas…"), 14000),
    );

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/discover`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      timers.current.forEach(clearTimeout);
      timers.current = [];
      setProgress(null);

      if (!res.ok) {
        setError(
          data.error ??
            "Não foi possível realizar a busca. Tente novamente em instantes.",
        );
      } else if (data.found === 0 && data.inserted === 0) {
        setResult(
          `A busca rodou (${data.queries} consultas, ${data.rawResults} resultados) mas nenhuma empresa nova foi encontrada. Ajuste o público ou a região e tente de novo.`,
        );
        router.refresh();
      } else {
        setResult(
          `Encontramos ${data.found} possíveis ${
            data.found === 1 ? "empresa" : "empresas"
          } · ${data.inserted} novas adicionadas · ${data.qualified} com bom potencial${
            data.aiUsed ? " · qualificação com IA" : ""
          }.`,
        );
        router.refresh();
      }
    } catch {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      setProgress(null);
      setError("Erro de rede ao contatar o servidor. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-medium">1. Encontrar potenciais clientes</p>
        <p className="text-[13px] text-muted-foreground">
          O LumiHunter procura empresas reais que correspondem ao produto, ao
          público e à região desta campanha.
        </p>
      </div>

      {!configured && (
        <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          A busca de leads não está disponível: a chave do Tavily
          (TAVILY_API_KEY) não está configurada no servidor.
        </p>
      )}
      {configured && !ready && (
        <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          Preencha o produto/serviço, o público-alvo e a região da campanha
          (abaixo) para habilitar a busca.
        </p>
      )}

      <Button onClick={run} disabled={loading || !ready || !configured}>
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Search className="size-4" />
        )}
        {loading ? "Procurando…" : "🔎 Procurar possíveis leads"}
      </Button>

      {progress && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" /> {progress}
        </p>
      )}
      {result && <p className="text-xs text-foreground">{result}</p>}
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
