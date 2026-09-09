/**
 * PrecyCatalogProvider — leitura REAL do catálogo online do Precy+.
 *
 * ── Método (confirmado inspecionando o bundle do próprio storefront do Precy+) ──
 * O storefront `precyplus.com.br/loja/<slug>` é um app que lê o PostgREST
 * público do Supabase do Precy+ com a anon key embutida no bundle (role `anon`,
 * protegida por RLS: `is_published_catalog = true`). São EXATAMENTE estas as
 * queries que a loja usa:
 *
 *   catalog_settings ?slug=eq.<slug>
 *     &select=company_id,slug,description,whatsapp,instagram,city,state,checkout_mode,companies(name)
 *   catalog_categories ?company_id=eq.<cid>&select=id,name&order=sort_order
 *   products ?company_id=eq.<cid>&is_published_catalog=eq.true
 *     &select=id,name,final_price,catalog_starting_price,catalog_promo_price,
 *             catalog_photos,catalog_category_id,catalog_lead_time_days,
 *             catalog_checkout_mode,description
 *   product_images ?product_id=eq.<pid>&select=id,url,sort_order&order=sort_order
 *   product_variation_groups ?product_id=eq.<pid>
 *     &select=id,name,sort_order,product_variation_options(id,group_id,value,sort_order)
 *   product_variants ?product_id=eq.<pid>&is_active=eq.true
 *     &select=id,sku,price,stock_quantity,lead_time_days,image_id,sort_order,
 *             product_variant_option_values(option_id,group_id)
 *   product_variation_dependencies ?product_id=eq.<pid>&select=option_id,depends_on_option_id
 *
 * Preço: base = final_price; a variante usa `price` quando definido, senão o base.
 *
 * Tudo somente-leitura, do lado do servidor do LumiHunter (sem CORS, sem
 * expor segredo no frontend). A anon key é pública por design (vem do bundle
 * deles) e é sobrescrevível por env.
 */
import type {
  CatalogProvider,
  CatalogProviderConfig,
  ProviderProduct,
} from "../types";

const PRECY_SUPABASE_URL = (
  process.env.PRECY_SUPABASE_URL ?? "https://ekynvecruqpuwwrcwtnp.supabase.co"
).replace(/\/$/, "");
const PRECY_SUPABASE_ANON_KEY =
  process.env.PRECY_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVreW52ZWNydXFwdXd3cmN3dG5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MjA4OTcsImV4cCI6MjA5NjQ5Njg5N30.JPFZiciQaZfQtGeA4qK5MoDRVrhru8_Wwka_53T9cxk";

/** kill-switch opcional; a integração é real, então o padrão é ligado. */
const PRECY_ENABLED = process.env.PRECY_ENABLED !== "false";

const SELECT = {
  settings:
    "company_id,slug,description,whatsapp,instagram,city,state,checkout_mode",
  productList:
    "id,name,description,final_price,catalog_starting_price,catalog_promo_price,catalog_photos,catalog_category_id,catalog_lead_time_days,catalog_checkout_mode",
  images: "id,url,sort_order",
  groups:
    "id,name,sort_order,product_variation_options(id,group_id,value,sort_order)",
  variants:
    "id,sku,price,stock_quantity,lead_time_days,image_id,sort_order,product_variant_option_values(option_id,group_id)",
} as const;

export class PrecyNotReadyError extends Error {}

async function rest<T>(pathAndQuery: string): Promise<T> {
  if (!PRECY_SUPABASE_ANON_KEY) {
    throw new PrecyNotReadyError("PRECY_SUPABASE_ANON_KEY não configurada.");
  }
  const res = await fetch(`${PRECY_SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    headers: {
      apikey: PRECY_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${PRECY_SUPABASE_ANON_KEY}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    throw new Error(`Precy+ PostgREST ${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}

/** Extrai o slug da loja da URL cadastrada. */
export function parseStoreSlug(url: string): string | null {
  const m = url.match(/\/loja\/([^/?#]+)/i);
  return m ? decodeURIComponent(m[1]).trim().toLowerCase() : null;
}

interface SettingsRow {
  company_id: string;
  slug: string;
  description: string | null;
  whatsapp: string | null;
  instagram: string | null;
  city: string | null;
  state: string | null;
  checkout_mode: string | null;
}

/** Resolve slug → conta/loja do Precy+ (tabela `catalog_settings`). */
export async function resolveStore(
  slug: string,
): Promise<{ externalCompanyId: string; settings: SettingsRow } | null> {
  const rows = await rest<SettingsRow[]>(
    `catalog_settings?slug=eq.${encodeURIComponent(slug)}&select=${SELECT.settings}&limit=1`,
  );
  const s = rows[0];
  return s ? { externalCompanyId: s.company_id, settings: s } : null;
}

interface ListRow {
  id: string;
  name: string;
  description: string | null;
  final_price: number | null;
  catalog_starting_price: number | null;
  catalog_promo_price: number | null;
  catalog_photos: string[] | null;
  catalog_category_id: string | null;
  catalog_lead_time_days: number | null;
  catalog_checkout_mode: string | null;
}
interface GroupRow {
  id: string;
  name: string;
  sort_order: number;
  product_variation_options: {
    id: string;
    group_id: string;
    value: string;
    sort_order: number;
  }[];
}
interface VariantRow {
  id: string;
  sku: string | null;
  price: number | null;
  stock_quantity: number | null;
  lead_time_days: number | null;
  sort_order: number;
  product_variant_option_values: { option_id: string; group_id: string }[];
}
interface ImageRow {
  id: string;
  url: string;
  sort_order: number;
}

function toProviderProduct(
  row: ListRow,
  images: ImageRow[],
  groups: GroupRow[],
  variants: VariantRow[],
  categoryName: string | null,
  storeCheckoutMode: string | null,
): ProviderProduct {
  return {
    externalId: row.id,
    name: row.name.trim(),
    url: null,
    description: row.description,
    category: categoryName ?? null,
    basePrice: row.final_price,
    startingPrice: row.catalog_starting_price,
    promoPrice: row.catalog_promo_price,
    leadTimeDays: row.catalog_lead_time_days,
    // per-produto quando definido; senão o modo da loja (ex.: "quote")
    checkoutMode: row.catalog_checkout_mode ?? storeCheckoutMode,
    photoUrls: [
      ...(row.catalog_photos ?? []),
      ...images.sort((a, b) => a.sort_order - b.sort_order).map((i) => i.url),
    ],
    variationGroups: groups
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((g) => ({
        externalId: g.id,
        name: g.name,
        options: (g.product_variation_options ?? [])
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((o) => ({ externalId: o.id, value: o.value })),
      })),
    variants: variants
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((v) => ({
        externalId: v.id,
        sku: v.sku,
        // preço da variante quando definido; senão cai no preço base
        price: v.price ?? row.catalog_promo_price ?? row.final_price,
        stockQuantity: v.stock_quantity,
        leadTimeDays: v.lead_time_days,
        optionExternalIds: (v.product_variant_option_values ?? []).map(
          (o) => o.option_id,
        ),
      })),
  };
}

async function fetchProductDetail(
  row: ListRow,
  categoryName: string | null,
  storeCheckoutMode: string | null,
): Promise<ProviderProduct> {
  const pid = row.id;
  const [images, groups, variants] = await Promise.all([
    rest<ImageRow[]>(
      `product_images?product_id=eq.${pid}&select=${SELECT.images}&order=sort_order.asc`,
    ),
    rest<GroupRow[]>(
      `product_variation_groups?product_id=eq.${pid}&select=${SELECT.groups}&order=sort_order.asc&product_variation_options.order=sort_order.asc`,
    ),
    rest<VariantRow[]>(
      `product_variants?product_id=eq.${pid}&is_active=eq.true&select=${SELECT.variants}&order=sort_order.asc`,
    ),
  ]);
  return toProviderProduct(row, images, groups, variants, categoryName, storeCheckoutMode);
}

async function categoryMap(externalCompanyId: string): Promise<Map<string, string>> {
  try {
    const rows = await rest<{ id: string; name: string }[]>(
      `catalog_categories?company_id=eq.${externalCompanyId}&select=id,name`,
    );
    return new Map(rows.map((c) => [c.id, c.name]));
  } catch {
    return new Map();
  }
}

/** Concorrência limitada para não martelar o PostgREST do Precy+. */
async function mapLimited<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export const precyCatalogProvider: CatalogProvider = {
  id: "precy",
  isReal: PRECY_ENABLED && !!PRECY_SUPABASE_ANON_KEY,

  async testConnection(config: CatalogProviderConfig) {
    const slug = parseStoreSlug(config.url);
    if (!slug) {
      return {
        ok: false,
        message:
          "URL inválida. Use o link da loja, ex.: https://precyplus.com.br/loja/sua-loja",
      };
    }
    if (!PRECY_ENABLED || !PRECY_SUPABASE_ANON_KEY) {
      return {
        ok: false,
        message: "Integração Precy+ desabilitada nesta instância.",
      };
    }
    try {
      const store = await resolveStore(slug);
      if (!store) {
        return {
          ok: false,
          message: `Nenhuma loja "${slug}" encontrada no Precy+. Confira a URL.`,
        };
      }
      const count = await rest<{ id: string }[]>(
        `products?company_id=eq.${store.externalCompanyId}&is_published_catalog=eq.true&select=id`,
      );
      return {
        ok: true,
        message: `Conectado à loja "${slug}" — ${count.length} produto(s) publicado(s).`,
      };
    } catch (e) {
      return { ok: false, message: `Falha ao conectar: ${(e as Error).message}` };
    }
  },

  async listProducts(config: CatalogProviderConfig): Promise<ProviderProduct[]> {
    const slug = parseStoreSlug(config.url);
    if (!slug) throw new PrecyNotReadyError("URL da loja inválida.");
    const store = await resolveStore(slug);
    if (!store) throw new PrecyNotReadyError(`Loja "${slug}" não encontrada no Precy+.`);

    const [list, cats] = await Promise.all([
      rest<ListRow[]>(
        `products?company_id=eq.${store.externalCompanyId}&is_published_catalog=eq.true&select=${SELECT.productList}&order=name.asc`,
      ),
      categoryMap(store.externalCompanyId),
    ]);

    const storeCheckout = store.settings.checkout_mode;
    return mapLimited(list, 5, (row) =>
      fetchProductDetail(
        row,
        row.catalog_category_id ? cats.get(row.catalog_category_id) ?? null : null,
        storeCheckout,
      ),
    );
  },

  async getProduct(config: CatalogProviderConfig, externalId: string) {
    const slug = parseStoreSlug(config.url);
    const store = slug ? await resolveStore(slug) : null;
    const rows = await rest<ListRow[]>(
      `products?id=eq.${externalId}&is_published_catalog=eq.true&select=${SELECT.productList}&limit=1`,
    );
    const row = rows[0];
    if (!row) return null;
    const cats = store ? await categoryMap(store.externalCompanyId) : new Map<string, string>();
    return fetchProductDetail(
      row,
      row.catalog_category_id ? cats.get(row.catalog_category_id) ?? null : null,
      store?.settings.checkout_mode ?? null,
    );
  },
};
