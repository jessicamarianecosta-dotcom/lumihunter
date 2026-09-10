"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

interface TemplateInfo {
  name: string;
  status: string;
  category: string;
  language: string;
}

interface ListResponse {
  ok?: boolean;
  error?: string;
  templates?: TemplateInfo[];
  prospeccao?: TemplateInfo | null;
  linked?: boolean;
}

const STATUS_PT: Record<string, string> = {
  APPROVED: "aprovado ✓",
  PENDING: "em análise pela Meta…",
  REJECTED: "reprovado pela Meta",
  PAUSED: "pausado",
  DISABLED: "desativado",
};

/**
 * Gestão do template de prospecção (obrigatório pela Meta para abordagem fria).
 * Mostra o status, cria/reenvia e vincula automaticamente à campanha quando
 * aprovado.
 */
export function WhatsAppTemplateManager() {
  const [pending, start] = useTransition();
  const [data, setData] = useState<ListResponse | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = () =>
    start(async () => {
      setMsg(null);
      try {
        const res = await fetch("/api/whatsapp/templates");
        setData((await res.json()) as ListResponse);
      } catch {
        setData({ ok: false, error: "Falha ao consultar os templates." });
      }
    });

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = () =>
    start(async () => {
      setMsg(null);
      try {
        const res = await fetch("/api/whatsapp/templates", { method: "POST" });
        const j = (await res.json()) as { ok?: boolean; error?: string; status?: string };
        setMsg(
          j.ok
            ? `Template enviado para a Meta (${j.status ?? "PENDING"}). A aprovação costuma sair em minutos a algumas horas.`
            : `Não foi possível criar: ${j.error ?? "erro"}`,
        );
        load();
      } catch {
        setMsg("Falha ao criar o template.");
      }
    });

  const p = data?.prospeccao ?? null;

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <p className="text-sm font-medium">Template de prospecção (WhatsApp)</p>
      <p className="text-xs text-muted-foreground">
        A Meta exige um template aprovado para a primeira mensagem a um contato
        novo. Assim que aprovado, o LumiHunter passa a usá-lo automaticamente na
        abordagem.
      </p>

      {data?.error && (
        <p className="text-xs text-destructive">✕ {data.error}</p>
      )}

      {data && !data.error && (
        <p className="text-xs">
          Status:{" "}
          <span
            className={
              p?.status === "APPROVED"
                ? "text-emerald-600"
                : p?.status === "REJECTED"
                  ? "text-destructive"
                  : "text-muted-foreground"
            }
          >
            {p ? (STATUS_PT[p.status] ?? p.status) : "ainda não criado"}
          </span>
          {data.linked && " — vinculado à campanha"}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={load}
        >
          {pending ? "…" : "Atualizar status"}
        </Button>
        {(!p || p.status === "REJECTED") && (
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={create}
          >
            Criar template de prospecção
          </Button>
        )}
      </div>

      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}
