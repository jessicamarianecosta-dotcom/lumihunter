"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Wand2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { CopyOutput } from "@/lib/anthropic/agents/copywriter";

export function LeadAiActions({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [copy, setCopy] = useState<CopyOutput | null>(null);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState<string | null>(null);

  async function qualify() {
    setBusy("qualify");
    setNote(null);
    const res = await fetch("/api/agents/qualifier", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId }),
    });
    const data = await res.json();
    setNote(res.ok ? `Score ${data.score}: ${data.reason}` : data.error);
    setBusy(null);
    router.refresh();
  }

  async function generate(kind: string) {
    setBusy("copy");
    setNote(null);
    const res = await fetch("/api/agents/copywriter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId, kind }),
    });
    const data = await res.json();
    if (res.ok) {
      setCopy(data as CopyOutput);
      setDraft((data as CopyOutput).whatsapp);
    } else setNote(data.error);
    setBusy(null);
  }

  async function send(channel: "whatsapp" | "email") {
    setBusy("send");
    setNote(null);
    const res = await fetch("/api/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId,
        channel,
        body: channel === "email" ? copy?.email.body ?? draft : draft,
        subject: copy?.email.subject,
      }),
    });
    const data = await res.json();
    setNote(
      res.ok
        ? data.simulated
          ? "Enviado (modo simulação — configure as credenciais)."
          : "Mensagem enviada."
        : data.error,
    );
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="size-4 text-accent" />
        Agentes de IA
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={qualify} disabled={!!busy}>
          {busy === "qualify" ? "Analisando…" : "Qualificar (score)"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => generate("first_touch")}
          disabled={!!busy}
        >
          <Wand2 className="size-3.5" />
          {busy === "copy" ? "Gerando…" : "Gerar 1ª abordagem"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => generate("followup")}
          disabled={!!busy}
        >
          Gerar follow-up
        </Button>
      </div>

      {copy && (
        <div className="space-y-2 text-sm">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
          />
          <div className="rounded-lg bg-secondary p-3 text-xs">
            <p className="font-medium">E-mail — {copy.email.subject}</p>
            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
              {copy.email.body}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => send("whatsapp")} disabled={!!busy}>
              <Send className="size-3.5" />
              Enviar WhatsApp
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => send("email")}
              disabled={!!busy}
            >
              Enviar e-mail
            </Button>
          </div>
        </div>
      )}

      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
