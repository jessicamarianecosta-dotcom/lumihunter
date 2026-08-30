"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DispatchButton({
  campaignId,
  pending,
}: {
  campaignId: string;
  pending: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setMsg(null);
    const res = await fetch(`/api/campaigns/${campaignId}/dispatch`, {
      method: "POST",
    });
    const data = await res.json();
    if (res.ok) {
      setMsg(
        `${data.sent} enviados${data.skipped ? `, ${data.skipped} pulados` : ""}${
          data.simulated ? " (modo simulação)" : ""
        }. Restam ${data.remaining}.`,
      );
      router.refresh();
    } else setMsg(data.error ?? "Falha ao disparar.");
    setLoading(false);
  }

  return (
    <div className="space-y-2">
      <Button onClick={run} disabled={loading || pending === 0}>
        <Send className="size-4" />
        {loading
          ? "Disparando…"
          : pending === 0
            ? "Nada pendente"
            : `Disparar próximos ${Math.min(pending, 10)}`}
      </Button>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
      <p className="text-[11px] text-muted-foreground">
        Cada disparo gera a mensagem com o Copywriter e envia pelo canal da
        campanha (ou registra em simulação). Blacklist e opt-out são respeitados.
      </p>
    </div>
  );
}
