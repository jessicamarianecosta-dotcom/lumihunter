import { describe, it, expect } from "vitest";
import { expandRegions, hasKnownDistricts } from "./regions";
import { planNextBatch, applyBatch, capacityRemaining, type ScaleState } from "./scale";
import { buildScaleQueries } from "./queries";
import type { CampaignBrief } from "./types";

describe("expandRegions", () => {
  it("quebra cidade grande conhecida em bairros, cidade inteira primeiro", () => {
    const u = expandRegions(["Curitiba"], 10);
    expect(u[0]).toEqual({ label: "Curitiba", city: "Curitiba", district: null });
    expect(u.length).toBe(10);
    expect(u.some((x) => x.label === "Batel, Curitiba")).toBe(true);
  });

  it("cidade desconhecida devolve só ela mesma", () => {
    expect(expandRegions(["Pato Branco"])).toEqual([
      { label: "Pato Branco", city: "Pato Branco", district: null },
    ]);
  });

  it("é case/acento-insensível", () => {
    expect(hasKnownDistricts("SÃO PAULO")).toBe(true);
    expect(hasKnownDistricts("curitiba")).toBe(true);
    expect(hasKnownDistricts("Xanadu")).toBe(false);
  });
});

const brief = (over: Partial<CampaignBrief> = {}): CampaignBrief => ({
  id: "c1",
  companyId: "co1",
  name: "Camp",
  product: "adesivo vinil",
  productContext: {
    name: "adesivo vinil",
    description: null,
    category: null,
    keywords: [],
    applications: [],
    useCases: [],
    exampleBuyers: [],
    idealAudience: null,
    variantNames: [],
    catalogProducts: [],
    source: "text",
  },
  buyerProfile: { buyerSegments: ["confeitaria", "hortifruti"], excludedProfiles: [], source: "heuristic" },
  audience: "confeitarias",
  regions: ["Curitiba"],
  channel: "whatsapp",
  channelRequirement: "whatsapp",
  ...over,
});

describe("buildScaleQueries", () => {
  it("gera segmento × bairro × intenção, sem citar o produto", () => {
    const qs = buildScaleQueries(brief());
    expect(qs.length).toBeGreaterThan(30);
    expect(qs).toContain("confeitaria Curitiba");
    expect(qs.some((q) => q.includes("Batel, Curitiba"))).toBe(true);
    expect(qs.some((q) => /adesivo|vinil/i.test(q))).toBe(false);
  });

  it("cidade inteira vem antes dos bairros", () => {
    const qs = buildScaleQueries(brief());
    const wide = qs.findIndex((q) => q === "confeitaria Curitiba");
    const deep = qs.findIndex((q) => q.includes("Batel, Curitiba"));
    expect(wide).toBeLessThan(deep);
  });

  it("respeita o teto", () => {
    expect(buildScaleQueries(brief(), { maxQueries: 20 }).length).toBe(20);
  });
});

describe("planNextBatch / applyBatch", () => {
  const base: ScaleState = {
    pendingQueries: ["a", "b", "c", "d"],
    usedQueries: [],
    batchCount: 0,
    candidatesCount: 0,
    targetOpportunities: 100,
  };

  it("fatia o próximo batch", () => {
    expect(planNextBatch(base, 2)).toEqual({ queries: ["a", "b"], done: false });
  });

  it("para ao atingir o alvo", () => {
    const s = { ...base, candidatesCount: 100 };
    expect(planNextBatch(s)).toEqual({ queries: [], done: true, reason: "target_reached" });
  });

  it("para ao esgotar as consultas", () => {
    const s = { ...base, pendingQueries: [] };
    expect(planNextBatch(s)).toEqual({ queries: [], done: true, reason: "queries_exhausted" });
  });

  it("applyBatch remove as usadas e soma candidatos", () => {
    const next = applyBatch(base, ["a", "b"], 5);
    expect(next.pendingQueries).toEqual(["c", "d"]);
    expect(next.usedQueries).toEqual(["a", "b"]);
    expect(next.batchCount).toBe(1);
    expect(next.candidatesCount).toBe(5);
  });
});

describe("capacityRemaining (excedentes)", () => {
  it("meta cheia: nada cabe", () => {
    expect(capacityRemaining(500, 500)).toBe(0);
    expect(capacityRemaining(530, 500)).toBe(0); // já passou da meta em batches anteriores
  });

  it("meta parcial: sobra exatamente a diferença", () => {
    expect(capacityRemaining(338, 500)).toBe(162);
  });

  it("nenhum aprovado ainda: cabe a meta inteira", () => {
    expect(capacityRemaining(0, 500)).toBe(500);
  });
});
