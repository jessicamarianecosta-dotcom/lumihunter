"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function HunterPanel({ hasIcp }: { hasIcp: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/agents/hunter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 15, query: query || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Falha ao rodar o Hunter.");
      } else {
        setMsg(
          `Hunter encontrou ${data.found} empresas · ${data.inserted} novos leads adicionados.`,
        );
        router.refresh();
      }
    } catch {
      setMsg("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="size-4 text-accent" />
        Agente Hunter
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {hasIcp
          ? "Busca empresas com potencial de compra a partir do seu ICP e catálogo."
          : "Defina um Perfil de Cliente Ideal (ICP) para habilitar o Hunter."}
      </p>
      <div className="mt-3 flex gap-2">
        <Input
          placeholder="Refinar busca (opcional): ex. academias em Osasco"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={!hasIcp || loading}
        />
        <Button onClick={run} disabled={!hasIcp || loading}>
          {loading ? "Buscando…" : "Rodar"}
        </Button>
      </div>
      {msg && <p className="mt-2 text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}
