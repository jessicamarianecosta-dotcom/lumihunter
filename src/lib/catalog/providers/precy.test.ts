import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseStoreSlug, precyCatalogProvider, resolveStore } from "./precy";

/**
 * Mock do PostgREST público do Precy+. As rotas são as EXATAS usadas pelo
 * storefront (confirmadas na auditoria).
 */
const STORE = "d8849d4d-5d09-4c87-b6df-44d1f0d8b7ad";

const PRODUCTS: Record<string, unknown> = {
  "467383e5": {
    id: "467383e5",
    name: "Caneca alça e interior colorida",
    description: "Caneca personalizada + caixa",
    final_price: 40,
    catalog_starting_price: null,
    catalog_promo_price: null,
    catalog_photos: ["p1.webp"],
    catalog_category_id: "cat-brindes",
    catalog_lead_time_days: 5,
    catalog_checkout_mode: "quote",
  },
  "aaa11111": {
    id: "aaa11111",
    name: "Adesivo em vinil",
    description: null,
    final_price: null,
    catalog_starting_price: 18,
    catalog_promo_price: null,
    catalog_photos: [],
    catalog_category_id: null,
    catalog_lead_time_days: null,
    catalog_checkout_mode: null,
  },
};

function jsonRes(data: unknown) {
  return { ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) };
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = new URL(url);
      const p = u.pathname.replace("/rest/v1/", "");
      const qs = u.search;

      if (p === "catalog_settings") {
        if (qs.includes("slug=eq.lumilife"))
          return jsonRes([{ company_id: STORE, slug: "lumilife", checkout_mode: "quote" }]);
        return jsonRes([]);
      }
      if (p === "catalog_categories")
        return jsonRes([{ id: "cat-brindes", name: "Brindes" }]);
      if (p === "products") {
        if (qs.includes(`company_id=eq.${STORE}`)) return jsonRes(Object.values(PRODUCTS));
        const idMatch = qs.match(/[?&]id=eq\.([a-z0-9]+)/);
        if (idMatch) {
          const prod = PRODUCTS[idMatch[1]];
          return jsonRes(prod ? [prod] : []);
        }
        return jsonRes([]);
      }
      if (p === "product_images") return jsonRes([]);
      if (p === "product_variation_groups") {
        if (qs.includes("467383e5"))
          return jsonRes([
            {
              id: "g-modelo",
              name: "Modelo",
              sort_order: 0,
              product_variation_options: [
                { id: "o-normal", group_id: "g-modelo", value: "Alça normal", sort_order: 0 },
                { id: "o-coracao", group_id: "g-modelo", value: "Alça de coração", sort_order: 1 },
              ],
            },
          ]);
        return jsonRes([]);
      }
      if (p === "product_variants") {
        if (qs.includes("467383e5"))
          return jsonRes([
            {
              id: "v1",
              sku: null,
              price: null, // → cai no preço base (40)
              stock_quantity: null,
              lead_time_days: null,
              sort_order: 0,
              product_variant_option_values: [{ option_id: "o-normal", group_id: "g-modelo" }],
            },
            {
              id: "v2",
              sku: "CAN-COR",
              price: 50,
              stock_quantity: null,
              lead_time_days: null,
              sort_order: 1,
              product_variant_option_values: [{ option_id: "o-coracao", group_id: "g-modelo" }],
            },
          ]);
        return jsonRes([]);
      }
      if (p === "product_variation_dependencies") return jsonRes([]);
      throw new Error(`rota não mockada: ${p}`);
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("parseStoreSlug", () => {
  it("extrai o slug", () => {
    expect(parseStoreSlug("https://precyplus.com.br/loja/lumilife")).toBe("lumilife");
    expect(parseStoreSlug("https://precyplus.com.br/loja/LumiLife/produto/x")).toBe("lumilife");
    expect(parseStoreSlug("https://precyplus.com.br")).toBeNull();
  });
});

describe("resolveStore", () => {
  it("slug → company_id (catalog_settings)", async () => {
    const s = await resolveStore("lumilife");
    expect(s?.externalCompanyId).toBe(STORE);
  });
  it("slug inexistente → null", async () => {
    expect(await resolveStore("naoexiste")).toBeNull();
  });
});

describe("precyCatalogProvider.testConnection", () => {
  it("conexão válida", async () => {
    const r = await precyCatalogProvider.testConnection({
      url: "https://precyplus.com.br/loja/lumilife",
    });
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/2 produto/);
  });
  it("URL inválida", async () => {
    const r = await precyCatalogProvider.testConnection({ url: "https://x.com" });
    expect(r.ok).toBe(false);
  });
  it("loja inexistente", async () => {
    const r = await precyCatalogProvider.testConnection({
      url: "https://precyplus.com.br/loja/naoexiste",
    });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/naoexiste/);
  });
});

describe("precyCatalogProvider.listProducts", () => {
  it("lista com variações e preços reais", async () => {
    const list = await precyCatalogProvider.listProducts({
      url: "https://precyplus.com.br/loja/lumilife",
    });
    expect(list).toHaveLength(2);
    const caneca = list.find((p) => /caneca/i.test(p.name))!;
    expect(caneca.category).toBe("Brindes");
    expect(caneca.basePrice).toBe(40);
    expect(caneca.checkoutMode).toBe("quote");
    expect(caneca.variationGroups[0].name).toBe("Modelo");
    // variante sem preço próprio → cai no preço base (40)
    const vNormal = caneca.variants.find((v) => v.optionExternalIds.includes("o-normal"))!;
    expect(vNormal.price).toBe(40);
    const vCoracao = caneca.variants.find((v) => v.optionExternalIds.includes("o-coracao"))!;
    expect(vCoracao.price).toBe(50);
  });

  it("produto só com catalog_starting_price", async () => {
    const list = await precyCatalogProvider.listProducts({
      url: "https://precyplus.com.br/loja/lumilife",
    });
    const adesivo = list.find((p) => /adesivo/i.test(p.name))!;
    expect(adesivo.startingPrice).toBe(18);
    expect(adesivo.basePrice).toBeNull();
  });
});

describe("precyCatalogProvider.getProduct", () => {
  it("produto existente", async () => {
    const p = await precyCatalogProvider.getProduct(
      { url: "https://precyplus.com.br/loja/lumilife" },
      "467383e5",
    );
    expect(p?.name).toMatch(/caneca/i);
  });
  it("produto inexistente → null", async () => {
    const p = await precyCatalogProvider.getProduct(
      { url: "https://precyplus.com.br/loja/lumilife" },
      "zzz",
    );
    expect(p).toBeNull();
  });
});
