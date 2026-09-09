/**
 * Base Comercial — busca comercial unificada (acesso ao banco).
 *
 * Usa o catalog admin client (bypassa RLS) mas SEMPRE filtra por `company_id`,
 * então o isolamento entre empresas é garantido no código. Chamado pelos
 * agentes de IA e pela UI de Produtos.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ProductVariantRow,
  ProductVariationGroupRow,
  ProductVariationOptionRow,
} from "@/lib/supabase/database.types";
import { classifySearch, narrowByQueryOverlap } from "./resolve";
import type {
  CommercialProduct,
  CommercialVariant,
  SearchOutcome,
} from "./types";

function buildVariant(
  row: ProductVariantRow,
  optionLabelById: Map<string, string>,
): CommercialVariant {
  const attrs = (row.attributes ?? {}) as Record<string, string | number | null>;
  const tiers = Array.isArray(row.price_tiers)
    ? (row.price_tiers as { min_qty: number; price: number }[])
    : null;
  return {
    id: row.id,
    sku: row.sku,
    optionLabels: (row.option_ids ?? [])
      .map((id) => optionLabelById.get(id))
      .filter((v): v is string => !!v),
    attributes: attrs,
    priceKind: (["fixed", "per_unit", "per_quantity", "quote"].includes(row.price_kind)
      ? row.price_kind
      : "fixed") as CommercialVariant["priceKind"],
    price: row.price,
    priceTiers: tiers,
    currency: row.currency,
    minQuantity: row.min_quantity,
    leadTimeDays: row.lead_time_days,
    stockQuantity: row.stock_quantity,
    notes: row.notes,
    isActive: row.is_active,
    needsReview: row.needs_review,
    source: row.source,
  };
}

async function loadProducts(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  productIds: string[],
): Promise<CommercialProduct[]> {
  if (productIds.length === 0) return [];

  const [
    { data: products },
    { data: groups },
    { data: options },
    { data: variants },
    { data: categories },
  ] = await Promise.all([
    admin
      .from("products")
      .select(
        "id,name,description,kind,is_active,source,external_url,last_synced_at,needs_review,category_id",
      )
      .eq("company_id", companyId)
      .in("id", productIds),
    admin
      .from("product_variation_groups")
      .select("*")
      .eq("company_id", companyId)
      .in("product_id", productIds),
    admin
      .from("product_variation_options")
      .select("*")
      .eq("company_id", companyId),
    admin
      .from("product_variants")
      .select("*")
      .eq("company_id", companyId)
      .in("product_id", productIds),
    admin.from("product_categories").select("id,name").eq("company_id", companyId),
  ]);

  const catName = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const groupIds = new Set((groups ?? []).map((g) => g.id));
  const optionLabelById = new Map<string, string>();
  for (const o of (options ?? []) as ProductVariationOptionRow[]) {
    if (groupIds.has(o.group_id)) optionLabelById.set(o.id, o.value);
  }
  const variantsByProduct = new Map<string, ProductVariantRow[]>();
  for (const v of (variants ?? []) as ProductVariantRow[]) {
    const list = variantsByProduct.get(v.product_id) ?? [];
    list.push(v);
    variantsByProduct.set(v.product_id, list);
  }
  const needsReviewByProduct = new Map<string, boolean>();
  for (const g of (groups ?? []) as ProductVariationGroupRow[]) {
    // presença de grupos não muda needs_review; placeholder para clareza
    void g;
  }

  return (products ?? []).map((p) => {
    const vs = (variantsByProduct.get(p.id) ?? []).map((v) =>
      buildVariant(v, optionLabelById),
    );
    const prices = vs
      .filter((v) => v.isActive && typeof v.price === "number")
      .map((v) => v.price as number);
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      category: p.category_id ? (catName.get(p.category_id) ?? null) : null,
      kind: p.kind,
      isActive: p.is_active,
      source: p.source,
      contributingSources: [p.source],
      externalUrl: p.external_url,
      lastSyncedAt: p.last_synced_at,
      needsReview:
        !!p.needs_review ||
        vs.some((v) => v.needsReview) ||
        !!needsReviewByProduct.get(p.id),
      variants: vs,
      priceRange: prices.length
        ? { min: Math.min(...prices), max: Math.max(...prices) }
        : null,
    };
  });
}

/**
 * Busca comercial. Retorna um `SearchOutcome` já classificado (FOUND / PARTIAL /
 * AMBIGUOUS / NOT_FOUND / SOURCE_UNAVAILABLE).
 */
export async function searchCatalog(args: {
  companyId: string;
  query: string;
  requestedSpecs?: string[];
  limit?: number;
}): Promise<SearchOutcome> {
  const admin = createAdminClient();
  const limit = args.limit ?? 8;

  let matchIds: string[] = [];
  try {
    const { data, error } = await admin.rpc("search_commercial_catalog", {
      p_company_id: args.companyId,
      p_query: args.query,
      p_limit: limit,
    });
    if (error) throw error;
    matchIds = (data ?? []).map((m) => m.product_id);
  } catch {
    // Fallback sem a RPC: casa QUALQUER palavra relevante da consulta no nome
    // ou na descrição (a consulta já vem "limpa" de deriveCommercialQuery).
    const words = args.query
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 2)
      .slice(0, 6);
    const orFilter = words.length
      ? words
          .flatMap((w) => [`name.ilike.%${w}%`, `description.ilike.%${w}%`])
          .join(",")
      : `name.ilike.%${args.query}%`;
    const { data } = await admin
      .from("products")
      .select("id")
      .eq("company_id", args.companyId)
      .or(orFilter)
      .limit(limit);
    matchIds = (data ?? []).map((r) => r.id);
  }

  const products = await loadProducts(admin, args.companyId, matchIds);
  const narrowed = narrowByQueryOverlap(products, args.query.split(/\s+/));

  const outcome = classifySearch({
    query: args.query,
    matches: narrowed,
    requestedSpecs: args.requestedSpecs,
    sourcesChecked: [{ source: "manual", ok: true }],
  });

  try {
    await admin.from("catalog_events").insert({
      company_id: args.companyId,
      kind: "search",
      payload: {
        q: args.query.slice(0, 120),
        outcome: outcome.kind,
        hits: products.length,
      },
    });
  } catch {
    /* observabilidade não bloqueia a busca */
  }

  return outcome;
}
