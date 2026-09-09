import { describe, it, expect } from "vitest";
import { buildDiscoveryQueries, parseAudienceSegments } from "./queries";
import { classifyResult, detectCompetitor } from "./classify";
import { extractCompany, hostOf } from "./extract";
import { dedupeKeyFor, mergeByDedupeKey } from "./dedupe";
import { findVerifiedWhatsApp } from "./whatsapp";
import { qualify, qualificationBand, heuristicApproach, type ScoreInput } from "./score";
import { buildCatalogGuard } from "./ai";
import { heuristicBuyerProfile } from "./product-context";
import type { CampaignBrief, ProductContext } from "./types";

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

describe("classifyResult — hard filter", () => {
  it("descarta órgão público / sala do empreendedor", () => {
    expect(cls("Sala do Empreendedor de São José dos Pinhais", "https://x.pr.gov.br/y").resultType).toBe("government");
  });
  it("descarta evento / associação / comunidade / lista / artigo", () => {
    expect(cls("Feiarte — feira de artesanato", "https://feiarte.com").resultType).toBe("event");
    expect(cls("Associação Comercial de Curitiba", "https://acp.com.br").resultType).toBe("association");
    expect(cls("Espaço Empreendedor", "https://x.com").resultType).toBe("community");
    expect(cls("Top 10 Padarias de São José dos Pinhais", "https://blog.x.com").resultType).toBe("directory");
    expect(cls("Como fazer rótulos: guia completo", "https://blog.x.com").resultType).toBe("article");
  });
  it("aceita empresa e detecta o tipo", () => {
    const c = cls("Doce Encanto Confeitaria", "https://doceencanto.com.br", "Confeitaria artesanal em Curitiba");
    expect(c.resultType).toBe("business");
    expect(c.businessType).toBe("confectionery");
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
  it("confirma via link wa.me", () => {
    const r = findVerifiedWhatsApp("Fale conosco: https://wa.me/5541999998888");
    expect(r.verified).toBe(true);
    expect(r.number).toContain("99999");
  });
  it("confirma via rótulo explícito", () => {
    const r = findVerifiedWhatsApp("WhatsApp comercial (41) 99999-8888 para encomendas");
    expect(r.verified).toBe(true);
  });
  it("NÃO confirma quando só há telefone", () => {
    const r = findVerifiedWhatsApp("Telefone: (41) 3333-4444. Endereço: Rua X, 100.");
    expect(r.verified).toBe(false);
  });
});

describe("qualify — buyer fit + WhatsApp obrigatórios", () => {
  it("confeitaria compradora com WhatsApp confirmado → alto potencial", () => {
    const q = score({
      companyName: "Doce Encanto Confeitaria",
      businessType: "confectionery",
      description: "Confeitaria artesanal. Vendemos produtos embalados e temos linha própria de doces.",
      city: "Curitiba",
      state: "PR",
      website: "https://doceencanto.com.br",
      whatsappVerified: true,
      whatsapp: "+5541999998888",
      discoveryQuery: "confeitaria Curitiba",
      sourceQuality: 100,
    });
    expect(q.buyerFitScore).toBeGreaterThanOrEqual(60);
    expect(q.qualification).toBe("high");
    expect(q.discardReason).toBeNull();
  });

  it("empresa relevante SEM WhatsApp → nunca qualificada, score ≤ 49", () => {
    const q = score({
      companyName: "Saboaria da Lua",
      businessType: "soap_brand",
      description: "Sabonetes artesanais com linha própria.",
      city: "Curitiba",
      website: "https://saboariadalua.com.br",
      instagram: "https://instagram.com/saboariadalua",
      whatsappVerified: false,
    });
    expect(q.qualification).toBe("low");
    expect(q.score).toBeLessThanOrEqual(49);
    expect(q.discardReason).toBe("WhatsApp comercial não confirmado");
  });

  it("concorrente (gráfica) → buyer_fit 0, não qualificado", () => {
    const q = score({
      companyName: "Gráfica Rápida",
      businessType: "company",
      competitor: true,
      city: "Curitiba",
      whatsappVerified: true,
    });
    expect(q.buyerFitScore).toBe(0);
    expect(q.qualification).toBe("low");
    expect(q.discardReason).toContain("concorrente");
  });

  it("não é empresa → não qualificado", () => {
    const q = score({ resultType: "government", businessType: "unknown", city: "Curitiba", whatsappVerified: true });
    expect(q.qualification).toBe("low");
  });

  it("consultoria (sem product fit) com WhatsApp → não é alto", () => {
    const q = score({
      companyName: "Consultoria Alfa",
      businessType: "service_business",
      description: "Consultoria empresarial e treinamentos.",
      city: "Curitiba",
      whatsappVerified: true,
      sourceQuality: 100,
    });
    expect(q.buyerFitScore).toBeLessThan(50);
    expect(q.qualification).not.toBe("high");
  });

  it("bandas: sem whatsapp em campanha whatsapp nunca qualifica", () => {
    const args = {
      final: 90, buyerFit: 90, productFit: 90,
      resultType: "business" as const, competitor: false,
      channelRequirement: "whatsapp" as const,
    };
    expect(qualificationBand({ ...args, whatsappVerified: false })).toBe("low");
    expect(qualificationBand({ ...args, whatsappVerified: true })).toBe("high");
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
  it("heuristicApproach fica no catálogo", () => {
    const a = heuristicApproach({ companyName: "Doce Encanto", businessType: "confectionery" }, productContext);
    expect(guard(a)).toBe(true);
    expect(a.toLowerCase()).toContain("adesivos e rótulos");
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
