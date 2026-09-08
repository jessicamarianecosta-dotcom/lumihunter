/**
 * PrecyCatalogProvider — leitura do catálogo online do Precy+.
 *
 * ⚠️  DESLIGADO POR PADRÃO. Só entra em ação com `PRECY_ENABLED=true`.
 * A conexão real depende de confirmar com o Precy+ o método suportado
 * (ver "Estado da integração" abaixo). Até lá o registry (`providers/index.ts`)
 * NÃO expõe este provider.
 *
 * ── O que a análise técnica de `https://precyplus.com.br/loja/lumilife`
 *    encontrou (Fase 0 / Etapa 2) ──────────────────────────────────────────
 *
 * O Precy+ é um Next.js (App Router) sobre Supabase
 * (projeto `ekynvecruqpuwwrcwtnp`). A PÁGINA DE PRODUTO busca os dados
 * client-side, direto no PostgREST público do Supabase deles, com uma anon key
 * embutida no bundle JS (role "anon", protegida por RLS: filtro
 * `is_published_catalog=eq.true`). Chamadas observadas, por produto:
 *
 *   GET /rest/v1/products
 *       ?select=id,name,description,final_price,catalog_starting_price,
 *               catalog_promo_price,catalog_photos,catalog_lead_time_days,
 *               catalog_checkout_mode,catalog_category_id
 *       &id=eq.<uuid>&is_published_catalog=eq.true
 *
 *   GET /rest/v1/product_images
 *       ?select=id,url,sort_order&product_id=eq.<uuid>&order=sort_order.asc
 *
 *   GET /rest/v1/product_variation_groups
 *       ?select=id,name,sort_order,
 *               product_variation_options(id,group_id,value,sort_order)
 *       &product_id=eq.<uuid>&order=sort_order.asc
 *
 *   GET /rest/v1/product_variants
 *       ?select=id,sku,price,stock_quantity,lead_time_days,image_id,sort_order,
 *               product_variant_option_values(option_id,group_id)
 *       &product_id=eq.<uuid>&is_active=eq.true&order=sort_order.asc
 *
 *   GET /rest/v1/product_variation_dependencies
 *       ?select=option_id,depends_on_option_id&product_id=eq.<uuid>
 *
 * A LISTAGEM da loja (`/loja/<slug>`) é renderizada NO SERVIDOR do Precy+
 * (RSC) — a query "todos os produtos publicados da loja <slug>" NÃO aparece no
 * cliente. Ou seja: `getProduct(id)` é conhecido; `listProducts()` depende de
 * confirmar com o Precy+ (coluna de dono/loja em `products`, ou um endpoint
 * dedicado).
 *
 * ── Estado da integração ─────────────────────────────────────────────────
 *  ✅ getProduct(externalId)          — mapeamento pronto (endpoints acima)
 *  ⛔ listProducts()/slug→loja         — PENDENTE: confirmar com o Precy+
 *  ⛔ usar a anon key do bundle deles  — PENDENTE: decisão/autorização
 */
import type {
  CatalogProvider,
  CatalogProviderConfig,
  ProviderProduct,
} from "../types";

/** Valores descobertos na análise — sobrescrevíveis por env. */
const PRECY_SUPABASE_URL =
  process.env.PRECY_SUPABASE_URL ?? "https://ekynvecruqpuwwrcwtnp.supabase.co";
const PRECY_SUPABASE_ANON_KEY = process.env.PRECY_SUPABASE_ANON_KEY ?? "";
const PRECY_ENABLED = process.env.PRECY_ENABLED === "true";

const P_SELECT = {
  product:
    "id,name,description,final_price,catalog_starting_price,catalog_promo_price,catalog_photos,catalog_lead_time_days,catalog_checkout_mode,catalog_category_id",
  images: "id,url,sort_order",
  groups:
    "id,name,sort_order,product_variation_options(id,group_id,value,sort_order)",
  variants:
    "id,sku,price,stock_quantity,lead_time_days,image_id,sort_order,product_variant_option_values(option_id,group_id)",
} as const;

interface PrecyProductRow {
  id: string;
  name: string;
  description: string | null;
  final_price: number | null;
  catalog_starting_price: number | null;
  catalog_promo_price: number | null;
  catalog_photos: string[] | null;
  catalog_lead_time_days: number | null;
  catalog_checkout_mode: string | null;
  catalog_category_id: string | null;
}
interface PrecyGroupRow {
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
interface PrecyVariantRow {
  id: string;
  sku: string | null;
  price: number | null;
  stock_quantity: number | null;
  lead_time_days: number | null;
  image_id: string | null;
  sort_order: number;
  product_variant_option_values: { option_id: string; group_id: string }[];
}

function assertUsable() {
  if (!PRECY_ENABLED) {
    throw new PrecyNotReadyError(
      "Integração Precy+ desligada (PRECY_ENABLED != true).",
    );
  }
  if (!PRECY_SUPABASE_ANON_KEY) {
    throw new PrecyNotReadyError(
      "PRECY_SUPABASE_ANON_KEY não configurada — método de acesso ao catálogo online do Precy+ ainda não confirmado.",
    );
  }
}

export class PrecyNotReadyError extends Error {}

async function rest<T>(path: string): Promise<T> {
  const res = await fetch(`${PRECY_SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: PRECY_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${PRECY_SUPABASE_ANON_KEY}`,
    },
    // server-side apenas
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Precy+ PostgREST ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

/** Extrai o slug da loja a partir da URL cadastrada. */
export function parseStoreSlug(url: string): string | null {
  const m = url.match(/\/loja\/([^/?#]+)/i);
  return m ? decodeURIComponent(m[1]) : null;
}

async function fetchProduct(externalId: string): Promise<ProviderProduct | null> {
  const [rows, images, groups, variants] = await Promise.all([
    rest<PrecyProductRow[]>(
      `products?select=${P_SELECT.product}&id=eq.${externalId}&is_published_catalog=eq.true`,
    ),
    rest<{ id: string; url: string; sort_order: number }[]>(
      `product_images?select=${P_SELECT.images}&product_id=eq.${externalId}&order=sort_order.asc`,
    ),
    rest<PrecyGroupRow[]>(
      `product_variation_groups?select=${P_SELECT.groups}&product_id=eq.${externalId}&order=sort_order.asc&product_variation_options.order=sort_order.asc`,
    ),
    rest<PrecyVariantRow[]>(
      `product_variants?select=${P_SELECT.variants}&product_id=eq.${externalId}&is_active=eq.true&order=sort_order.asc`,
    ),
  ]);

  const row = rows[0];
  if (!row) return null;

  return {
    externalId: row.id,
    name: row.name,
    url: null,
    description: row.description,
    category: row.catalog_category_id, // id — resolver nome numa etapa futura
    basePrice:
      row.catalog_promo_price ?? row.catalog_starting_price ?? row.final_price,
    leadTimeDays: row.catalog_lead_time_days,
    photoUrls: [
      ...(row.catalog_photos ?? []),
      ...images.map((i) => i.url),
    ],
    variationGroups: groups.map((g) => ({
      externalId: g.id,
      name: g.name,
      options: (g.product_variation_options ?? []).map((o) => ({
        externalId: o.id,
        value: o.value,
      })),
    })),
    variants: variants.map((v) => ({
      externalId: v.id,
      sku: v.sku,
      price: v.price,
      stockQuantity: v.stock_quantity,
      leadTimeDays: v.lead_time_days,
      optionExternalIds: (v.product_variant_option_values ?? []).map(
        (o) => o.option_id,
      ),
    })),
  };
}

export const precyCatalogProvider: CatalogProvider = {
  id: "precy",
  isReal: PRECY_ENABLED,

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
        message:
          "URL válida e reconhecida (loja \"" +
          slug +
          "\"). A sincronização automática depende de confirmar com o Precy+ o método oficial de acesso ao catálogo — por ora, use \"Abrir catálogo\".",
      };
    }
    try {
      // ping leve no PostgREST do Precy+
      await rest("products?select=id&limit=1&is_published_catalog=eq.true");
      return { ok: true, message: `Conectado ao catálogo da loja "${slug}".` };
    } catch (e) {
      return { ok: false, message: `Falha ao conectar: ${(e as Error).message}` };
    }
  },

  async listProducts(config: CatalogProviderConfig): Promise<ProviderProduct[]> {
    assertUsable();
    const slug = parseStoreSlug(config.url);
    // PENDENTE: a query "produtos publicados da loja <slug>" não é conhecida
    // (a listagem do Precy+ é server-side). Quando o Precy+ confirmar a coluna
    // de loja/dono em `products` (ou um endpoint), implementar aqui.
    throw new PrecyNotReadyError(
      `listProducts ainda não implementado para a loja "${slug}": ` +
        "falta confirmar com o Precy+ como listar os produtos publicados de uma loja. " +
        "getProduct(externalId) já funciona.",
    );
  },

  async getProduct(config: CatalogProviderConfig, externalId: string) {
    assertUsable();
    return fetchProduct(externalId);
  },
};
