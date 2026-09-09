/**
 * Localiza o catálogo PDF REAL da empresa para anexar à abordagem.
 *
 * Fonte: `products.catalog_pdf_url` (Produtos & Serviços). Sempre valida
 * `company_id` — nunca envia o catálogo de outra empresa.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Admin = SupabaseClient<Database>;

export interface CampaignCatalog {
  url: string;
  filename: string;
  productId: string;
}

interface CampaignRef {
  outreach_catalog_product_id: string | null;
  product_id: string | null;
}

export async function resolveCampaignCatalogPdf(
  admin: Admin,
  companyId: string,
  campaign: CampaignRef,
  companyName: string,
): Promise<CampaignCatalog | null> {
  const tryProduct = async (id: string | null) => {
    if (!id) return null;
    const { data } = await admin
      .from("products")
      .select("id, name, catalog_pdf_url, company_id")
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle();
    return data?.catalog_pdf_url ? data : null;
  };

  let product =
    (await tryProduct(campaign.outreach_catalog_product_id)) ??
    (await tryProduct(campaign.product_id));

  if (!product) {
    const { data } = await admin
      .from("products")
      .select("id, name, catalog_pdf_url, company_id")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .not("catalog_pdf_url", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1);
    product = data?.[0] ?? null;
  }

  if (!product?.catalog_pdf_url) return null;

  const safeName = companyName.replace(/[^\p{L}\p{N} .\-_]/gu, "").trim() || "LumiHunter";
  return {
    url: product.catalog_pdf_url,
    filename: `Catálogo ${safeName}.pdf`,
    productId: product.id,
  };
}
