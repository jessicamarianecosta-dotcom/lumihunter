import { describe, it, expect } from "vitest";
import { buildDiscoveryQueries, parseAudienceSegments } from "./queries";
import { classifyResult, detectCompetitor } from "./classify";
import { extractCompany, hostOf, looksLikeCompanyName } from "./extract";
import { dedupeKeyFor, mergeByDedupeKey } from "./dedupe";
import { findVerifiedWhatsApp } from "./whatsapp";
import {
  qualify,
  evaluateGates,
  deriveSignals,
  pickProductMatch,
  heuristicApproach,
  type ScoreInput,
} from "./score";
import { buildCatalogGuard } from "./ai";
import { heuristicBuyerProfile } from "./product-context";
import { resolveRowStatus, runStats } from "./run";
import type { CampaignBrief, DiscoveredCompany, ProductContext } from "./types";

const productContext: ProductContext = {
  name: "Adesivos e rótulos personalizados",
  description: "Adesivos para identificação e personalização de produtos e embalagens.",
  category: "Adesivos",
  keywords: ["adesivo", "rótulo", "etiqueta", "embalagem"],
  applications: ["identificação de produtos", "rotulagem de embalagens"],
  useCases: ["produtos embalados", "linha própria de produtos"],
  exampleBuyers: ["confeitaria", "saboaria", "velas artesanais", "cosméticos artesanais"],
  idealAudience: "pequenos fabricantes de produtos físicos",
  variantNames: ["vinil branco", "vinil transparente", "couché"],
  catalogProducts: [
    {
      name: "Rótulos adesivos para embalagem",
      keywords: ["rótulo", "etiqueta", "adesivo"],
      applications: ["rotulagem de embalagens", "identificação de produtos embalados"],
    },
    {
      name: "Adesivos personalizados em vinil",
      keywords: ["adesivo", "vinil", "sticker"],
      applications: ["personalização de embalagens", "selo de lacre"],
    },
  ],
  source: "catalog",
};

const buyerProfile = heuristicBuyerProfile(
  productContext,
  "Pequenas empresas, lojas, artesãos, confeiteiros e empreendedores",
);

const brief: CampaignBrief = {
  id: "c1",
  companyId: "co1",
  name: "Adesivos Rótulos",
  product: productContext.name,
  productContext,
  buyerProfile,
  audience: "Pequenas empresas, lojas, artesãos, confeiteiros e empreendedores",
  regions: ["Curitiba", "São José dos Pinhais"],
  channel: "whatsapp",
  channelRequirement: "whatsapp",
};

function cls(title: string, url: string, content = "") {
  return classifyResult({ title, url, content });
}

function score(over: Partial<ScoreInput>) {
  const base: ScoreInput = {
    companyName: "Empresa X",
    segment: null,
    description: null,
    city: null,
    state: null,
    phone: null,
    whatsapp: null,
    email: null,
    website: null,
    instagram: null,
    discoveryQuery: null,
    resultType: "business",
    businessType: "company",
    sourceQuality: 50,
    individualBusiness: true,
    competitor: false,
    whatsappVerified: false,
    channelRequirement: "whatsapp",
    regions: brief.regions,
    buyerSegments: buyerProfile.buyerSegments,
  };
  return qualify({ ...base, ...over }, productContext);
}

describe("perfil de comprador guia a busca", () => {
  it("buyerProfile inclui compradores e exclui fornecedores", () => {
    expect(buyerProfile.buyerSegments).toContain("confeitaria");
    expect(buyerProfile.excludedProfiles).toContain("gráfica");
    expect(buyerProfile.excludedProfiles.some((e) => e.includes("adesivos"))).toBe(true);
  });

  it("nenhuma consulta usa o nome do produto (acha fornecedor)", () => {
    const qs = buildDiscoveryQueries(brief);
    expect(qs.length).toBeGreaterThan(0);
    expect(qs.some((q) => /^adesivos|^rótulos|^gr[áa]fica/i.test(q))).toBe(false);
    expect(qs.some((q) => q.toLowerCase().includes("confeitaria"))).toBe(true);
  });

  it("descarta público genérico", () => {
    const segs = parseAudienceSegments(brief.audience);
    expect(segs).not.toContain("empreendedores");
    expect(segs).not.toContain("pequenas empresas");
  });
});

describe("classifyResult — hard filter (antes da IA)", () => {
  it("descarta órgão público / sala do empreendedor", () => {
    expect(cls("Sala do Empreendedor de São José dos Pinhais", "https://x.pr.gov.br/y").resultType).toBe("government");
  });
  it("descarta evento / associação / comunidade", () => {
    expect(cls("Feiarte — feira de artesanato", "https://feiarte.com").resultType).toBe("event");
    expect(cls("Associação Comercial de Curitiba", "https://acp.com.br").resultType).toBe("association");
    expect(cls("Espaço Empreendedor", "https://x.com").resultType).toBe("community");
  });
  it("mata agregador / ranking / roteiro no primeiro filtro", () => {
    expect(cls("8 espaços deliciosos para tomar café com bolo em Curitiba", "https://blog.x.com").resultType).toBe("aggregator");
    expect(cls("Os 20 dentistas mais recomendados de Curitiba", "https://blog.x.com").resultType).toBe("aggregator");
    expect(cls("Melhores cafés de Curitiba", "https://blog.x.com").resultType).toBe("aggregator");
    expect(cls("Top 10 Padarias de São José dos Pinhais", "https://blog.x.com").resultType).toBe("aggregator");
    expect(cls("Cafés e docerias em Curitiba", "https://blog.x.com").resultType).toBe("aggregator");
  });
  it("mata notícia / matéria de mercado", () => {
    expect(cls("Mercado de cafeterias vive boom em Curitiba", "https://x.com").resultType).toBe("news");
    expect(cls("Padeiros: vagas e taxas da convenção coletiva 2026", "https://x.com").resultType).toBe("news");
  });
  it("mata artigo / guia", () => {
    expect(cls("Como fazer rótulos: guia completo", "https://blog.x.com").resultType).toBe("article");
  });
  it("aceita empresa e detecta o tipo", () => {
    const c = cls("Doce Encanto Confeitaria", "https://doceencanto.com.br", "Confeitaria artesanal em Curitiba");
    expect(c.resultType).toBe("business");
    expect(c.businessType).toBe("confectionery");
  });
});

describe("looksLikeCompanyName — título é o nome de UMA empresa?", () => {
  it("rejeita listas / rankings / segmentos no plural", () => {
    expect(looksLikeCompanyName("8 espaços deliciosos para tomar café com bolo em Curitiba")).toBe(false);
    expect(looksLikeCompanyName("Os 20 dentistas mais recomendados")).toBe(false);
    expect(looksLikeCompanyName("Melhores cafés de Curitiba")).toBe(false);
    expect(looksLikeCompanyName("Cafés e docerias")).toBe(false);
    expect(looksLikeCompanyName("Endereços e telefones")).toBe(false);
  });
  it("aceita nomes de empresa reais", () => {
    expect(looksLikeCompanyName("Doce Encanto Confeitaria")).toBe(true);
    expect(looksLikeCompanyName("Saboaria da Lua")).toBe(true);
    expect(looksLikeCompanyName("Ateliê Lume")).toBe(true);
  });
});

describe("detectCompetitor — concorrente ≠ comprador", () => {
  const pk = ["adesivos", "rótulos", "adesivo", "rótulo"];
  it("gráfica de etiquetas é concorrente", () => {
    const r = detectCompetitor(
      { title: "Gráfica Rápida — Etiquetas e Rótulos em Curitiba", url: "https://graficarapida.com.br", content: "Fabricamos etiquetas e rótulos adesivos." },
      buyerProfile.excludedProfiles,
      pk,
    );
    expect(r.competitor).toBe(true);
  });
  it("empresa de comunicação visual é concorrente", () => {
    const r = detectCompetitor(
      { title: "XYZ Comunicação Visual", url: "https://xyz.com.br", content: "Impressão de adesivos, fachadas e banners." },
      buyerProfile.excludedProfiles,
      pk,
    );
    expect(r.competitor).toBe(true);
  });
  it("confeitaria NÃO é concorrente", () => {
    const r = detectCompetitor(
      { title: "Doce Encanto Confeitaria", url: "https://doceencanto.com.br", content: "Doces artesanais e bolos para festas." },
      buyerProfile.excludedProfiles,
      pk,
    );
    expect(r.competitor).toBe(false);
  });
});

describe("findVerifiedWhatsApp — telefone ≠ WhatsApp", () => {
  it("confirma via link wa.me e traz evidência", () => {
    const r = findVerifiedWhatsApp("Fale conosco: https://wa.me/5541999998888");
    expect(r.verified).toBe(true);
    expect(r.number).toContain("99999");
    expect(r.evidence).toContain("wa.me");
  });
  it("confirma via rótulo explícito", () => {
    const r = findVerifiedWhatsApp("WhatsApp comercial (41) 99999-8888 para encomendas");
    expect(r.verified).toBe(true);
    expect(r.evidence).toBeTruthy();
  });
  it("NÃO confirma quando só há telefone", () => {
    const r = findVerifiedWhatsApp("Telefone: (41) 3333-4444. Endereço: Rua X, 100.");
    expect(r.verified).toBe(false);
    expect(r.evidence).toBeNull();
  });
});

describe("pickProductMatch — precisa de produto CONCRETO do catálogo", () => {
  it("acha match quando a atividade casa com a aplicação do produto", () => {
    const m = pickProductMatch(
      "confeitaria que vende produtos embalados e precisa rotular as embalagens",
      productContext.catalogProducts,
    );
    expect(m).not.toBeNull();
    expect(m!.name).toContain("Rótulos");
  });
  it("retorna null para termo amplo ('comunicação visual')", () => {
    const m = pickProductMatch(
      "empresa de comunicação visual e material gráfico personalizado",
      productContext.catalogProducts,
    );
    expect(m).toBeNull();
  });
  it("retorna null quando nada do catálogo casa", () => {
    expect(pickProductMatch("escritório de contabilidade e consultoria tributária", productContext.catalogProducts)).toBeNull();
  });
});

describe("evaluateGates — só passa quem cumpre TODOS os requisitos", () => {
  const ok = {
    score: 85,
    buyerFit: 80,
    productFit: 70,
    productMatch: { name: "Rótulos adesivos para embalagem" },
    individualBusiness: true,
    resultType: "business" as const,
    competitor: false,
    regionMatch: true,
    hasCity: true,
    whatsappVerified: true,
    channelRequirement: "whatsapp" as const,
  };
  it("aprova quando tudo passa", () => {
    const g = evaluateGates(ok);
    expect(g.prospectable).toBe(true);
    expect(g.qualification).toBe("high");
    expect(g.discardReason).toBeNull();
  });
  it("reprova agregador / não-empresa", () => {
    expect(evaluateGates({ ...ok, resultType: "aggregator" }).prospectable).toBe(false);
    expect(evaluateGates({ ...ok, individualBusiness: false }).prospectable).toBe(false);
  });
  it("reprova concorrente, fora de região, sem WhatsApp (gates duros)", () => {
    expect(evaluateGates({ ...ok, competitor: true }).prospectable).toBe(false);
    expect(evaluateGates({ ...ok, regionMatch: false }).prospectable).toBe(false);
    expect(evaluateGates({ ...ok, whatsappVerified: false }).prospectable).toBe(false);
  });
  it("buyer_fit / product_fit baixos NÃO bloqueiam — só rebaixam a banda", () => {
    const semProduto = evaluateGates({ ...ok, productMatch: null, productFit: 0 });
    expect(semProduto.prospectable).toBe(true);
    expect(semProduto.qualification).toBe("medium");
    const buyerBaixo = evaluateGates({ ...ok, buyerFit: 40 });
    expect(buyerBaixo.prospectable).toBe(true);
    expect(buyerBaixo.qualification).toBe("medium");
  });
});

describe("deriveSignals — sinais NUNCA contradizem os números", () => {
  it("buyer_fit 0 → nenhum sinal de 'empresa compradora'", () => {
    const s = deriveSignals({
      individualBusiness: true,
      competitor: false,
      resultType: "business",
      buyerFit: 0,
      productFit: 0,
      productMatch: null,
      regionMatch: false,
      city: null,
      whatsappVerified: false,
      channelRequirement: "whatsapp",
    });
    expect(s.some((x) => /comprador/i.test(x.label))).toBe(false);
  });
  it("agregador / não-empresa → zero sinais", () => {
    const s = deriveSignals({
      individualBusiness: false,
      competitor: false,
      resultType: "aggregator",
      buyerFit: 0,
      productFit: 0,
      productMatch: null,
      regionMatch: false,
      city: null,
      whatsappVerified: false,
      channelRequirement: "whatsapp",
    });
    expect(s).toHaveLength(0);
  });
});

describe("qualify — buyer fit + produto concreto + WhatsApp obrigatórios", () => {
  it("confeitaria compradora com WhatsApp confirmado → alto potencial + prospectable", () => {
    const q = score({
      companyName: "Doce Encanto Confeitaria",
      businessType: "confectionery",
      description: "Confeitaria artesanal. Vendemos produtos embalados e temos linha própria de doces; rotulamos as embalagens.",
      city: "Curitiba",
      state: "PR",
      website: "https://doceencanto.com.br",
      whatsappVerified: true,
      whatsapp: "+5541999998888",
      discoveryQuery: "confeitaria Curitiba",
      sourceQuality: 100,
    });
    expect(q.buyerFitScore).toBeGreaterThanOrEqual(70);
    expect(q.productMatch).not.toBeNull();
    expect(q.productFitScore).toBeGreaterThanOrEqual(60);
    expect(q.qualification).toBe("high");
    expect(q.prospectable).toBe(true);
    expect(q.discardReason).toBeNull();
    expect(q.signals.some((s) => /comprador/i.test(s.label))).toBe(true);
  });

  it("empresa compradora SEM WhatsApp → nunca prospectável, score ≤ 49", () => {
    const q = score({
      companyName: "Saboaria da Lua",
      businessType: "soap_brand",
      description: "Sabonetes artesanais com linha própria de produtos embalados; precisamos de rótulos para as embalagens.",
      city: "Curitiba",
      website: "https://saboariadalua.com.br",
      instagram: "https://instagram.com/saboariadalua",
      whatsappVerified: false,
    });
    expect(q.prospectable).toBe(false);
    expect(q.score).toBeLessThanOrEqual(49);
    expect(q.discardReason).toBe("WhatsApp comercial não confirmado");
  });

  it("concorrente (gráfica) → buyer_fit 0, descartado, sem sinais", () => {
    const q = score({
      companyName: "Gráfica Rápida",
      businessType: "company",
      competitor: true,
      city: "Curitiba",
      whatsappVerified: true,
    });
    expect(q.buyerFitScore).toBe(0);
    expect(q.prospectable).toBe(false);
    expect(q.signals).toHaveLength(0);
    expect(q.discardReason).toContain("oncorrente");
  });

  it("não é empresa → não qualificado e sem sinais", () => {
    const q = score({ resultType: "government", businessType: "unknown", city: "Curitiba", whatsappVerified: true });
    expect(q.prospectable).toBe(false);
    expect(q.signals).toHaveLength(0);
  });

  it("empresa individual na região com WhatsApp, mesmo sem produto concreto → abordável (banda medium)", () => {
    const q = score({
      companyName: "Consultoria Alfa",
      businessType: "service_business",
      description: "Consultoria empresarial e treinamentos.",
      city: "Curitiba",
      whatsappVerified: true,
      sourceQuality: 100,
    });
    expect(q.productMatch).toBeNull();
    expect(q.prospectable).toBe(true);
    expect(q.qualification).toBe("medium");
  });
});

describe("catálogo é a fonte da verdade", () => {
  const guard = buildCatalogGuard(
    productContext.name, productContext.keywords,
    productContext.variantNames, productContext.applications,
  );
  it("bloqueia abordagem com produto fora do catálogo", () => {
    expect(guard("Oferecer kit festa e canecas personalizadas.")).toBe(false);
  });
  it("aceita abordagem só com o produto do catálogo", () => {
    expect(guard("Apresentar adesivos e rótulos personalizados para as embalagens.")).toBe(true);
  });
  it("heuristicApproach fica preso a um produto concreto", () => {
    const a = heuristicApproach(
      { companyName: "Doce Encanto", productMatch: { name: "Rótulos adesivos para embalagem", reason: "x" } },
      productContext,
    );
    expect(a.toLowerCase()).toContain("rótulos adesivos");
  });
});

describe("rodada de descoberta — nova pesquisa não acumula", () => {
  const mk = (o: Partial<DiscoveredCompany>): DiscoveredCompany =>
    ({
      companyName: "X",
      resultType: "business",
      competitor: false,
      individualBusiness: true,
      whatsappVerified: false,
      qualification: "low",
      prospectable: false,
      dedupeKey: "k",
      ...o,
    } as DiscoveredCompany);

  it("descoberta aprovada em rodada anterior carrega status", () => {
    expect(
      resolveRowStatus(mk({ prospectable: false }), {
        lead_id: "l1", approved_at: "t", approved_by: "u",
      }),
    ).toBe("approved");
  });
  it("sem aprovação: prospectável→qualified, resto→rejected", () => {
    expect(resolveRowStatus(mk({ prospectable: true }), undefined)).toBe("qualified");
    expect(resolveRowStatus(mk({ prospectable: false }), undefined)).toBe("rejected");
    expect(resolveRowStatus(mk({ competitor: true, prospectable: false }), undefined)).toBe("rejected");
  });
  it("runStats: found = só leads válidos", () => {
    const qualified = [
      mk({ prospectable: true, whatsappVerified: true }),
      mk({ prospectable: true, whatsappVerified: true }),
    ];
    const rejected = [
      mk({ whatsappVerified: false }),
      mk({ competitor: true }),
    ];
    const s = runStats(qualified, rejected);
    expect(s.found).toBe(2);
    expect(s.screened).toBe(4);
    expect(s.rejected).toBe(2);
    expect(s.competitors).toBe(1);
    expect(s.noWhatsapp).toBe(1);
  });
});

describe("dedupe / hostOf", () => {
  it("dedupe por domínio", () => {
    expect(dedupeKeyFor({ website: "https://www.x.com.br/a", phone: null, whatsapp: null, instagram: null, companyName: "X", city: "Curitiba" })).toBe("domain:x.com.br");
  });
  it("merge preenche buracos", () => {
    const m = mergeByDedupeKey([
      { dedupeKey: "k", description: "A", city: "Curitiba", state: null, phone: null, whatsapp: null, email: null, website: "x", instagram: null },
      { dedupeKey: "k", description: null, city: null, state: "PR", phone: "+5541999998888", whatsapp: null, email: null, website: "x", instagram: null },
    ]);
    expect(m).toHaveLength(1);
    expect(m[0].state).toBe("PR");
  });
  it("hostOf normaliza", () => {
    expect(hostOf("https://www.Exemplo.com.BR/x")).toBe("exemplo.com.br");
  });
  it("extractCompany não inventa", () => {
    const r = extractCompany(
      { title: "Ateliê Lume", url: "https://atelielume.com.br", content: "Velas artesanais.", rawContent: null, relevance: null, query: "q", source: "tavily" },
      brief.regions,
    );
    expect(r.company?.phone).toBeNull();
    expect(r.company?.city).toBeNull();
  });
});
