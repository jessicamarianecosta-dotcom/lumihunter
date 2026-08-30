"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CLASSIFICATION_LABELS,
  type SalesCoachResult,
} from "@/lib/anthropic/agents/sales-coach";

interface Msg {
  id: string;
  direction: "inbound" | "outbound";
  body: string | null;
  channel: string;
  status: string;
  created_at: string;
}

export function ConversationThread({
  conversationId,
  leadId,
  channel,
  messages,
}: {
  conversationId: string;
  leadId: string;
  channel: "whatsapp" | "email";
  messages: Msg[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<"idle" | "coach" | "send">("idle");
  const [coach, setCoach] = useState<SalesCoachResult | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function suggest() {
    setBusy("coach");
    setNote(null);
    const res = await fetch("/api/agents/sales-coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId }),
    });
    const data = await res.json();
    if (res.ok) {
      setCoach(data as SalesCoachResult);
      if (data.suggested_replies?.[0]) setDraft(data.suggested_replies[0]);
    } else setNote(data.error ?? "Falha");
    setBusy("idle");
    router.refresh();
  }

  async function send() {
    if (!draft.trim()) return;
    setBusy("send");
    setNote(null);
    const res = await fetch("/api/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId, channel, body: draft }),
    });
    const data = await res.json();
    setNote(
      res.ok
        ? data.simulated
          ? "Enviado (modo simulação — configure as credenciais)."
          : "Mensagem enviada."
        : data.error,
    );
    if (res.ok) {
      setDraft("");
      router.refresh();
    }
    setBusy("idle");
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] rounded-lg border p-3 text-sm ${
              m.direction === "outbound"
                ? "ml-auto bg-primary/10"
                : "bg-card"
            }`}
          >
            <p className="whitespace-pre-wrap">{m.body}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {m.direction === "outbound" ? "Enviado" : "Recebido"} ·{" "}
              {new Date(m.created_at).toLocaleString("pt-BR")} · {m.status}
            </p>
          </div>
        ))}
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma mensagem ainda. Escreva a primeira abaixo.
          </p>
        )}
      </div>

      {coach && (
        <Card className="border-accent/40 bg-accent/5">
          <CardContent className="space-y-2 p-4 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <Sparkles className="size-4 text-accent" />
              Sales Coach
              <Badge variant="outline">
                {CLASSIFICATION_LABELS[coach.classification]}
              </Badge>
            </p>
            <p className="text-muted-foreground">{coach.summary}</p>
            <p className="text-xs">
              <strong>Próximo passo:</strong> {coach.next_step}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {coach.suggested_replies.map((r, i) => (
                <Button
                  key={i}
                  size="sm"
                  variant="secondary"
                  onClick={() => setDraft(r)}
                >
                  Usar resposta {i + 1}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          placeholder={`Responder por ${channel}…`}
        />
        <div className="flex flex-wrap gap-2">
          <Button onClick={send} disabled={busy !== "idle" || !draft.trim()}>
            <Send className="size-4" />
            {busy === "send" ? "Enviando…" : `Enviar por ${channel}`}
          </Button>
          <Button variant="outline" onClick={suggest} disabled={busy !== "idle"}>
            <Sparkles className="size-4" />
            {busy === "coach" ? "Analisando…" : "Sugerir resposta (IA)"}
          </Button>
        </div>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </div>
    </div>
  );
}
