import { describe, expect, it } from "vitest";
import { demoExtraction, normalizeItem, parseExtraction } from "./extract";

describe("parseExtraction", () => {
  it("teste 15 — preço por quantidade vira tiers, não vários produtos", () => {
    const r = parseExtraction(
      JSON.stringify({
        items: [
          {
            name: "Panfleto 10x14",
            variationGroups: [],
            variants: [
              {
                options: {},
                priceKind: "per_quantity",
                priceTiers: [
                  { minQty: 500, price: 70 },
                  { minQty: 100, price: 20 },
                  { minQty: 1000, price: 120 },
                ],
              },
            ],
            confidence: "ok",
          },
        ],
      }),
    );
    expect(r.ok).toBe(true);
    expect(r.items).toHaveLength(1);
    const v = r.items[0].variants[0];
    expect(v.priceKind).toBe("per_quantity");
    expect(v.priceTiers?.map((t) => t.minQty)).toEqual([100, 500, 1000]); // ordenado
  });

  it("teste 14 — variação nomeada preserva a relação grupo→valor→preço", () => {
    const r = parseExtraction(
      JSON.stringify({
        items: [
          {
            name: "Cartão de visita",
            attributes: { tamanho: "9x5 cm" },
            variationGroups: [
              { name: "Gramatura", values: ["250g", "300g"] },
              { name: "Impressão", values: ["Frente", "Frente e verso"] },
            ],
            variants: [
              {
                options: { Gramatura: "250g", Impressão: "Frente e verso" },
                price: 39,
              },
            ],
            confidence: "ok",
          },
        ],
      }),
    );
    expect(r.ok).toBe(true);
    const v = r.items[0].variants[0];
    expect(v.optionLabels).toEqual(["250g", "Frente e verso"]); // ordem dos grupos
    expect(v.optionsByGroup).toEqual({ Gramatura: "250g", Impressão: "Frente e verso" });
    expect(v.price).toBe(39);
    expect(r.items[0].needsReview).toBe(false);
  });

  it("força revisão quando uma variante fica sem preço e não é 'quote'", () => {
    const r = parseExtraction(
      JSON.stringify({
        items: [
          {
            name: "Banner",
            variants: [{ options: {}, priceKind: "fixed", price: null }],
            confidence: "ok",
          },
        ],
      }),
    );
    expect(r.items[0].needsReview).toBe(true);
    expect(r.items[0].notes).toMatch(/sem preço/i);
  });

  it("JSON inválido → ok:false, nada importado", () => {
    expect(parseExtraction("desculpe, não consegui ler o PDF").ok).toBe(false);
  });

  it("estrutura fora do schema → ok:false", () => {
    expect(parseExtraction(JSON.stringify({ produtos: [] })).ok).toBe(false);
  });
});

describe("normalizeItem", () => {
  it("preço 'quote' sem valor NÃO força revisão", () => {
    const n = normalizeItem({
      name: "Serviço sob orçamento",
      description: null,
      category: null,
      kind: "service",
      attributes: {},
      variationGroups: [],
      variants: [
        {
          options: {},
          attributes: {},
          priceKind: "quote",
          price: null,
          priceTiers: null,
          quantity: null,
          minQuantity: null,
          unit: null,
          leadTimeDays: null,
          sku: null,
        },
      ],
      confidence: "ok",
      notes: null,
    });
    expect(n.needsReview).toBe(false);
  });
});

describe("demoExtraction", () => {
  it("é claramente sintética e válida no schema normalizado", () => {
    const items = demoExtraction();
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].description).toMatch(/sint[ée]tico|demo/i);
    expect(items.some((i) => i.needsReview)).toBe(true);
  });
});
