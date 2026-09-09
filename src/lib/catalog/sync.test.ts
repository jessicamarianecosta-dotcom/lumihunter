import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProviderProduct } from "./types";

// mocka o provider e o admin client usado por logCatalogEvent
vi.mock("./providers/precy", () => ({
  precyCatalogProvider: { id: "precy", isReal: true, listProducts: vi.fn() },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ insert: async () => ({}) }) }),
}));

import { precyCatalogProvider } from "./providers/precy";
import { syncPrecyCatalog } from "./sync";

function pp(over: Partial<ProviderProduct> & { externalId: string; name: string }): ProviderProduct {
  return {
    url: null,
    description: null,
    category: null,
    basePrice: null,
    startingPrice: null,
    promoPrice: null,
    leadTimeDays: null,
    checkoutMode: null,
    photoUrls: [],
    variationGroups: [],
    variants: [],
    ...over,
  };
}

/** Fake do supabase client — thenable, registra inserts/updates. */
function makeDb(opts: {
  source: { id: string; external_url: string; status: string } | null;
  existingProducts: { id: string; external_id: string; price_avg: number | null; is_active: boolean }[];
}) {
  const log = { productUpserts: [] as Record<string, unknown>[], updates: [] as Record<string, unknown>[], variantInserts: 0 };
  let idc = 0;

  function builder(table: string) {
    const state: { op?: string; payload?: unknown } = {};
    const chain: Record<string, unknown> = {};
    const ret = (data: unknown) => ({ data, error: null });

    const methods = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      maybeSingle: async () => {
        if (table === "catalog_sources") return ret(opts.source);
        return ret(null);
      },
      single: async () => {
        if (state.op === "insert" || state.op === "upsert") {
          idc += 1;
          if (table === "products") log.productUpserts.push(state.payload as Record<string, unknown>);
          return ret({ id: `${table}-${idc}` });
        }
        return ret(null);
      },
      insert: (payload: unknown) => {
        state.op = "insert";
        state.payload = payload;
        if (table === "product_variants") log.variantInserts += 1;
        return chain;
      },
      upsert: (payload: unknown) => {
        state.op = "upsert";
        state.payload = payload;
        return chain;
      },
      update: (payload: unknown) => {
        state.op = "update";
        log.updates.push({ table, ...(payload as Record<string, unknown>) });
        return chain;
      },
      delete: () => {
        state.op = "delete";
        return chain;
      },
      then: (resolve: (v: unknown) => void) => {
        // await direto no builder (ex.: select().eq().eq())
        if (table === "products" && state.op === undefined)
          return resolve(ret(opts.existingProducts));
        return resolve(ret(null));
      },
    };
    Object.assign(chain, methods);
    return chain;
  }

  return { client: { from: (t: string) => builder(t) }, log };
}

afterEach(() => vi.clearAllMocks());

describe("syncPrecyCatalog", () => {
  it("sem URL configurada → erro", async () => {
    const { client } = makeDb({ source: null, existingProducts: [] });
    const r = await syncPrecyCatalog("c1", client as never);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/URL/i);
  });

  it("cria produtos novos, detecta atualização e mudança de preço, e remoção", async () => {
    (precyCatalogProvider.listProducts as ReturnType<typeof vi.fn>).mockResolvedValue([
      pp({ externalId: "ext-caneca", name: "Caneca", basePrice: 40, checkoutMode: "quote" }),
      pp({
        externalId: "ext-cartao",
        name: "Cartão",
        basePrice: 39,
        variants: [
          { externalId: "v1", sku: null, price: 39, stockQuantity: null, leadTimeDays: null, optionExternalIds: [] },
        ],
      }),
    ]);

    const { client, log } = makeDb({
      source: { id: "s1", external_url: "https://precyplus.com.br/loja/lumilife", status: "connected" },
      existingProducts: [
        { id: "p-cartao", external_id: "ext-cartao", price_avg: 30, is_active: true }, // preço mudou 30→39
        { id: "p-antigo", external_id: "ext-removido", price_avg: 10, is_active: true }, // sumiu do catálogo
      ],
    });

    const r = await syncPrecyCatalog("c1", client as never);

    expect(r.ok).toBe(true);
    expect(r.found).toBe(2);
    expect(r.created).toBe(1); // caneca
    expect(r.updated).toBe(1); // cartão
    expect(r.priceChanged).toBe(1); // 30 → 39
    expect(r.removed).toBe(1); // ext-removido desativado
    // caneca sem variantes + checkout quote → 1 variante "padrão"
    expect(log.variantInserts).toBeGreaterThanOrEqual(2);
    // fonte marcada como connected com contadores
    const srcUpdate = log.updates.find(
      (u) => u.table === "catalog_sources" && u.status === "connected",
    );
    expect(srcUpdate).toBeTruthy();
  });
});
