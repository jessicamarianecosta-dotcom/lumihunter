/**
 * Localiza o catálogo PDF REAL da empresa para anexar à abordagem.
 *
 * Fonte principal: `catalog_pdfs` (seção "Catálogos" em Produtos & Serviços) —
 * URL assinada temporária, bucket privado. Fallback legado:
 * `products.catalog_pdf_url`. Sempre valida `company_id`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { resolveCampaignCatalog } from "@/lib/catalog/pdfs";

type Db = SupabaseClient<Database>;

export interface CampaignCatalog {
  url: string;
  filename: string;
}

interface CampaignRef {
  outreach_catalog_pdf_id: string | null;
  /** legado — usado só no fallback */
  product_id?: string | null;
}

export async function resolveCampaignCatalogPdf(
  db: Db,
  companyId: string,
  campaign: CampaignRef,
  companyName: string,
): Promise<CampaignCatalog | null> {
  // 1) novo: catalog_pdfs (padrão / escolhido na campanha / marcado para envio)
  const resolved = await resolveCampaignCatalog(
    db,
    companyId,
    campaign.outreach_catalog_pdf_id ?? null,
    companyName,
  );
  if (resolved) return { url: resolved.url, filename: resolved.filename };

  // 2) fallback legado: products.catalog_pdf_url
  const { data } = await db
    .from("products")
    .select("id, name, catalog_pdf_url, company_id")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .not("catalog_pdf_url", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1);
  const product = data?.[0];
  if (!product?.catalog_pdf_url) return null;

  const safeName =
    companyName.replace(/[^\p{L}\p{N} .\-_]/gu, "").trim() || "LumiHunter";
  return {
    url: product.catalog_pdf_url,
    filename: `Catálogo ${safeName}.pdf`,
  };
}
