"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, ExternalLink, RefreshCw, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  saveCatalogOnlineUrl,
  deleteCatalogSource,
  type CatalogUrlResult,
} from "@/app/(app)/produtos/actions";

interface Props {
  url: string | null;
  status: string | null;
  lastSyncAt: string | null;
  productsCount: number;
  lastSyncSummary: Record<string, number> | null;
  errorMessage: string | null;
  canWrite: boolean;
}

const DEFAULT_URL = "https://precyplus.com.br/loja/lumilife";

export function PrecySourceCard({
  url,
  status,
  lastSyncAt,
  productsCount,
  lastSyncSummary,
  errorMessage,
  canWrite,
}: Props) {
  const router = useRouter();
  const [state, action, pending] = useActionState<CatalogUrlResult | null, FormData>(
    saveCatalogOnlineUrl,
    null,
  );
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function testConnection() {
    const value =
      (document.getElementById("precy-url") as HTMLInputElement)?.value?.trim() ||
      url ||
      DEFAULT_URL;
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await fetch("/api/catalog/precy/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: value }),
      });
      const data = await res.json();
      setTestMsg(data.message ?? (data.ok ? "Conectado." : "Falha na conexão."));
    } catch {
      setTestMsg("Erro de rede ao testar.");
    }
    setTesting(false);
  }

  async function sync() {
    setSyncing(true);
    setTestMsg(null);
    try {
      const res = await fetch("/api/catalog/precy/sync", { method: "POST" });
      const data = await res.json();
      setTestMsg(data.message ?? (data.ok ? "Sincronizado." : "Não foi possível sincronizar."));
      if (data.ok) router.refresh();
    } catch {
      setTestMsg("Erro de rede ao sincronizar.");
    }
    setSyncing(false);
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Catálogo online (Precy+)</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {url ? status ?? "cadastrado" : "não conectado"}
        </span>
      </div>

      {url && (
        <>
          <p className="mt-1 text-xs text-muted-foreground">
            {productsCount} produto(s) sincronizado(s)
            {lastSyncAt
              ? ` · última sincronização ${new Date(lastSyncAt).toLocaleString("pt-BR")}`
              : " · nunca sincronizado"}
          </p>
          {lastSyncSummary && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {`✓ ${lastSyncSummary.updated ?? 0} atualizados · ✓ ${lastSyncSummary.created ?? 0} novos`}
              {lastSyncSummary.removed
                ? ` · ${lastSyncSummary.removed} removidos`
                : ""}
              {lastSyncSummary.needsReview
                ? ` · ⚠ ${lastSyncSummary.needsReview} p/ revisão`
                : ""}
            </p>
          )}
          {errorMessage && (
            <p className="mt-0.5 text-xs text-destructive">{errorMessage}</p>
          )}
        </>
      )}

      <form action={action} className="mt-3 space-y-2">
        <Input
          id="precy-url"
          name="url"
          type="url"
          inputMode="url"
          placeholder={DEFAULT_URL}
          defaultValue={url ?? ""}
          disabled={!canWrite}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={pending || !canWrite}>
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            Salvar URL
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={testConnection}
            disabled={testing}
          >
            {testing && <Loader2 className="size-3.5 animate-spin" />}
            Testar conexão
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={sync}
            disabled={syncing || !canWrite}
          >
            {syncing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Sincronizar catálogo
          </Button>
          {url && (
            <Button asChild size="sm" variant="ghost">
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-3.5" />
                Abrir catálogo
              </a>
            </Button>
          )}
          {url && canWrite && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={async () => {
                await deleteCatalogSource("precy_online");
                router.refresh();
              }}
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </form>

      {(state?.error || testMsg) && (
        <p
          className={`mt-2 text-xs ${state?.error ? "text-destructive" : "text-muted-foreground"}`}
        >
          {state?.error ?? testMsg}
        </p>
      )}
      {state?.ok && !state.error && (
        <p className="mt-2 text-xs text-emerald-600">URL salva.</p>
      )}
    </div>
  );
}
