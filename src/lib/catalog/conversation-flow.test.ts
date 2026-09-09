import { describe, expect, it } from "vitest";
import { classifySearch, narrowByQueryOverlap } from "./resolve";
import { renderCommercialContext } from "./index";
const renderFromIndex = renderCommercialContext;
import type { CommercialProduct, CommercialVariant } from "./types";

function v(labels: string[], price: number | null): CommercialVariant {
  return {
    id: labels.join("-") || "base",
    sku: null,
    optionLabels: labels,
    attributes: {},
    priceKind: price == null ? "quote" : "fixed",
    price,
    priceTiers: null,
    currency: "BRL",
    minQuantity: null,
    leadTimeDays: null,
    stockQuantity: null,
    notes: null,
    isActive: true,
    needsReview: false,
    source: "precy_online",
  };
}
function prod(name: string, variants: CommercialVariant[]): CommercialProduct {
  return {
    id: name,
    name,
    description: null,
    category: null,
    kind: "product",
    isActive: true,
    source: "precy_online",
    contributingSources: ["precy_online"],
    externalUrl: null,
    lastSyncedAt: null,
    needsReview: false,
    variants,
    priceRange: null,
  };
}

// catálogo de canecas da LumiLife
const BRANCA = prod("Caneca branca personalizada + caixa personalizada", [
  v(["Alça normal"], 30),
  v(["Alça de coração"], 40),
]);
const TRANSP = prod("Caneca transparente personalizada + caixa personalizada", [
  v([], 35),
]);
const COLORIDA = prod("Caneca alça e interior colorida + caixa personalizada", [
  v(["Alça normal"], 40),
  v(["Alça de coração"], 50),
]);
const ALL = [BRANCA, TRANSP, COLORIDA];
const src = [{ source: "precy_online" as const, ok: true }];

function classify(query: string, matches: CommercialProduct[]) {
  const words = query.toLowerCase().split(/\s+/);
  return classifySearch({
    query,
    matches: narrowByQueryOverlap(matches, words),
    sourcesChecked: src,
  });
}

describe("fluxo produto → modelo → variação (caso caneca)", () => {
  it("1) 'quanto custa uma caneca personalizada?' → AMBIGUOUS com os 3 modelos", () => {
    const out = classify("caneca personalizada", ALL);
    expect(out.kind).toBe("AMBIGUOUS");
    expect(out.products).toHaveLength(3);
    const ctx = renderCommercialContext(out);
    // todas as opções aparecem, com instrução de perguntar e não citar preço ainda
    expect(ctx).toMatch(/branca/i);
    expect(ctx).toMatch(/transparente/i);
    expect(ctx).toMatch(/colorida/i);
    expect(ctx).toMatch(/PERGUNTAR qual|pergunte/i);
    expect(ctx).toMatch(/NÃO cite preço ainda/i);
  });

  it("2) '... a branca' → narrowByQueryOverlap isola a caneca branca → PARTIAL (alça)", () => {
    const out = classify("caneca personalizada branca", ALL);
    expect(out.kind).toBe("PARTIAL");
    expect(out.products).toHaveLength(1);
    expect(out.products[0].name).toMatch(/branca/i);
    expect(out.missingSpecs).toEqual(
      expect.arrayContaining(["Alça normal", "Alça de coração"]),
    );
    const ctx = renderCommercialContext(out);
    expect(ctx).toMatch(/R\$\s?30/);
    expect(ctx).toMatch(/R\$\s?40/);
  });

  it("3) '... alça de coração' → FOUND só a variante escolhida (R$ 40)", () => {
    const out = classify("caneca personalizada branca alça de coração", ALL);
    expect(out.kind).toBe("FOUND");
    expect(out.products[0].name).toMatch(/branca/i);
    expect(out.products[0].variants).toHaveLength(1);
    expect(out.products[0].variants[0].price).toBe(40);
  });

  it("produto único (cartão de visita) → FOUND direto, sem perguntar modelo", () => {
    const cartao = prod("Cartão de visita", [v([], 35)]);
    const out = classify("cartao de visita", [cartao]);
    expect(out.kind).toBe("FOUND");
  });
});

describe("narrowByQueryOverlap", () => {
  it("mantém todos quando empatam (pergunta genérica)", () => {
    expect(narrowByQueryOverlap(ALL, ["caneca"])).toHaveLength(3);
  });
  it("isola quando uma palavra separa", () => {
    const n = narrowByQueryOverlap(ALL, ["caneca", "transparente"]);
    expect(n).toHaveLength(1);
    expect(n[0].name).toMatch(/transparente/i);
  });
});

describe("REPLY_RULE — as 3 respostas são 3 redações da mesma resposta", () => {
  it("o contexto instrui explicitamente isso em qualquer outcome", () => {
    for (const q of ["caneca personalizada", "caneca personalizada branca"]) {
      const ctx = renderFromIndex(classify(q, ALL));
      expect(ctx).toMatch(/3 REDAÇÕES ALTERNATIVAS da MESMA resposta/i);
      expect(ctx).toMatch(/NUNCA use uma resposta para um produto e outra para outro/i);
    }
  });
});

describe("preço por quantidade dentro de 1 produto", () => {
  it("FOUND mostra os tiers, não vira ambiguidade", () => {
    const panfleto = prod("Panfleto 10x14", [
      {
        ...v([], null),
        priceKind: "per_quantity",
        priceTiers: [
          { min_qty: 100, price: 35 },
          { min_qty: 500, price: 115 },
        ],
      },
    ]);
    const out = classify("panfleto", [panfleto]);
    expect(out.kind).toBe("FOUND");
    const ctx = renderCommercialContext(out);
    expect(ctx).toMatch(/100un/);
    expect(ctx).toMatch(/500un/);
  });
});
