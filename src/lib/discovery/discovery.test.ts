import { describe, it, expect } from "vitest";
import { buildDiscoveryQueries, parseAudienceSegments } from "./queries";
import { classifyResult } from "./classify";
import { extractCompany, hostOf } from "./extract";
import { dedupeKeyFor, mergeByDedupeKey } from "./dedupe";
import { qualify, qualificationBand, heuristicApproach, type ScoreInput } from "./score";
import { buildCatalogGuard } from "./ai";
import type { CampaignBrief, ProductContext } from "./types";

const productContext: ProductContext = {
  name: "Adesivos e rótulos personalizados",
  description:
    "Adesivos para identificação e personalização de produtos e embalagens.",
  category: "Adesivos",
  keywords: ["adesivo", "rótulo", "etiqueta", "embalagem"],
  applications: ["identificação de produtos", "rotulagem de embalagens"],
  useCases: ["produtos embalados", "linha própria de produtos"],
  exampleBuyers: ["confeitaria", "saboaria", "velas artesanais", "cosméticos artesanais"],
  idealAudience: "pequenos fabricantes de produtos físicos",
  variantNames: ["vinil branco", "vinil transparente", "couché"],
  source: "catalog",
};

const brief: CampaignBrief = {
  id: "c1",
  companyId: "co1",
  name: "Adesivos Rótulos",
  product: productContext.name,
  productContext,
  audience: "Pequenas empresas, lojas, artesãos, confeiteiros e empreendedores",
  regions: ["Curitiba", "São José dos Pinhais"],
  channel: "whatsapp",
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
    regions: brief.regions,
  };
  return qualify({ ...base, ...over }, productContext);
}

describe("queries — parte do produto, não do público genérico", () => {
  it("descarta segmentos genéricos do público", () => {
    const segs = parseAudienceSegments(brief.audience);
    expect(segs).toContain("confeiteiros");
    expect(segs).toContain("artesãos");
    expect(segs).not.toContain("empreendedores");
    expect(segs).not.toContain("pequenas empresas");
  });

  it("nenhuma consulta é só público + cidade", () => {
    const qs = buildDiscoveryQueries(brief);
    expect(qs.length).toBeGreaterThan(0);
    expect(qs).not.toContain("empreendedores Curitiba");
    // toda consulta cita o produto OU um segmento comprador do catálogo
    expect(qs.some((q) => q.toLowerCase().includes("adesivo"))).toBe(true);
    expect(qs.some((q) => q.toLowerCase().includes("confeitaria"))).toBe(true);
  });
});

describe("classifyResult — hard filter", () => {
  it("descarta órgão público / sala do empreendedor", () => {
    expect(cls("Sala do Empreendedor de São José dos Pinhais", "https://saojose.pr.gov.br/x").resultType).toBe("government");
    expect(cls("Secretaria Municipal da Indústria e Comércio", "https://x.com").resultType).toBe("government");
  });
  it("descarta evento / feira", () => {
    expect(cls("Feiarte — feira de artesanato de Curitiba", "https://feiarte.com").resultType).toBe("event");
  });
  it("descarta associação", () => {
    expect(cls("Associação Comercial de Curitiba", "https://acp.com.br").resultType).toBe("association");
  });
  it("descarta comunidade / portal de empreendedorismo", () => {
    expect(cls("Espaço Empreendedor", "https://x.com").resultType).toBe("community");
    expect(cls("Mais Negócios Curitiba", "https://x.com").resultType).toBe("community");
  });
  it("descarta lista / Top 10", () => {
    expect(cls("Top 10 Padarias e Confeitarias de São José dos Pinhais", "https://blog.x.com").resultType).toBe("directory");
  });
  it("descarta artigo", () => {
    expect(cls("Como fazer rótulos personalizados: guia completo", "https://blog.x.com").resultType).toBe("article");
  });
  it("aceita empresa com site próprio e detecta o tipo", () => {
    const c = cls("Doce Encanto Confeitaria", "https://doceencanto.com.br", "Confeitaria artesanal em Curitiba");
    expect(c.resultType).toBe("business");
    expect(c.businessType).toBe("confectionery");
    expect(c.sourceQuality).toBe(100);
  });
});

describe("extractCompany", () => {
  it("extrai domínio, cidade e whatsapp com evidência", () => {
    const r = extractCompany(
      {
        title: "Doce Encanto Confeitaria | Curitiba",
        url: "https://doceencanto.com.br/",
        content: "Confeitaria em Curitiba/PR. WhatsApp (41) 99999-8888.",
        rawContent: null,
        relevance: null,
        query: "confeitaria Curitiba adesivo",
        source: "tavily",
      },
      brief.regions,
    );
    expect(r.ok).toBe(true);
    expect(r.company?.website).toBe("https://doceencanto.com.br");
    expect(r.company?.city).toBe("Curitiba");
    expect(r.company?.whatsapp).toContain("99999");
  });

  it("não inventa dados ausentes", () => {
    const r = extractCompany(
      {
        title: "Ateliê Lume",
        url: "https://atelielume.com.br",
        content: "Velas artesanais.",
        rawContent: null,
        relevance: null,
        query: "velas Curitiba",
        source: "tavily",
      },
      brief.regions,
    );
    expect(r.company?.phone).toBeNull();
    expect(r.company?.city).toBeNull();
  });
});

describe("dedupe", () => {
  it("usa domínio", () => {
    expect(
      dedupeKeyFor({
        website: "https://www.doceencanto.com.br/contato",
        phone: null, whatsapp: null, instagram: null,
        companyName: "Doce Encanto", city: "Curitiba",
      }),
    ).toBe("domain:doceencanto.com.br");
  });
  it("merge preenche buracos sem apagar", () => {
    const merged = mergeByDedupeKey([
      { dedupeKey: "k", description: "A", city: "Curitiba", state: null, phone: null, whatsapp: null, email: null, website: "x", instagram: null },
      { dedupeKey: "k", description: null, city: null, state: "PR", phone: "+5541999998888", whatsapp: null, email: null, website: "x", instagram: null },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].state).toBe("PR");
    expect(merged[0].description).toBe("A");
  });
});

describe("qualify — product fit domina", () => {
  it("confeitaria com produtos próprios em Curitiba pontua alto", () => {
    const q = score({
      companyName: "Doce Encanto Confeitaria",
      businessType: "confectionery",
      description:
        "Confeitaria artesanal. Vendemos produtos embalados e temos linha própria de doces para presente.",
      city: "Curitiba",
      state: "PR",
      whatsapp: "+5541999998888",
      website: "https://doceencanto.com.br",
      instagram: "https://instagram.com/doceencanto",
      discoveryQuery: "confeitaria Curitiba adesivo",
      sourceQuality: 100,
    });
    expect(q.productFitScore).toBeGreaterThanOrEqual(60);
    expect(q.qualification).toBe("high");
    expect(q.evidence.length).toBeGreaterThan(1);
    expect(q.signals[0].label.toLowerCase()).toContain("compat");
  });

  it("NÃO fica alto só por região + site + whatsapp, sem product fit", () => {
    const q = score({
      companyName: "Consultoria Alfa",
      businessType: "service_business",
      description: "Consultoria empresarial e treinamentos corporativos.",
      city: "Curitiba",
      whatsapp: "+5541999990000",
      website: "https://consultoriaalfa.com.br",
      instagram: "https://instagram.com/consultoriaalfa",
      sourceQuality: 100,
    });
    expect(q.productFitScore).toBeLessThan(50);
    expect(q.qualification).not.toBe("high");
  });

  it("resultType != business zera o product fit", () => {
    const q = score({ resultType: "government", businessType: "unknown", city: "Curitiba", website: "https://x.gov.br" });
    expect(q.productFitScore).toBe(0);
  });

  it("bandas: product_fit < 30 nunca é qualificado", () => {
    expect(qualificationBand(90, 20)).toBe("low");
    expect(qualificationBand(80, 55)).toBe("high");
    expect(qualificationBand(60, 40)).toBe("medium");
    expect(qualificationBand(80, 45)).toBe("medium"); // alto score mas fit < 50 → não high
  });
});

describe("catálogo é a fonte da verdade", () => {
  const guard = buildCatalogGuard(
    productContext.name,
    productContext.keywords,
    productContext.variantNames,
    productContext.applications,
  );

  it("bloqueia abordagem que cita produto fora do catálogo", () => {
    expect(guard("Oferecer kit festa e decoração para a confeitaria.")).toBe(false);
    expect(guard("Sugerir canecas e camisetas personalizadas.")).toBe(false);
  });

  it("aceita abordagem que cita só o produto do catálogo", () => {
    expect(
      guard("Apresentar as opções de adesivos e rótulos personalizados da LumiLife."),
    ).toBe(true);
  });

  it("heuristicApproach nunca cita produto fora do catálogo", () => {
    const a = heuristicApproach(
      { companyName: "Doce Encanto", businessType: "confectionery" },
      productContext,
    );
    expect(a.toLowerCase()).toContain("adesivos e rótulos");
    expect(guard(a)).toBe(true);
  });
});

describe("hostOf", () => {
  it("normaliza", () => {
    expect(hostOf("https://www.Exemplo.com.BR/x")).toBe("exemplo.com.br");
    expect(hostOf("nao-url")).toBe("");
  });
});
