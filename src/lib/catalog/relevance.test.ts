import { describe, expect, it } from "vitest";
import { deriveCommercialQuery, renderCommercialContext } from "./index";
import {
  classifySearch,
  groupProductFamilies,
  relevantMatches,
} from "./resolve";
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
function p(name: string, variants: CommercialVariant[] = [v([], 10)]): CommercialProduct {
  const prices = variants.filter((x) => typeof x.price === "number").map((x) => x.price as number);
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
    priceRange: prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
  };
}

// catálogo real da LumiLife (nomes verbatim do Precy+)
const CATALOG: CommercialProduct[] = [
  p("Camiseta Personalizada com DTF Têxtil", [v(["P"], 55), v(["G"], 55)]),
  p("Caneca alça e interior colorida + caixa personalizada", [
    v(["Alça normal"], 40),
    v(["Alça de coração"], 50),
  ]),
  p("Caneca branca personalizada + caixa personalizada", [
    v(["Alça normal"], 30),
    v(["Alça de coração"], 40),
  ]),
  p("Caneca transparente personalizada + caixa personalizada", [v([], 35)]),
  p("Adesivo em vinil a prova d'água", [v([], 18)]),
  p("Panfleto 10x14- papel fotográfico brilho 115gr 100un", [v([], 35)]),
  p("Panfleto 10x14- papel fotográfico brilho 115gr 300un", [v([], 70)]),
  p("Panfleto 10x14- papel fotográfico brilho 115gr 500un", [v([], 115)]),
  p("Panfleto 10x14- papel fotográfico brilho dupla face 115gr 100un", [v([], 45)]),
  p("Panfleto 10x14- papel fotográfico brilho dupla face 115gr 300un", [v([], 90)]),
];
const src = [{ source: "precy_online" as const, ok: true }];

function ask(message: string, catalog = CATALOG) {
  const d = deriveCommercialQuery(message);
  const rel = relevantMatches(catalog, d.terms);
  return {
    d,
    outcome: classifySearch({
      query: d.query,
      matches: rel,
      requestedSpecs: d.specs,
      sourcesChecked: src,
    }),
  };
}

describe("deriveCommercialQuery — descritores genéricos não identificam produto", () => {
  it("'caneca personalizada' → terms = ['caneca'] (personalizada é genérico)", () => {
    expect(deriveCommercialQuery("Quanto custa uma caneca personalizada?").terms).toEqual([
      "caneca",
    ]);
  });
  it("'quanto custa?' → sem termos", () => {
    expect(deriveCommercialQuery("quanto custa?").terms).toEqual([]);
  });
});

describe("REGRESSÃO — 'caneca' nunca retorna camiseta/panfleto", () => {
  it("1) 'quanto custa uma caneca personalizada?' → só canecas, AMBIGUOUS", () => {
    const { outcome } = ask("Quanto custa uma caneca personalizada?");
    expect(outcome.kind).toBe("AMBIGUOUS");
    const names = outcome.products.map((x) => x.name).join(" | ").toLowerCase();
    expect(names).not.toMatch(/camiseta/);
    expect(names).not.toMatch(/panfleto/);
    expect(names).not.toMatch(/adesivo/);
    expect(outcome.products.every((x) => /caneca/i.test(x.name))).toBe(true);
    expect(outcome.products).toHaveLength(3);
  });

  it("2) 'quero a branca' (acumulado) → isola a Caneca branca → PARTIAL alça", () => {
    const { outcome } = ask("caneca personalizada · quero a branca");
    expect(outcome.kind).toBe("PARTIAL");
    expect(outcome.products[0].name).toMatch(/branca/i);
    expect(outcome.missingSpecs).toEqual(
      expect.arrayContaining(["Alça normal", "Alça de coração"]),
    );
  });

  it("3) '... alça de coração' → FOUND só a variante (R$ 40)", () => {
    const { outcome } = ask("caneca personalizada branca alça de coração");
    expect(outcome.kind).toBe("FOUND");
    expect(outcome.products[0].variants).toHaveLength(1);
    expect(outcome.products[0].variants[0].price).toBe(40);
  });

  it("4) 'quanto custa uma camiseta?' → só a camiseta", () => {
    const { outcome } = ask("Quanto custa uma camiseta personalizada?");
    expect(outcome.products.every((x) => /camiseta/i.test(x.name))).toBe(true);
  });

  it("5) 'tem guardanapo de linho?' → NOT_FOUND, sem sugerir outros", () => {
    const { outcome } = ask("vocês tem guardanapo de linho?");
    expect(outcome.kind).toBe("NOT_FOUND");
    expect(outcome.products).toHaveLength(0);
    const ctx = renderCommercialContext(outcome);
    expect(ctx).not.toMatch(/caneca|camiseta|panfleto/i);
    expect(ctx).toMatch(/NUNCA ofereça outros produtos/i);
  });
});

describe("família de produto — panfletos com quantidades viram 1 produto", () => {
  it("'quanto custa um panfleto?' → 1 família com N variantes → PARTIAL", () => {
    const { outcome } = ask("Quanto custa um panfleto 10x14?");
    expect(outcome.kind).toBe("PARTIAL");
    expect(outcome.products).toHaveLength(1);
    expect(outcome.products[0].name.toLowerCase()).toContain("panfleto");
    expect(outcome.products[0].variants.length).toBeGreaterThanOrEqual(5);
    const ctx = renderCommercialContext(outcome);
    expect(ctx).toMatch(/R\$\s?35/);
    expect(ctx).toMatch(/R\$\s?115/);
  });

  it("canecas com nomes distintos NÃO são agrupadas", () => {
    const g = groupProductFamilies(CATALOG.filter((x) => /caneca/i.test(x.name)));
    expect(g).toHaveLength(3);
  });
});

describe("relevantMatches — piso de relevância", () => {
  it("nenhum termo casa → [] (vira NOT_FOUND)", () => {
    expect(relevantMatches(CATALOG, ["mochila"])).toHaveLength(0);
  });
  it("termo específico casa → só os que contêm", () => {
    const r = relevantMatches(CATALOG, ["adesivo"]);
    expect(r).toHaveLength(1);
    expect(r[0].name).toMatch(/adesivo/i);
  });
});
