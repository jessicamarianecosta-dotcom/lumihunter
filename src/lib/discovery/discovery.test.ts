import { describe, it, expect } from "vitest";
import { buildDiscoveryQueries, parseAudienceSegments } from "./queries";
import { extractCompany, hostOf } from "./extract";
import { dedupeKeyFor, mergeByDedupeKey } from "./dedupe";
import { qualifyHeuristic, qualificationBand } from "./score";
import type { CampaignBrief, RawDiscoveryHit } from "./types";

const brief: CampaignBrief = {
  id: "c1",
  companyId: "co1",
  name: "Adesivos Rótulos",
  product: "Adesivos e rótulos personalizados",
  audience: "Pequenas empresas, lojas, artesãos, confeiteiros e empreendedores",
  regions: ["Curitiba", "São José dos Pinhais"],
  channel: "whatsapp",
};

function hit(p: Partial<RawDiscoveryHit>): RawDiscoveryHit {
  return {
    title: "",
    url: "",
    content: "",
    rawContent: null,
    relevance: null,
    query: "confeitarias em Curitiba",
    source: "tavily",
    ...p,
  };
}

describe("queries", () => {
  it("quebra o público em segmentos pesquisáveis", () => {
    const segs = parseAudienceSegments(brief.audience);
    expect(segs).toContain("confeiteiros");
    expect(segs).toContain("artesãos");
    expect(segs).not.toContain("e");
  });

  it("gera consultas por segmento x região, sem duplicar", () => {
    const qs = buildDiscoveryQueries(brief);
    expect(qs.length).toBeGreaterThan(3);
    expect(new Set(qs).size).toBe(qs.length);
    expect(qs.some((q) => q.includes("Curitiba"))).toBe(true);
  });
});

describe("extractCompany", () => {
  it("descarta artigos/listas", () => {
    const r = extractCompany(
      hit({ title: "10 melhores adesivos para confeitaria", url: "https://blog.exemplo.com/x" }),
      brief.regions,
    );
    expect(r.ok).toBe(false);
  });

  it("descarta diretórios/agregadores", () => {
    const r = extractCompany(
      hit({ title: "Doce Encanto - Telelistas", url: "https://telelistas.net/pr/curitiba/doce-encanto" }),
      brief.regions,
    );
    expect(r.ok).toBe(false);
  });

  it("aceita site de empresa e extrai domínio + cidade", () => {
    const r = extractCompany(
      hit({
        title: "Doce Encanto Confeitaria | Curitiba",
        url: "https://doceencanto.com.br/",
        content: "Confeitaria em Curitiba/PR. WhatsApp (41) 99999-8888 para encomendas.",
      }),
      brief.regions,
    );
    expect(r.ok).toBe(true);
    expect(r.company?.companyName).toBe("Doce Encanto Confeitaria");
    expect(r.company?.website).toBe("https://doceencanto.com.br");
    expect(r.company?.city).toBe("Curitiba");
    expect(r.company?.whatsapp).toContain("99999");
  });

  it("não inventa telefone quando não há", () => {
    const r = extractCompany(
      hit({ title: "Ateliê Lume", url: "https://atelielume.com.br", content: "Velas artesanais." }),
      brief.regions,
    );
    expect(r.company?.phone).toBeNull();
    expect(r.company?.whatsapp).toBeNull();
    expect(r.company?.city).toBeNull();
  });

  it("trata instagram como rede, não como site", () => {
    const r = extractCompany(
      hit({ title: "Bella Cosméticos (@bellacosmeticos)", url: "https://www.instagram.com/bellacosmeticos/" }),
      brief.regions,
    );
    expect(r.ok).toBe(true);
    expect(r.company?.website).toBeNull();
    expect(r.company?.instagram).toContain("instagram.com/bellacosmeticos");
  });
});

describe("dedupe", () => {
  it("usa domínio quando há site", () => {
    expect(
      dedupeKeyFor({
        website: "https://www.doceencanto.com.br/contato",
        phone: null,
        whatsapp: null,
        instagram: null,
        companyName: "Doce Encanto",
        city: "Curitiba",
      }),
    ).toBe("domain:doceencanto.com.br");
  });

  it("cai para nome+cidade sem outros sinais", () => {
    expect(
      dedupeKeyFor({
        website: null,
        phone: null,
        whatsapp: null,
        instagram: null,
        companyName: "Doce Encanto Confeitaria",
        city: "Curitiba",
      }),
    ).toBe("name:doce-encanto-confeitaria|curitiba");
  });

  it("junta duplicados preenchendo buracos", () => {
    const merged = mergeByDedupeKey([
      { dedupeKey: "k", description: "A", city: "Curitiba", state: null, phone: null, whatsapp: null, email: null, website: "x", instagram: null },
      { dedupeKey: "k", description: null, city: null, state: "PR", phone: "+5541999998888", whatsapp: null, email: null, website: "x", instagram: null },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].state).toBe("PR");
    expect(merged[0].phone).toBe("+5541999998888");
    expect(merged[0].description).toBe("A");
  });
});

describe("qualifyHeuristic", () => {
  it("pontua mais alto uma confeitaria completa em Curitiba", () => {
    const q = qualifyHeuristic(
      {
        companyName: "Doce Encanto Confeitaria",
        segment: "Confeitaria",
        description: "Confeitaria que vende doces embalados para presente",
        city: "Curitiba",
        state: "PR",
        phone: null,
        whatsapp: "+5541999998888",
        email: "contato@doceencanto.com.br",
        website: "https://doceencanto.com.br",
        instagram: "https://instagram.com/doceencanto",
        discoveryQuery: "confeitarias em Curitiba",
      },
      brief,
    );
    expect(q.score).toBeGreaterThanOrEqual(70);
    expect(q.qualification).toBe("high");
    expect(q.signals.some((s) => s.label.includes("WhatsApp"))).toBe(true);
    expect(q.reason.length).toBeGreaterThan(10);
  });

  it("pontua baixo quando quase não há dados", () => {
    const q = qualifyHeuristic(
      {
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
      },
      brief,
    );
    expect(q.score).toBeLessThan(31);
    expect(q.qualification).toBe("low");
  });

  it("bandas de qualificação", () => {
    expect(qualificationBand(90)).toBe("high");
    expect(qualificationBand(50)).toBe("medium");
    expect(qualificationBand(10)).toBe("low");
  });
});

describe("hostOf", () => {
  it("remove www e normaliza", () => {
    expect(hostOf("https://www.Exemplo.com.BR/x")).toBe("exemplo.com.br");
    expect(hostOf("não-é-url")).toBe("");
  });
});
