/**
 * Base Comercial — sincronização do catálogo online (Precy+) para os produtos
 * locais da empresa.
 *
 * - upsert por (company_id, external_source='precy', external_id) — preserva
 *   produtos existentes, não duplica.
 * - variações/variantes de um produto Precy são reconstruídas a cada sync
 *   (o produto Precy é 100% "dono" das suas variações).
 * - produto que sumiu do catálogo online → `is_active = false` (não apaga).
 * - registra last_synced_at, contadores e erros em `catalog_sources`.
 *
 * Multi-tenant: recebe o client autenticado do usuário (RLS por company_id).
 */
import type { createAdminClient } from "@/lib/supabase/admin";
import { precyCatalogProvider } from "./providers/precy";
import { logCatalogEvent } from "./sources";
import type { ProviderProduct } from "./types";
import type { Json } from "@/lib/supabase/database.types";

type Db = ReturnType<typeof createAdminClient>;

export interface SyncResult {
  ok: boolean;
  found: number;
  created: number;
  updated: number;
  removed: number;
  priceChanged: number;
  needsReview: number;
  errors: string[];
  lastSyncedAt: string;
}

function priceOf(p: ProviderProduct): { start: number | null; avg: number | null } {
  const variantPrices = p.variants
    .map((v) => v.price)
    .filter((x): x is number => typeof x === "number");
  const minVariant = variantPrices.length ? Math.min(...variantPrices) : null;
  return {
    start: p.startingPrice ?? minVariant ?? p.basePrice,
    avg: p.promoPrice ?? p.basePrice ?? minVariant,
  };
}

export async function syncPrecyCatalog(
  companyId: string,
  db: Db,
): Promise<SyncResult> {
  const startedAt = new Date().toISOString();
  const errors: string[] = [];

  const { data: source } = await db
    .from("catalog_sources")
    .select("id,external_url,status")
    .eq("company_id", companyId)
    .eq("kind", "precy_online")
    .maybeSingle();

  if (!source?.external_url) {
    return {
      ok: false,
      found: 0,
      created: 0,
      updated: 0,
      removed: 0,
      priceChanged: 0,
      needsReview: 0,
      errors: ["Nenhuma URL de catálogo online configurada."],
      lastSyncedAt: startedAt,
    };
  }

  await logCatalogEvent(companyId, "sync_started", { source: "precy" }, db);
  await db
    .from("catalog_sources")
    .update({ status: "processing" })
    .eq("id", source.id);

  let remote: ProviderProduct[];
  try {
    remote = await precyCatalogProvider.listProducts({ url: source.external_url });
  } catch (e) {
    const msg = (e as Error).message;
    await db
      .from("catalog_sources")
      .update({ status: "error", error_message: msg })
      .eq("id", source.id);
    await logCatalogEvent(companyId, "sync_error", { reason: msg }, db);
    return {
      ok: false,
      found: 0,
      created: 0,
      updated: 0,
      removed: 0,
      priceChanged: 0,
      needsReview: 0,
      errors: [msg],
      lastSyncedAt: startedAt,
    };
  }

  // produtos Precy já existentes localmente
  const { data: existing } = await db
    .from("products")
    .select("id,external_id,price_avg,is_active")
    .eq("company_id", companyId)
    .eq("external_source", "precy");
  const byExternal = new Map(
    (existing ?? []).map((p) => [p.external_id as string, p]),
  );
  const seen = new Set<string>();

  // categorias locais (upsert por nome)
  const catByName = new Map<string, string>();
  async function categoryId(name: string | null): Promise<string | null> {
    if (!name) return null;
    if (catByName.has(name)) return catByName.get(name)!;
    const { data } = await db
      .from("product_categories")
      .upsert({ company_id: companyId, name }, { onConflict: "company_id,name" })
      .select("id")
      .single();
    if (data?.id) catByName.set(name, data.id);
    return data?.id ?? null;
  }

  const storeBase = source.external_url.replace(/\/$/, "");
  let created = 0;
  let updated = 0;
  let priceChanged = 0;
  let needsReview = 0;

  for (const rp of remote) {
    seen.add(rp.externalId);
    const price = priceOf(rp);
    const prev = byExternal.get(rp.externalId);
    const catId = await categoryId(rp.category);

    try {
      const { data: product, error: upErr } = await db
        .from("products")
        .upsert(
          {
            company_id: companyId,
            name: rp.name,
            description: rp.description,
            kind: "product",
            category_id: catId,
            source: "precy_online",
            external_source: "precy",
            external_id: rp.externalId,
            external_url: `${storeBase}/produto/${rp.externalId}`,
            last_synced_at: startedAt,
            needs_review: false,
            is_active: true,
            price_start: price.start,
            price_avg: price.avg,
            lead_time_days: rp.leadTimeDays,
          },
          { onConflict: "company_id,external_source,external_id" },
        )
        .select("id")
        .single();
      if (upErr || !product) throw new Error(upErr?.message ?? "upsert falhou");

      if (!prev) created += 1;
      else {
        updated += 1;
        if (typeof prev.price_avg === "number" && prev.price_avg !== price.avg) {
          priceChanged += 1;
        }
      }

      // reconstrói variações do produto
      await db.from("product_variation_groups").delete().eq("product_id", product.id);
      await db
        .from("product_variants")
        .delete()
        .eq("product_id", product.id)
        .eq("source", "precy_online");

      const optionIdByExternal = new Map<string, string>();
      for (const [gi, g] of rp.variationGroups.entries()) {
        const { data: group } = await db
          .from("product_variation_groups")
          .insert({
            company_id: companyId,
            product_id: product.id,
            name: g.name,
            sort_order: gi,
            external_id: g.externalId,
          })
          .select("id")
          .single();
        if (!group) continue;
        for (const [oi, opt] of g.options.entries()) {
          const { data: o } = await db
            .from("product_variation_options")
            .insert({
              company_id: companyId,
              group_id: group.id,
              value: opt.value,
              sort_order: oi,
              external_id: opt.externalId,
            })
            .select("id")
            .single();
          if (o?.id) optionIdByExternal.set(opt.externalId, o.id);
        }
      }

      const quote = rp.checkoutMode === "quote";
      for (const [vi, v] of rp.variants.entries()) {
        const review = v.price == null && !quote;
        if (review) needsReview += 1;
        await db.from("product_variants").insert({
          company_id: companyId,
          product_id: product.id,
          sku: v.sku,
          option_ids: v.optionExternalIds
            .map((x) => optionIdByExternal.get(x))
            .filter((x): x is string => !!x),
          attributes: {} as unknown as Json,
          price_kind: v.price == null && quote ? "quote" : "fixed",
          price: v.price,
          currency: "BRL",
          lead_time_days: v.leadTimeDays,
          stock_quantity: v.stockQuantity,
          is_active: true,
          needs_review: review,
          source: "precy_online",
          external_id: v.externalId,
          sort_order: vi,
        });
      }
      // produto sem variantes → uma "variante padrão" com o preço base
      if (rp.variants.length === 0) {
        const review = price.avg == null && !quote;
        if (review) needsReview += 1;
        await db.from("product_variants").insert({
          company_id: companyId,
          product_id: product.id,
          option_ids: [],
          attributes: {} as unknown as Json,
          price_kind: quote ? "quote" : "fixed",
          price: price.avg,
          currency: "BRL",
          lead_time_days: rp.leadTimeDays,
          is_active: true,
          needs_review: review,
          source: "precy_online",
          sort_order: 0,
        });
      }
    } catch (e) {
      errors.push(`${rp.name}: ${(e as Error).message}`);
    }
  }

  // produtos que sumiram do catálogo online → desativa (não apaga)
  let removed = 0;
  for (const [ext, p] of byExternal) {
    if (!seen.has(ext) && p.is_active) {
      await db.from("products").update({ is_active: false }).eq("id", p.id);
      removed += 1;
    }
  }

  const summary = {
    found: remote.length,
    created,
    updated,
    removed,
    priceChanged,
    needsReview,
    errors: errors.length,
  };
  await db
    .from("catalog_sources")
    .update({
      status: "connected",
      products_count: remote.length,
      last_sync_at: startedAt,
      last_sync_summary: summary as unknown as Json,
      error_message: errors.length ? errors.slice(0, 5).join(" · ") : null,
    })
    .eq("id", source.id);
  await logCatalogEvent(companyId, "sync_done", summary as unknown as Json, db);

  return {
    ok: true,
    found: remote.length,
    created,
    updated,
    removed,
    priceChanged,
    needsReview,
    errors,
    lastSyncedAt: startedAt,
  };
}
