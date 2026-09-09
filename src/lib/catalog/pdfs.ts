/**
 * Catálogos PDF da empresa.
 *
 * Um PDF pode servir para:
 *  - ENVIO aos clientes (campanhas de WhatsApp) — `use_for_sending`;
 *  - IMPORTAR produtos estruturados (pipeline de IA) — `import_job_id`;
 *  - os dois.
 *
 * O bucket `catalogs` é PRIVADO — o envio usa uma URL assinada temporária.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogPdf, Database } from "@/lib/supabase/database.types";

type Db = SupabaseClient<Database>;

export interface ResolvedCatalog {
  pdfId: string;
  filename: string;
  /** URL HTTPS assinada e temporária (o WhatsApp busca em segundos). */
  url: string;
}

/**
 * Escolhe qual PDF usar para uma campanha. Puro.
 * Prioridade: PDF escolhido na campanha → padrão da empresa → qualquer um
 * marcado para envio (mais recente).
 */
export function pickCatalogPdf(
  pdfs: Pick<CatalogPdf, "id" | "use_for_sending" | "is_default" | "created_at">[],
  campaignPdfId: string | null,
): string | null {
  const sendable = pdfs.filter((p) => p.use_for_sending);
  if (campaignPdfId) {
    const chosen = sendable.find((p) => p.id === campaignPdfId);
    if (chosen) return chosen.id;
  }
  const def = sendable.find((p) => p.is_default);
  if (def) return def.id;
  const newest = [...sendable].sort((a, b) =>
    a.created_at < b.created_at ? 1 : -1,
  )[0];
  return newest?.id ?? null;
}

export async function listCatalogPdfs(
  db: Db,
  companyId: string,
): Promise<CatalogPdf[]> {
  const { data } = await db
    .from("catalog_pdfs")
    .select("*")
    .eq("company_id", companyId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  return (data ?? []) as CatalogPdf[];
}

/** Resolve o catálogo para envio numa campanha. Valida `company_id`. */
export async function resolveCampaignCatalog(
  db: Db,
  companyId: string,
  campaignPdfId: string | null,
  companyName: string,
): Promise<ResolvedCatalog | null> {
  const pdfs = await listCatalogPdfs(db, companyId);
  const id = pickCatalogPdf(pdfs, campaignPdfId);
  if (!id) return null;

  const pdf = pdfs.find((p) => p.id === id)!;
  // segurança extra: o caminho tem que estar sob a pasta da empresa
  if (!pdf.file_path.startsWith(`${companyId}/`)) {
    console.error("[catalog/pdfs] file_path fora do tenant:", pdf.id);
    return null;
  }

  const { data: signed, error } = await db.storage
    .from("catalogs")
    .createSignedUrl(pdf.file_path, 3600);
  if (error || !signed?.signedUrl) {
    console.error("[catalog/pdfs] falha ao assinar URL:", error?.message);
    return null;
  }

  const safeName =
    companyName.replace(/[^\p{L}\p{N} .\-_]/gu, "").trim() || "LumiHunter";
  return {
    pdfId: pdf.id,
    filename: pdf.file_name?.toLowerCase().endsWith(".pdf")
      ? pdf.file_name
      : `Catálogo ${safeName}.pdf`,
    url: signed.signedUrl,
  };
}

/** Uma URL assinada para o usuário visualizar o PDF no navegador. */
export async function signedPdfUrl(
  db: Db,
  filePath: string,
  seconds = 600,
): Promise<string | null> {
  const { data } = await db.storage
    .from("catalogs")
    .createSignedUrl(filePath, seconds);
  return data?.signedUrl ?? null;
}
