"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { FileUp, X, Loader2, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const MAX_MB = 20;

interface NItem {
  name: string;
  category: string | null;
  description: string | null;
  needsReview: boolean;
  notes: string | null;
  variationGroups: { name: string; values: string[] }[];
}
interface Job {
  id: string;
  status: string;
  extracted_items: { items: NItem[]; demo?: boolean } | NItem[];
  error_message: string | null;
}

type Phase = "idle" | "uploading" | "review" | "applying" | "done" | "error";

export function CatalogUploadDialog({ companyId }: { companyId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [useForSending, setUseForSending] = useState(true);
  const [importProducts, setImportProducts] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [items, setItems] = useState<NItem[]>([]);
  const [isDemo, setIsDemo] = useState(false);
  const [approved, setApproved] = useState<Set<number>>(new Set());

  function reset() {
    setPhase("idle");
    setUseForSending(true);
    setImportProducts(false);
    setMsg(null);
    setJob(null);
    setItems([]);
    setIsDemo(false);
    setApproved(new Set());
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onFile(file: File) {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setPhase("error");
      setMsg("Selecione um arquivo PDF.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setPhase("error");
      setMsg(`O PDF tem ${(file.size / 1024 / 1024).toFixed(1)} MB — o limite é ${MAX_MB} MB.`);
      return;
    }
    if (!useForSending && !importProducts) {
      setPhase("error");
      setMsg("Marque ao menos uma opção: usar para envio ou importar produtos.");
      return;
    }

    setPhase("uploading");
    setMsg("Enviando o PDF…");
    try {
      const supabase = createClient();
      const fullPath = `${companyId}/${crypto.randomUUID()}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("catalogs")
        .upload(fullPath, file, { contentType: "application/pdf", upsert: false });
      if (upErr) {
        setPhase("error");
        setMsg(`Falha ao enviar o arquivo: ${upErr.message}`);
        return;
      }

      setMsg(importProducts ? "Analisando o catálogo…" : "Salvando…");
      const res = await fetch("/api/catalog/pdf/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: fullPath,
          fileName: file.name,
          size: file.size,
          useForSending,
          importProducts,
        }),
      });
      const up = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPhase("error");
        setMsg(up.error ?? "Falha ao registrar o catálogo.");
        return;
      }

      if (!up.jobId) {
        setPhase("done");
        setMsg("Catálogo salvo e disponível para envio nas campanhas.");
        router.refresh();
        return;
      }

      // poll do job de importação
      const deadline = Date.now() + 120_000;
      let j: Job | null = null;
      while (Date.now() < deadline) {
        const r = await fetch(`/api/catalog/pdf/jobs/${up.jobId}`);
        const d = await r.json().catch(() => ({}));
        j = (d.job as Job) ?? null;
        if (j && ["review", "error", "applied"].includes(j.status)) break;
        await new Promise((res) => setTimeout(res, 2500));
      }
      if (!j || j.status === "error") {
        setPhase("error");
        setMsg(
          (j?.error_message ?? "Não foi possível ler o PDF para importar produtos.") +
            (useForSending ? " O PDF continua salvo para envio." : ""),
        );
        return;
      }
      const list = Array.isArray(j.extracted_items)
        ? j.extracted_items
        : (j.extracted_items?.items ?? []);
      setJob(j);
      setItems(list);
      setIsDemo(!Array.isArray(j.extracted_items) && !!j.extracted_items?.demo);
      setApproved(new Set(list.map((it, i) => (it.needsReview ? -1 : i)).filter((i) => i >= 0)));
      setPhase("review");
      setMsg(null);
    } catch (e) {
      setPhase("error");
      setMsg(`Erro: ${e instanceof Error ? e.message : "falha de rede"}.`);
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
        setMsg(data.error ?? "Falha ao importar.");
        return;
      }
      setPhase("done");
      setMsg(`${data.created} produto(s) importado(s).`);
      router.refresh();
    } catch {
      setPhase("error");
      setMsg("Erro de rede ao importar.");
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <Dialog.Trigger asChild>
        <Button size="sm" className="gap-1.5">
          <FileUp className="size-3.5" /> Importar catálogo PDF
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
            <Dialog.Title className="text-sm font-semibold">Catálogo PDF</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Fechar">
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Envie um catálogo PDF para usar no envio aos clientes e/ou importar produtos.
          </Dialog.Description>

          <div className="flex-1 overflow-y-auto p-4">
            {(phase === "idle" || phase === "uploading" || phase === "error") && (
              <div className="space-y-3">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 size-4"
                    checked={useForSending}
                    onChange={(e) => setUseForSending(e.target.checked)}
                  />
                  <span>
                    <span className="font-medium">Usar este PDF para enviar aos clientes</span>
                    <br />
                    <span className="text-xs text-muted-foreground">
                      O arquivo fica guardado e as campanhas de WhatsApp podem enviá-lo. Não gasta IA.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 size-4"
                    checked={importProducts}
                    onChange={(e) => setImportProducts(e.target.checked)}
                  />
                  <span>
                    <span className="font-medium">Importar produtos deste PDF</span>
                    <br />
                    <span className="text-xs text-muted-foreground">
                      A IA lê o PDF e você revisa os produtos antes de cadastrar. Nada é inventado.
                    </span>
                  </span>
                </label>

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
                      phase === "error" ? "text-red-600 dark:text-red-400" : "text-muted-foreground",
                    )}
                  >
                    {msg}
                  </p>
                )}
              </div>
            )}

            {(phase === "review" || phase === "applying") && (
              <div className="space-y-3">
                {isDemo && (
                  <div className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-amber-700 dark:text-amber-400">
                    Sem chave de IA — extração de <strong>exemplo</strong> (dados sintéticos), só para ver o fluxo.
                  </div>
                )}
                <p className="text-xs font-medium">
                  {items.length} produto(s) encontrado(s) · {approved.size} selecionado(s)
                </p>
                <div className="flex gap-2 text-xs">
                  <button
                    className="underline"
                    onClick={() => setApproved(new Set(items.map((_, i) => i)))}
                  >
                    Selecionar todos
                  </button>
                  <button className="underline" onClick={() => setApproved(new Set())}>
                    Limpar
                  </button>
                </div>
                <div className="divide-y rounded-lg border">
                  {items.map((it, i) => (
                    <label key={i} className="flex cursor-pointer items-start gap-3 p-3 text-sm">
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
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{it.name}</span>
                          {it.category && (
                            <span className="text-xs text-muted-foreground">{it.category}</span>
                          )}
                          {it.needsReview ? (
                            <span className="rounded bg-amber-500/15 px-1 text-[10px] text-amber-700 dark:text-amber-400">
                              ⚠ revisar
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600">
                              <Check className="size-3" /> pronto
                            </span>
                          )}
                        </div>
                        {it.description && (
                          <p className="text-xs text-muted-foreground">{it.description}</p>
                        )}
                        {it.variationGroups.length > 0 && (
                          <p className="text-[11px] text-muted-foreground">
                            {it.variationGroups
                              .map((g) => `${g.name} (${g.values.join("/")})`)
                              .join(" • ")}
                          </p>
                        )}
                        {it.notes && (
                          <p className="text-xs text-amber-700 dark:text-amber-400">{it.notes}</p>
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
                    Depois
                  </Button>
                </Dialog.Close>
                <Button onClick={apply} disabled={phase === "applying" || approved.size === 0} className="gap-1.5">
                  {phase === "applying" && <Loader2 className="size-4 animate-spin" />}
                  Importar {approved.size} produto(s)
                </Button>
              </>
            ) : (
              <Dialog.Close asChild>
                <Button variant={phase === "done" ? "default" : "ghost"}>Fechar</Button>
              </Dialog.Close>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
