import { Package, FileText, AlertTriangle } from "lucide-react";
import { getCatalogOverview, findSource } from "@/lib/catalog/sources";
import { PdfImportDialog } from "./pdf-import-dialog";
import { PrecySourceCard } from "./precy-source-card";

/**
 * Seção "Fontes do catálogo" da página de Produtos & Serviços.
 * Reúne as três fontes da Base Comercial: cadastro manual, PDF, catálogo online.
 */
export async function CatalogSources({
  companyId,
  canWrite,
}: {
  companyId: string;
  canWrite: boolean;
}) {
  const overview = await getCatalogOverview(companyId);

  if (!overview.ready) {
    return (
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Fontes do catálogo
        </h2>
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            A <strong>Base Comercial</strong> ainda não foi ativada no banco.
            Aplique a migration{" "}
            <code className="text-xs">20260908210000_base_comercial.sql</code>{" "}
            (<code className="text-xs">npm run db:push</code>) para habilitar
            importação de PDF, catálogo online e busca comercial.
          </p>
        </div>
      </section>
    );
  }

  const pdf = findSource(overview.sources, "pdf");
  const online = findSource(overview.sources, "precy_online");
  const pendingReview = overview.jobs.filter((j) => j.status === "review");

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">
        Fontes do catálogo
      </h2>

      <div className="grid gap-3 lg:grid-cols-3">
        {/* Manual */}
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <Package className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Cadastro manual</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {overview.manualCount} produto(s) cadastrado(s) à mão
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Use o botão “Adicionar produto” acima. É a fonte de menor prioridade —
            PDF e catálogo online prevalecem em caso de conflito de preço.
          </p>
        </div>

        {/* PDF */}
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">Catálogo PDF</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {pdf ? pdf.status : "não importado"}
            </span>
          </div>
          {pdf?.file_name && (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {pdf.file_name}
              {pdf.last_sync_at
                ? ` · ${new Date(pdf.last_sync_at).toLocaleDateString("pt-BR")}`
                : ""}
              {pdf.products_count ? ` · ${pdf.products_count} produto(s)` : ""}
            </p>
          )}
          {pendingReview.length > 0 && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="size-3" />
              {pendingReview.reduce((s, j) => s + j.review_count, 0)} item(ns)
              aguardando revisão
            </p>
          )}
          {canWrite && (
            <div className="mt-3">
              <PdfImportDialog hasExisting={!!pdf} companyId={companyId} />
            </div>
          )}
        </div>

        {/* Online (Precy+) */}
        <PrecySourceCard
          url={online?.external_url ?? null}
          status={online?.status ?? null}
          lastSyncAt={online?.last_sync_at ?? null}
          productsCount={online?.products_count ?? 0}
          lastSyncSummary={
            (online?.last_sync_summary as Record<string, number> | null) ?? null
          }
          errorMessage={online?.error_message ?? null}
          canWrite={canWrite}
        />
      </div>
    </section>
  );
}
