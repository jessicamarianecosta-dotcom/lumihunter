"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

interface TestResult {
  ok: boolean;
  provider?: "anthropic" | "openai";
  model?: string;
  error?: string;
}

export function AiTestConnectionButton() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<TestResult | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setResult(null);
            try {
              const res = await fetch("/api/agents/ai/test", { method: "POST" });
              setResult((await res.json()) as TestResult);
            } catch {
              setResult({
                ok: false,
                error:
                  "Falha ao consultar o provedor de IA. Verifique a chave e tente novamente.",
              });
            }
          })
        }
      >
        {pending ? "Testando…" : "Testar conexão"}
      </Button>
      {result && (
        <p
          className={
            result.ok ? "text-xs text-emerald-600" : "text-xs text-destructive"
          }
        >
          {result.ok
            ? `✓ ${result.provider === "openai" ? "OpenAI" : "Anthropic"} conectada com sucesso · modelo ${result.model}`
            : `✕ ${result.error ?? "Não foi possível conectar."}`}
        </p>
      )}
    </div>
  );
}
