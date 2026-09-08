"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { FileUp, X, Loader2, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ExtractedVariant {
  optionLabels: string[];
  price: number | null;
  priceKind: string;
  minQuantity: number | null;
}
interface ExtractedItem {
  name: string;
  category: string | null;
  kind: string;
  description: string | null;
  attributes: Record<string, unknown>;
  variants: ExtractedVariant[];
  confidence: "ok" | "review";
  notes: string | null;
}
interface Job {
  id: string;
  status: string;
  file_name: string | null;
  extracted_items: ExtractedItem[];
  extracted_count: number;
  review_count: number;
  error_message: string | null;
}

type Phase = "idle" | "uploading" | "review" | "applying" | "done" | "error";

export function PdfImportDialog({ hasExisting }: { hasExisting: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [approved, setApproved] = useState<Set<number>>(new Set());

  function reset() {
    setPhase("idle");
    setMsg(null);
    setJob(null);
    setApproved(new Set());
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onFile(file: File) {
    setPhase("uploading");
    setMsg("Enviando e processando o PDF… isso pode levar alguns segundos.");
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/catalog/pdf/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setPhase("error");
        setMsg(data.error ?? "Falha no upload.");
        return;
      }
      const jres = await fetch(`/api/catalog/pdf/jobs/${data.jobId}`);
      const jdata = await jres.json();
      const j: Job = jdata.job;
      setJob(j);
      if (j.status === "error") {
        setPhase("error");
        setMsg(j.error_message ?? "Falha ao processar o PDF.");
        return;
      }
      setApproved(
        new Set(
          (j.extracted_items ?? [])
            .map((it, i) => (it.confidence === "ok" ? i : -1))
            .filter((i) => i >= 0),
        ),
      );
      setPhase("review");
      setMsg(null);
    } catch {
      setPhase("error");
      setMsg("Erro de rede ao enviar o PDF.");
    }
  }

  async function apply() {
    if (!job) return;
    setPhase("applying");
    try {
      const res = await fetch(`/api/catalog/pdf/jobs/${job.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply", approved: [...approved] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPhase("error");
        setMsg(data.error ?? "Falha ao aplicar.");
        return;
      }
      setPhase("done");
      setMsg(`${data.created} produto(s) adicionado(s) ao catálogo.`);
      router.refresh();
    } catch {
      setPhase("error");
      setMsg("Erro de rede ao aplicar.");
    }
  }

  const items = job?.extracted_items ?? [];

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <Dialog.Trigger asChild>
        <Button size="sm" variant={hasExisting ? "outline" : "default"} className="gap-1.5">
          <FileUp className="size-3.5" />
          {hasExisting ? "Importar outro PDF" : "Importar catálogo PDF"}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          className={cn(
            "fixed z-50 flex max-h-[92vh] flex-col overflow-hidden bg-card shadow-2xl outline-none",
            "inset-x-0 bottom-0 rounded-t-2xl",
            "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[42rem] sm:max-w-[95vw] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border",
          )}
        >
          <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
            <Dialog.Title className="text-sm font-semibold">
              Importar catálogo PDF
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Fechar">
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Envie um PDF do catálogo para extrair produtos, preços e especificações.
          </Dialog.Description>

          <div className="flex-1 overflow-y-auto p-4">
            {(phase === "idle" || phase === "uploading" || phase === "error") && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  O sistema lê o PDF e tenta transformar o conteúdo em produtos,
                  variações e preços estruturados. Itens ambíguos ficam marcados
                  para você revisar antes de entrarem no catálogo.
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onFile(f);
                  }}
                />
                <Button
                  disabled={phase === "uploading"}
                  onClick={() => inputRef.current?.click()}
                  className="gap-1.5"
                >
                  {phase === "uploading" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <FileUp className="size-4" />
                  )}
                  {phase === "uploading" ? "Processando…" : "Escolher PDF"}
                </Button>
                {msg && (
                  <p
                    className={cn(
                      "text-xs",
                      phase === "error"
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {msg}
                  </p>
                )}
              </div>
            )}

            {(phase === "review" || phase === "applying") && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-medium">
                    {items.length} item(ns) extraído(s)
                  </span>
                  {job?.review_count ? (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="size-3" />
                      {job.review_count} para revisar
                    </span>
                  ) : null}
                  <span className="text-muted-foreground">
                    {approved.size} selecionado(s) para importar
                  </span>
                </div>

                <div className="divide-y rounded-lg border">
                  {items.map((it, i) => (
                    <label
                      key={i}
                      className="flex cursor-pointer items-start gap-3 p-3 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={approved.has(i)}
                        onChange={(e) => {
                          const next = new Set(approved);
                          if (e.target.checked) next.add(i);
                          else next.delete(i);
                          setApproved(next);
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{it.name}</span>
                          {it.confidence === "review" ? (
                            <span className="rounded bg-amber-500/15 px-1 text-[10px] text-amber-700 dark:text-amber-400">
                              revisar
                            </span>
                          ) : (
                            <Check className="size-3 text-emerald-600" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {[it.category, it.kind === "service" ? "serviço" : "produto"]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        {it.variants.map((v, vi) => (
                          <p key={vi} className="text-xs text-muted-foreground">
                            {(v.optionLabels.join(" · ") || "padrão")} →{" "}
                            {v.priceKind === "quote"
                              ? "sob orçamento"
                              : v.price != null
                                ? v.price.toLocaleString("pt-BR", {
                                    style: "currency",
                                    currency: "BRL",
                                  })
                                : "sem preço"}
                          </p>
                        ))}
                        {it.notes && (
                          <p className="text-xs text-amber-700 dark:text-amber-400">
                            {it.notes}
                          </p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
                {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
              </div>
            )}

            {phase === "done" && (
              <div className="space-y-2 py-6 text-center">
                <Check className="mx-auto size-8 text-emerald-600" />
                <p className="text-sm">{msg}</p>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t p-4">
            {phase === "review" || phase === "applying" ? (
              <>
                <Dialog.Close asChild>
                  <Button variant="ghost" disabled={phase === "applying"}>
                    Cancelar
                  </Button>
                </Dialog.Close>
                <Button
                  onClick={apply}
                  disabled={phase === "applying" || approved.size === 0}
                  className="gap-1.5"
                >
                  {phase === "applying" && <Loader2 className="size-4 animate-spin" />}
                  Importar {approved.size} item(ns)
                </Button>
              </>
            ) : (
              <Dialog.Close asChild>
                <Button variant={phase === "done" ? "default" : "ghost"}>
                  Fechar
                </Button>
              </Dialog.Close>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
