import { describe, it, expect, vi } from "vitest";
import { expandSearchStrategy, normalizeExpansionState, DEFAULT_EXPANSION_STATE } from "./expand";
import type { CampaignBrief } from "./types";

vi.mock("@/lib/ai", () => ({
  isAiDemoMode: vi.fn().mockResolvedValue(true), // sem IA nestes testes — camada 2 fica vazia
  generateText: vi.fn(),
}));

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
  buyerProfile: { buyerSegments: ["confeitaria"], excludedProfiles: [], source: "heuristic" },
  audience: "confeitarias",
  regions: ["Curitiba"],
  channel: "whatsapp",
  channelRequirement: "whatsapp",
  ...over,
});

describe("normalizeExpansionState", () => {
  it("aplica defaults para valor vazio/inválido", () => {
    expect(normalizeExpansionState({})).toEqual(DEFAULT_EXPANSION_STATE);
    expect(normalizeExpansionState(null)).toEqual(DEFAULT_EXPANSION_STATE);
    expect(normalizeExpansionState(undefined)).toEqual(DEFAULT_EXPANSION_STATE);
  });

  it("preserva estado salvo", () => {
    const saved = { layer: 2, extraSegments: ["boutique"], districtCap: 40 };
    expect(normalizeExpansionState(saved)).toEqual(saved);
  });
});

describe("expandSearchStrategy", () => {
  it("camada 1: gera variações de intenção sobre os mesmos segmentos/região", async () => {
    const r = await expandSearchStrategy({
      companyId: "co1",
      brief: brief(),
      usedQueries: [],
      expansionState: DEFAULT_EXPANSION_STATE,
    });
    expect(r.nextState.layer).toBe(1);
    expect(r.queries.length).toBeGreaterThan(0);
    expect(r.queries.some((q) => q.includes("confeitaria Curitiba"))).toBe(true);
  });

  it("nunca repete uma consulta já usada", async () => {
    const r = await expandSearchStrategy({
      companyId: "co1",
      brief: brief(),
      usedQueries: ["confeitaria Curitiba endereço", "confeitaria Curitiba telefone"],
      expansionState: DEFAULT_EXPANSION_STATE,
    });
    expect(r.queries).not.toContain("confeitaria Curitiba endereço");
    expect(r.queries).not.toContain("confeitaria Curitiba telefone");
  });

  it("sem IA disponível, pula a camada 2 (sem segmentos novos) e chega à camada 3", async () => {
    // esgota manualmente as camadas 1 e 2 via usedQueries vazio->cheio simulando progressão:
    // aqui simulamos direto pedindo a partir do estado layer=1 (já tentou a camada 1)
    const r = await expandSearchStrategy({
      companyId: "co1",
      brief: brief(),
      usedQueries: [], // camada 1 teria gerado consultas; para testar a 3 isoladamente, forçamos o estado
      expansionState: { layer: 1, extraSegments: [], districtCap: 16 },
    });
    // como isAiDemoMode=true, a camada 2 (IA) não rende nada e o loop avança para a 3
    expect(r.nextState.layer).toBeGreaterThanOrEqual(3);
    expect(r.queries.length).toBeGreaterThan(0);
  });

  it("camada 3 aumenta o teto de região e usa sub-regiões genéricas p/ cidade sem bairro mapeado", async () => {
    const r = await expandSearchStrategy({
      companyId: "co1",
      brief: brief({ regions: ["Pato Branco"] }),
      usedQueries: [],
      expansionState: { layer: 2, extraSegments: [], districtCap: 16 },
    });
    expect(r.nextState.districtCap).toBeGreaterThan(16);
    expect(r.queries.some((q) => q.includes("Centro, Pato Branco"))).toBe(true);
  });

  it("esgota todas as camadas sem gerar nada novo quando tudo já foi usado", async () => {
    // gera exaustivamente todas as consultas possíveis das 4 camadas primeiro,
    // depois pede de novo com elas todas em usedQueries — deve devolver vazio.
    const b = brief();
    let usedQueries: string[] = [];
    let state = DEFAULT_EXPANSION_STATE;
    for (let i = 0; i < 4; i++) {
      const r = await expandSearchStrategy({ companyId: "co1", brief: b, usedQueries, expansionState: state });
      usedQueries = [...usedQueries, ...r.queries];
      state = r.nextState;
    }
    const final = await expandSearchStrategy({
      companyId: "co1",
      brief: b,
      usedQueries,
      expansionState: state,
    });
    expect(final.queries).toEqual([]);
  });
});
