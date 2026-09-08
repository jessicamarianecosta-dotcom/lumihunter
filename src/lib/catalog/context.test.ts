import { describe, expect, it } from "vitest";
import {
  ANTI_INVENTION_RULE,
  deriveCommercialQuery,
  renderCommercialContext,
} from "./index";
import type { CommercialProduct, SearchOutcome } from "./types";

function product(over: Partial<CommercialProduct>): CommercialProduct {
  return {
    id: "p1",
    name: "Cartão de visita",
    description: null,
    category: "Gráfica",
    kind: "product",
    isActive: true,
    source: "manual",
    contributingSources: ["manual"],
    externalUrl: null,
    lastSyncedAt: null,
    needsReview: false,
    variants: [],
    priceRange: null,
    ...over,
  };
}

describe("deriveCommercialQuery", () => {
  it("teste 5/6 — extrai termo e especificações da mensagem do cliente", () => {
    const d = deriveCommercialQuery(
      "quero cartão de visita couché 300g frente e verso 100 un",
    );
    expect(d.query).toContain("cart");
    expect(d.specs.join(" ")).toMatch(/300\s?g/);
    expect(d.specs.join(" ").toLowerCase()).toContain("frente e verso");
  });

  it("não quebra com mensagem curta", () => {
    const d = deriveCommercialQuery("banner?");
    expect(d.query.length).toBeGreaterThan(0);
  });
});

describe("renderCommercialContext", () => {
  const base = (kind: SearchOutcome["kind"], products: CommercialProduct[] = []): SearchOutcome => ({
    kind,
    query: "cartão",
    products,
    sourcesChecked: [{ source: "manual", ok: true }],
  });

  it("teste 12 — NOT_FOUND instrui a NÃO inventar", () => {
    const txt = renderCommercialContext(base("NOT_FOUND"));
    expect(txt).toMatch(/NÃO invente/i);
  });

  it("SOURCE_UNAVAILABLE instrui a não inventar preço", () => {
    expect(renderCommercialContext(base("SOURCE_UNAVAILABLE"))).toMatch(
      /indispon[íi]vel|atendimento/i,
    );
  });

  it("teste 3/15 — FOUND renderiza preço fixo e tiers", () => {
    const p = product({
      variants: [
        {
          id: "v1",
          sku: null,
          optionLabels: ["Couché 250g", "Frente e verso"],
          attributes: {},
          priceKind: "fixed",
          price: 39,
          priceTiers: null,
          currency: "BRL",
          minQuantity: 100,
          leadTimeDays: 3,
          stockQuantity: null,
          notes: null,
          isActive: true,
          needsReview: false,
          source: "manual",
        },
        {
          id: "v2",
          sku: null,
          optionLabels: ["Panfleto"],
          attributes: {},
          priceKind: "per_quantity",
          price: null,
          priceTiers: [
            { min_qty: 100, price: 20 },
            { min_qty: 500, price: 70 },
          ],
          currency: "BRL",
          minQuantity: null,
          leadTimeDays: null,
          stockQuantity: null,
          notes: null,
          isActive: true,
          needsReview: false,
          source: "manual",
        },
      ],
    });
    const txt = renderCommercialContext(base("FOUND", [p]));
    expect(txt).toMatch(/R\$\s?39/);
    expect(txt).toMatch(/100un/);
    expect(txt).toMatch(/500un/);
  });

  it("teste 4 — variante sem preço é marcada como SEM PREÇO CADASTRADO", () => {
    const p = product({
      variants: [
        {
          id: "v1",
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
          source: "manual",
        },
      ],
    });
    expect(renderCommercialContext(base("FOUND", [p]))).toMatch(/SEM PREÇO CADASTRADO/);
  });

  it("teste 13 — só renderiza os produtos passados (nenhum dado de outro tenant)", () => {
    const txt = renderCommercialContext(base("FOUND", [product({ name: "Tag" })]));
    expect(txt).toContain("Tag");
    expect(txt).not.toContain("Cartão de visita");
  });
});

describe("ANTI_INVENTION_RULE", () => {
  it("cobre preço, especificação e disponibilidade", () => {
    expect(ANTI_INVENTION_RULE).toMatch(/pre[çc]o/i);
    expect(ANTI_INVENTION_RULE).toMatch(/disponibilidade/i);
    expect(ANTI_INVENTION_RULE).toMatch(/nunca/i);
  });
});
