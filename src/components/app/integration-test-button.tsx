"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

interface TestResult {
  ok: boolean;
  message?: string;
  error?: string;
}

/** Botão genérico de "Testar conexão" para integrações que fazem uma checagem
 * real via API (não apenas confirmam que os campos foram preenchidos). */
export function IntegrationTestButton({ endpoint }: { endpoint: string }) {
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
              const res = await fetch(endpoint, { method: "POST" });
              setResult((await res.json()) as TestResult);
            } catch {
              setResult({
                ok: false,
                error: "Falha ao consultar o serviço. Verifique a chave e tente novamente.",
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
            ? `✓ ${result.message ?? "conectado com sucesso"}`
            : `✕ ${result.error ?? "Não foi possível conectar."}`}
        </p>
      )}
    </div>
  );
}
