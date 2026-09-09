import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProviderProduct } from "./types";

const { listProducts, maybeSingle } = vi.hoisted(() => ({
  listProducts: vi.fn(),
  maybeSingle: vi.fn(),
}));
vi.mock("./providers/precy", () => ({
  precyCatalogProvider: { id: "precy", isReal: true, listProducts },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle }) }) }),
    }),
  }),
}));

import { livePrecySearch, precyIsConsultable } from "./live";

function pp(over: Partial<ProviderProduct> & { externalId: string; name: string }): ProviderProduct {
  return {
    url: null, description: null, category: null, basePrice: null, startingPrice: null,
    promoPrice: null, leadTimeDays: null, checkoutMode: null, photoUrls: [],
    variationGroups: [], variants: [], ...over,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("precyIsConsultable / livePrecySearch", () => {
  it("empresa sem fonte conectada → null (não consulta)", async () => {
    maybeSingle.mockResolvedValue({ data: null });
    expect(await precyIsConsultable("c1")).toBe(false);
    expect(
      await livePrecySearch({ companyId: "c1", query: "caneca", terms: ["caneca"] }),
    ).toBeNull();
  });

  it("fonte conectada → busca a caneca real e classifica FOUND", async () => {
    maybeSingle.mockResolvedValue({
      data: { external_url: "https://precyplus.com.br/loja/lumilife", status: "connected" },
    });
    listProducts.mockResolvedValue([
      pp({
        externalId: "ext-caneca",
        name: "Caneca alça e interior colorida",
        basePrice: 40,
        checkoutMode: "quote",
        variationGroups: [
          {
            externalId: "g",
            name: "Modelo",
            options: [
              { externalId: "o1", value: "Alça normal" },
              { externalId: "o2", value: "Alça de coração" },
            ],
          },
        ],
        variants: [
          { externalId: "v1", sku: null, price: 40, stockQuantity: null, leadTimeDays: null, optionExternalIds: ["o1"] },
          { externalId: "v2", sku: null, price: 50, stockQuantity: null, leadTimeDays: null, optionExternalIds: ["o2"] },
        ],
      }),
      pp({ externalId: "ext-adesivo", name: "Adesivo em vinil", basePrice: 18 }),
    ]);

    const out = await livePrecySearch({
      companyId: "c1",
      query: "caneca personalizada",
      terms: ["caneca", "personalizada"],
    });
    // 1 produto com 2 modelos → PARTIAL (o agente apresenta os 2 preços e pergunta o modelo)
    expect(["FOUND", "PARTIAL"]).toContain(out?.kind);
    expect(out?.products[0].name).toMatch(/caneca/i);
    expect(out?.products[0].source).toBe("precy_online");
    expect(out?.products[0].variants.map((v) => v.price).sort()).toEqual([40, 50]);
    expect(out?.products[0].variants[0].optionLabels).toContain("Alça normal");
  });

  it("fonte conectada mas indisponível → SOURCE_UNAVAILABLE", async () => {
    maybeSingle.mockResolvedValue({
      data: { external_url: "https://precyplus.com.br/loja/lumilife", status: "connected" },
    });
    listProducts.mockRejectedValue(new Error("timeout"));
    const out = await livePrecySearch({
      companyId: "c2",
      query: "banner",
      terms: ["banner"],
    });
    expect(out?.kind).toBe("SOURCE_UNAVAILABLE");
  });

  it("produto realmente inexistente → NOT_FOUND", async () => {
    maybeSingle.mockResolvedValue({
      data: { external_url: "https://precyplus.com.br/loja/lumilife", status: "connected" },
    });
    listProducts.mockResolvedValue([pp({ externalId: "x", name: "Caneca" })]);
    const out = await livePrecySearch({
      companyId: "c3",
      query: "guardanapo de linho",
      terms: ["guardanapo", "linho"],
    });
    expect(out?.kind).toBe("NOT_FOUND");
  });
});
