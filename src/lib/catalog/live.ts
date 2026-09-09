/**
 * Base Comercial — consulta AO VIVO ao catálogo online (Precy+).
 *
 * Usado como fallback pelo Sales Coach quando a busca local não encontra o
 * produto e a empresa tem uma fonte `precy_online` conectada. Assim o agente
 * responde com dados reais mesmo antes de uma sincronização.
 *
 * Cache em memória por empresa (curto) para não chamar o Precy+ a cada
 * mensagem. Multi-tenant: sempre parte da URL configurada PELA empresa.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { precyCatalogProvider } from "./providers/precy";
import { classifySearch, relevantMatches } from "./resolve";
import type {
  CatalogSourceKind,
  CommercialProduct,
  CommercialVariant,
  ProviderProduct,
  SearchOutcome,
} from "./types";

interface CacheEntry {
  at: number;
  url: string;
  products: ProviderProduct[];
}
const TTL_MS = 5 * 60_000;
const cache = new Map<string, CacheEntry>();

/** URL do catálogo online conectado da empresa (ou null). */
async function connectedPrecyUrl(companyId: string): Promise<string | null> {
  try {
    const { data } = await createAdminClient()
      .from("catalog_sources")
      .select("external_url,status")
      .eq("company_id", companyId)
      .eq("kind", "precy_online")
      .maybeSingle();
    if (!data?.external_url) return null;
    if (data.status === "disconnected" || data.status === "error") return null;
    return data.external_url;
  } catch {
    return null;
  }
}

async function fetchCatalog(
  companyId: string,
  url: string,
): Promise<ProviderProduct[] | null> {
  const hit = cache.get(companyId);
  if (hit && hit.url === url && Date.now() - hit.at < TTL_MS) return hit.products;
  try {
    const products = await precyCatalogProvider.listProducts({ url });
    cache.set(companyId, { at: Date.now(), url, products });
    return products;
  } catch {
    return null; // fonte indisponível — o chamador trata
  }
}

function toCommercial(p: ProviderProduct, source: CatalogSourceKind): CommercialProduct {
  const variants: CommercialVariant[] = p.variants.map((v, i) => ({
    id: v.externalId || `remote-${i}`,
    sku: v.sku,
    optionLabels: labelsFor(p, v.optionExternalIds),
    attributes: {},
    priceKind: v.price == null && p.checkoutMode === "quote" ? "quote" : "fixed",
    price: v.price,
    priceTiers: null,
    currency: "BRL",
    minQuantity: null,
    leadTimeDays: v.leadTimeDays ?? p.leadTimeDays,
    stockQuantity: v.stockQuantity,
    notes: null,
    isActive: true,
    needsReview: false,
    source,
  }));
  if (variants.length === 0) {
    const base = p.promoPrice ?? p.basePrice ?? p.startingPrice;
    variants.push({
      id: `remote-base-${p.externalId}`,
      sku: null,
      optionLabels: [],
      attributes: {},
      priceKind: base == null && p.checkoutMode === "quote" ? "quote" : "fixed",
      price: base,
      priceTiers: null,
      currency: "BRL",
      minQuantity: null,
      leadTimeDays: p.leadTimeDays,
      stockQuantity: null,
      notes: null,
      isActive: true,
      needsReview: false,
      source,
    });
  }
  const prices = variants
    .filter((v) => typeof v.price === "number")
    .map((v) => v.price as number);
  return {
    id: p.externalId,
    name: p.name,
    description: p.description,
    category: p.category,
    kind: "product",
    isActive: true,
    source,
    contributingSources: [source],
    externalUrl: p.url,
    lastSyncedAt: null,
    needsReview: false,
    variants,
    priceRange: prices.length
      ? { min: Math.min(...prices), max: Math.max(...prices) }
      : null,
  };
}

function labelsFor(p: ProviderProduct, optionExternalIds: string[]): string[] {
  const byId = new Map<string, string>();
  for (const g of p.variationGroups)
    for (const o of g.options) byId.set(o.externalId, o.value);
  return optionExternalIds.map((id) => byId.get(id)).filter((x): x is string => !!x);
}

/** true se a empresa pode consultar o Precy+ ao vivo. */
export async function precyIsConsultable(companyId: string): Promise<boolean> {
  return (await connectedPrecyUrl(companyId)) !== null;
}

/**
 * Busca ao vivo no catálogo online. Retorna:
 *  - SearchOutcome quando conseguiu consultar (FOUND/PARTIAL/AMBIGUOUS/NOT_FOUND)
 *  - outcome SOURCE_UNAVAILABLE quando a fonte estava conectada mas não respondeu
 *  - null quando a empresa não tem catálogo online conectado
 */
export async function livePrecySearch(args: {
  companyId: string;
  query: string;
  /** palavras que identificam o produto (sem descritores genéricos). */
  terms: string[];
  requestedSpecs?: string[];
}): Promise<SearchOutcome | null> {
  const url = await connectedPrecyUrl(args.companyId);
  if (!url) return null;

  const catalog = await fetchCatalog(args.companyId, url);
  if (catalog === null) {
    return {
      kind: "SOURCE_UNAVAILABLE",
      query: args.query,
      products: [],
      sourcesChecked: [{ source: "precy_online", ok: false }],
      note: "Catálogo online conectado, mas não respondeu agora.",
    };
  }

  // filtro DURO: só os produtos do Precy+ que casam os termos do produto.
  // Sem termos → NOT_FOUND (não devolve catálogo inteiro).
  const terms = args.terms.filter((w) => w.length > 2);
  const commercial =
    terms.length === 0
      ? []
      : relevantMatches(
          catalog.map((p) => toCommercial(p, "precy_online")),
          terms,
        );

  return classifySearch({
    query: args.query,
    matches: commercial,
    requestedSpecs: args.requestedSpecs,
    sourcesChecked: [{ source: "precy_online", ok: true }],
  });
}
