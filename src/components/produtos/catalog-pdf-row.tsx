"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star, Send, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface CatalogPdfView {
  id: string;
  fileName: string;
  fileSize: number | null;
  isDefault: boolean;
  useForSending: boolean;
  hasImport: boolean;
  createdAt: string;
  viewUrl: string | null;
}

export function CatalogPdfRow({
  pdf,
  canWrite,
}: {
  pdf: CatalogPdfView;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function act(action: "set_default" | "toggle_sending" | "delete") {
    if (action === "delete" && !confirm(`Excluir o catálogo "${pdf.fileName}"?`)) return;
    setBusy(action);
    const res = await fetch("/api/catalog/pdfs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: pdf.id, action }),
    });
    setBusy(null);
    if (res.ok) router.refresh();
  }

  const sizeMb = pdf.fileSize ? ` · ${(pdf.fileSize / 1024 / 1024).toFixed(1)} MB` : "";

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 text-sm">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{pdf.fileName}</span>
          {pdf.isDefault && <Badge variant="success">⭐ Padrão</Badge>}
          {pdf.useForSending ? (
            <Badge variant="secondary">Envio ativado</Badge>
          ) : (
            <Badge variant="outline">Envio desativado</Badge>
          )}
          {pdf.hasImport && <Badge variant="outline">Produtos importados</Badge>}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {new Date(pdf.createdAt).toLocaleDateString("pt-BR")}
          {sizeMb}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {pdf.viewUrl && (
          <a
            href={pdf.viewUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
          >
            <ExternalLink className="size-3.5" /> Visualizar
          </a>
        )}
        {canWrite && (
          <>
            {!pdf.isDefault && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => act("set_default")}
                disabled={busy !== null}
              >
                {busy === "set_default" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Star className="size-3.5" />
                )}
                Padrão
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => act("toggle_sending")}
              disabled={busy !== null}
            >
              {busy === "toggle_sending" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              {pdf.useForSending ? "Desativar envio" : "Ativar envio"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => act("delete")}
              disabled={busy !== null}
            >
              {busy === "delete" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
