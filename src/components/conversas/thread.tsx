"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Send, Paperclip, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import {
  classifyAttachment,
  IMAGE_MIME_TYPES,
  WEBP_MIME_TYPE,
  DOCUMENT_MIME_TYPES,
} from "@/lib/whatsapp/media-limits";
import {
  CLASSIFICATION_LABELS,
  type SalesCoachResult,
} from "@/lib/anthropic/agents/sales-coach";

interface Attachment {
  kind: string;
  path: string;
  filename: string;
  mimeType: string;
  url: string | null;
}

interface Msg {
  id: string;
  direction: "inbound" | "outbound";
  body: string | null;
  channel: string;
  status: string;
  error: string | null;
  attachments: Attachment[];
  created_at: string;
}

const MSG_STATUS_LABEL: Record<string, string> = {
  queued: "🟡 na fila",
  sent: "✓ enviado",
  delivered: "✓✓ entregue",
  read: "✓✓ lido",
  failed: "🔴 falhou",
  bounced: "🔴 falhou",
  received: "recebido",
};

const ACCEPT = [...IMAGE_MIME_TYPES, WEBP_MIME_TYPE, ...DOCUMENT_MIME_TYPES].join(",");

export function ConversationThread({
  conversationId,
  leadId,
  companyId,
  channel,
  messages,
}: {
  conversationId: string;
  leadId: string;
  companyId: string;
  channel: "whatsapp" | "email";
  messages: Msg[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
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

  function pickFile(f: File | undefined) {
    if (!f) return;
    const media = classifyAttachment(f.type);
    if (!media) {
      setNote(`Tipo de arquivo não suportado: ${f.type || "desconhecido"}.`);
      return;
    }
    if (f.size > media.maxBytes) {
      setNote(
        `Arquivo muito grande (${(f.size / 1024 / 1024).toFixed(1)} MB) — limite de ${(media.maxBytes / 1024 / 1024).toFixed(0)} MB.`,
      );
      return;
    }
    setNote(null);
    setFile(f);
    setFilePreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  }

  function clearFile() {
    setFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function send() {
    if (!draft.trim() && !file) return;
    setBusy("send");
    setNote(null);

    if (file) {
      const media = classifyAttachment(file.type)!;
      try {
        const supabase = createClient();
        const ext = file.name.split(".").pop() || "bin";
        const path = `${companyId}/conversas/${leadId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("attachments")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) {
          setNote(`Falha ao enviar o arquivo: ${upErr.message}`);
          setBusy("idle");
          return;
        }
        const res = await fetch("/api/messages/send-attachment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leadId,
            path,
            filename: file.name,
            mimeType: file.type,
            size: file.size,
            caption: draft.trim() || undefined,
          }),
        });
        const data = await res.json();
        setNote(
          res.ok
            ? data.simulated
              ? "Enviado (modo simulação — configure as credenciais)."
              : `${media.kind === "image" ? "Imagem" : "Documento"} enviado.`
            : data.error,
        );
        if (res.ok) {
          setDraft("");
          clearFile();
          router.refresh();
        }
      } catch (e) {
        setNote(`Erro de rede: ${e instanceof Error ? e.message : "falha ao enviar"}.`);
      }
      setBusy("idle");
      return;
    }

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
            {m.attachments?.map((a, i) =>
              a.kind === "image" && a.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={a.url}
                  alt={a.filename}
                  className="mb-2 max-h-64 rounded-md border object-contain"
                />
              ) : (
                <a
                  key={i}
                  href={a.url ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-2 flex items-center gap-2 rounded-md border bg-background/60 p-2 text-xs hover:underline"
                >
                  <FileText className="size-4 shrink-0" />
                  <span className="truncate">{a.filename}</span>
                </a>
              ),
            )}
            {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
            <p className="mt-1 text-[11px] text-muted-foreground">
              {new Date(m.created_at).toLocaleString("pt-BR")}
              {m.direction === "outbound"
                ? ` · ${MSG_STATUS_LABEL[m.status] ?? m.status}`
                : ""}
            </p>
            {m.status === "failed" && m.error && (
              <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">
                ⚠ Não foi possível enviar: {m.error}
              </p>
            )}
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
        {file && (
          <div className="flex items-center gap-2 rounded-md border bg-card p-2 text-xs">
            {filePreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={filePreview} alt={file.name} className="size-10 rounded object-cover" />
            ) : (
              <FileText className="size-5 text-muted-foreground" />
            )}
            <span className="min-w-0 flex-1 truncate">{file.name}</span>
            <Button size="icon" variant="ghost" onClick={clearFile} aria-label="Remover anexo">
              <X className="size-3.5" />
            </Button>
          </div>
        )}
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          placeholder={
            channel === "whatsapp"
              ? file
                ? "Legenda (opcional)…"
                : "Responder por whatsapp…"
              : `Responder por ${channel}…`
          }
        />
        <div className="flex flex-wrap gap-2">
          <Button onClick={send} disabled={busy !== "idle" || (!draft.trim() && !file)}>
            <Send className="size-4" />
            {busy === "send" ? "Enviando…" : `Enviar por ${channel}`}
          </Button>
          {channel === "whatsapp" && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy !== "idle"}
              >
                <Paperclip className="size-4" />
                Anexar
              </Button>
            </>
          )}
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

