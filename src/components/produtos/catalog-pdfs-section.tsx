import { FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listCatalogPdfs, signedPdfUrl } from "@/lib/catalog/pdfs";
import { CatalogUploadDialog } from "./catalog-upload-dialog";
import { CatalogPdfRow, type CatalogPdfView } from "./catalog-pdf-row";

/**
 * Seção "Catálogos" da página de Produtos & Serviços.
 * Um PDF pode servir para ENVIO aos clientes e/ou IMPORTAR produtos — opções
 * independentes.
 */
export async function CatalogPdfsSection({
  companyId,
  canWrite,
}: {
  companyId: string;
  canWrite: boolean;
}) {
  const supabase = await createClient();
  const pdfs = await listCatalogPdfs(supabase, companyId).catch(() => []);

  const views: CatalogPdfView[] = await Promise.all(
    pdfs.map(async (p) => ({
      id: p.id,
      fileName: p.file_name,
      fileSize: p.file_size,
      isDefault: p.is_default,
      useForSending: p.use_for_sending,
      hasImport: !!p.import_job_id,
      createdAt: p.created_at,
      viewUrl: await signedPdfUrl(supabase, p.file_path).catch(() => null),
    })),
  );

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <FileText className="size-4" /> Catálogos
        </h2>
        {canWrite && <CatalogUploadDialog companyId={companyId} />}
      </div>

      {views.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum catálogo PDF. Envie o catálogo completo da empresa para usar no
          envio das campanhas e/ou importar os produtos.
        </p>
      ) : (
        <div className="space-y-2">
          {views.map((v) => (
            <CatalogPdfRow key={v.id} pdf={v} canWrite={canWrite} />
          ))}
        </div>
      )}
    </section>
  );
}
