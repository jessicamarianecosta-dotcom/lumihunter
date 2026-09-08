import { describe, expect, it } from "vitest";
import {
  classifySearch,
  mergeProductSources,
  priceRangeOf,
  resolvePriceConflict,
} from "./resolve";
import type {
  CatalogSourceKind,
  CommercialProduct,
  CommercialVariant,
} from "./types";

function variant(p: Partial<CommercialVariant> & { source: CatalogSourceKind }): CommercialVariant {
  return {
    id: Math.random().toString(36).slice(2),
    sku: null,
    optionLabels: [],
    attributes: {},
    priceKind: "fixed",
    price: null,
    priceTiers: null,
    currency: "BRL",
    minQuantity: null,
    leadTimeDays: null,
    stockQuantity: null,
    notes: null,
    isActive: true,
    needsReview: false,
    ...p,
  };
}

function product(p: Partial<CommercialProduct> & { source: CatalogSourceKind }): CommercialProduct {
  return {
    id: "p1",
    name: "Cartão de visita",
    description: null,
    category: null,
    kind: "product",
    isActive: true,
    contributingSources: [p.source],
    externalUrl: null,
    lastSyncedAt: null,
    needsReview: false,
    variants: [],
    priceRange: null,
    ...p,
  };
}

describe("resolvePriceConflict", () => {
  it("teste 5 — conflito de preço: Precy+ vence o PDF", () => {
    const r = resolvePriceConflict([
      { source: "pdf", price: 35 },
      { source: "precy_online", price: 39 },
    ]);
    expect(r.price).toBe(39);
    expect(r.source).toBe("precy_online");
    expect(r.conflict).toBe(true);
  });

  it("usa a próxima fonte quando a principal não tem preço", () => {
    const r = resolvePriceConflict([
      { source: "precy_online", price: null },
      { source: "pdf", price: 35 },
    ]);
    expect(r.price).toBe(35);
    expect(r.source).toBe("pdf");
    expect(r.conflict).toBe(false);
  });

  it("sem nenhum preço → null", () => {
    expect(resolvePriceConflict([{ source: "manual", price: null }]).price).toBeNull();
  });
});

describe("mergeProductSources", () => {
  it("teste 4 — produto nas 3 fontes: consolida sem apagar descrição complementar", () => {
    const merged = mergeProductSources([
      product({ source: "manual", description: "Descrição detalhada feita à mão" }),
      product({ source: "pdf", description: null }),
      product({
        source: "precy_online",
        description: null,
        variants: [variant({ source: "precy_online", price: 39, optionLabels: ["Couché 250g"] })],
      }),
    ]);
    expect(merged.source).toBe("precy_online");
    expect(merged.description).toBe("Descrição detalhada feita à mão");
    expect(merged.contributingSources).toEqual([
      "precy_online",
      "pdf",
      "manual",
    ]);
  });

  it("teste 5 — mesma variante em PDF e Precy+ com preço diferente → Precy+", () => {
    const merged = mergeProductSources([
      product({
        source: "pdf",
        variants: [variant({ source: "pdf", price: 35, optionLabels: ["Couché 250g", "Frente e verso"] })],
      }),
      product({
        source: "precy_online",
        variants: [
          variant({ source: "precy_online", price: 39, optionLabels: ["Frente e verso", "Couché 250g"] }),
        ],
      }),
    ]);
    expect(merged.variants).toHaveLength(1);
    expect(merged.variants[0].price).toBe(39);
  });
});

describe("priceRangeOf", () => {
  it("ignora variantes inativas e sem preço", () => {
    expect(
      priceRangeOf([
        variant({ source: "manual", price: 10 }),
        variant({ source: "manual", price: 50 }),
        variant({ source: "manual", price: 999, isActive: false }),
        variant({ source: "manual", price: null }),
      ]),
    ).toEqual({ min: 10, max: 50 });
  });
});

describe("classifySearch", () => {
  const sources = [{ source: "manual" as const, ok: true }];

  it("teste 6 — produto inexistente → NOT_FOUND", () => {
    const r = classifySearch({ query: "guardanapo de linho", matches: [], sourcesChecked: sources });
    expect(r.kind).toBe("NOT_FOUND");
  });

  it("teste 10 — fonte fora do ar e sem matches → SOURCE_UNAVAILABLE", () => {
    const r = classifySearch({
      query: "cartão",
      matches: [],
      sourcesChecked: [{ source: "precy_online", ok: false }],
    });
    expect(r.kind).toBe("SOURCE_UNAVAILABLE");
  });

  it("teste 9 — vários produtos → AMBIGUOUS", () => {
    const r = classifySearch({
      query: "caneca",
      matches: [product({ source: "manual", id: "a" }), product({ source: "manual", id: "b" })],
      sourcesChecked: sources,
    });
    expect(r.kind).toBe("AMBIGUOUS");
  });

  it("teste 7 — especificação inexistente (couché 300g) → PARTIAL com alternativas reais", () => {
    const p = product({
      source: "manual",
      variants: [
        variant({ source: "manual", price: 39, optionLabels: ["Couché 250g", "Frente e verso"] }),
      ],
    });
    const r = classifySearch({
      query: "cartão de visita",
      matches: [p],
      requestedSpecs: ["couché 300g"],
      sourcesChecked: sources,
    });
    expect(r.kind).toBe("PARTIAL");
    expect(r.products[0].variants).toHaveLength(1);
  });

  it("teste 1 — produto manual com variante que casa a spec → FOUND", () => {
    const p = product({
      source: "manual",
      variants: [
        variant({ source: "manual", price: 39, optionLabels: ["Couché 250g", "Frente e verso"] }),
      ],
    });
    const r = classifySearch({
      query: "cartão de visita",
      matches: [p],
      requestedSpecs: ["couché 250g", "frente e verso"],
      sourcesChecked: sources,
    });
    expect(r.kind).toBe("FOUND");
  });
});
