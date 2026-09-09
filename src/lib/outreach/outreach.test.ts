import { describe, it, expect } from "vitest";
import { renderTemplate, mentionsCompanyName, DEFAULT_BASE_MESSAGE } from "./vars";
import { enforceNoName } from "./messages";
import {
  withinWindow,
  intervalElapsed,
  minutesOfDay,
} from "./window";
import {
  checkEligibility,
  classifyWhatsAppError,
  validateProspectForAutomaticOutreach,
  type AutoOutreachInput,
} from "./eligibility";
import { looksLikeOptOut } from "./optout";

describe("renderTemplate — não inventa, limpa variável vazia", () => {
  it("substitui variáveis presentes", () => {
    const { text } = renderTemplate(
      "Olá, encontrei a {{empresa}} em {{cidade}}. Trabalhamos com {{produto}}.",
      {
        empresa: "Doce Encanto",
        cidade: "Curitiba",
        estado: "PR",
        segmento: "confeitaria",
        nome_contato: null,
        produto: "adesivos e rótulos",
        site: null,
      },
    );
    expect(text).toContain("Doce Encanto");
    expect(text).toContain("Curitiba");
    expect(text).not.toContain("{{");
  });

  it("remove {{cidade}} vazia sem deixar 'em .'", () => {
    const { text } = renderTemplate("Encontrei a {{empresa}} em {{cidade}}.", {
      empresa: "X",
      cidade: null,
      estado: null,
      segmento: null,
      nome_contato: null,
      produto: "y",
      site: null,
    });
    expect(text).toBe("Encontrei a X.");
  });

  it("nunca inventa nome de contato", () => {
    const { text } = renderTemplate("Olá {{nome_contato}}! Tudo bem?", {
      empresa: "X",
      cidade: null,
      estado: null,
      segmento: null,
      nome_contato: null,
      produto: "y",
      site: null,
    });
    expect(text).not.toContain("{{");
    expect(text.toLowerCase()).toContain("olá");
  });

  it("mensagem base padrão NÃO cita o nome da empresa", () => {
    const { text } = renderTemplate(DEFAULT_BASE_MESSAGE, {
      empresa: null,
      cidade: null,
      estado: null,
      segmento: "saboaria",
      nome_contato: null,
      produto: "rótulos adesivos",
      site: null,
    });
    expect(text).not.toContain("{{");
    expect(text.toLowerCase()).toContain("rótulos adesivos");
    expect(DEFAULT_BASE_MESSAGE).not.toContain("{{empresa}}");
    expect(DEFAULT_BASE_MESSAGE).not.toContain("{{nome_contato}}");
  });

  it("produto vazio some sem quebrar a frase", () => {
    const { text } = renderTemplate(DEFAULT_BASE_MESSAGE, {
      empresa: null, cidade: null, estado: null, segmento: null,
      nome_contato: null, produto: "", site: null,
    });
    expect(text).not.toContain("{{");
    expect(text).not.toMatch(/opções de\s+que/);
  });
});

describe("mentionsCompanyName — a abordagem NUNCA cita o nome da empresa", () => {
  it("detecta o nome inteiro e tokens distintivos", () => {
    expect(mentionsCompanyName("Olá, Terça e Quarta do Hortifruti Stall! Tudo bem?", "Terça e Quarta do Hortifruti Stall")).toBe(true);
    expect(mentionsCompanyName("Vi a Doce Encanto durante uma pesquisa", "Doce Encanto Confeitaria")).toBe(true);
    expect(mentionsCompanyName("Passando para falar do Studio Bella", "Studio Bella")).toBe(true);
  });
  it("não acusa quando o nome não aparece", () => {
    const msg = "Olá! Tudo bem? 😊 Trabalhamos com produtos personalizados e temos opções de rótulos adesivos. Vou deixar nosso catálogo.";
    expect(mentionsCompanyName(msg, "Doce Encanto Confeitaria")).toBe(false);
    expect(mentionsCompanyName(msg, "Terça e Quarta do Hortifruti Stall")).toBe(false);
  });
  it("palavra genérica do nome não conta como vazamento", () => {
    expect(mentionsCompanyName("Temos opções para a sua confeitaria.", "Confeitaria da Ana")).toBe(false);
  });
});

describe("enforceNoName — substitui a mensagem se vazou o nome", () => {
  const fallback = "Olá! Tudo bem? Temos um catálogo para você.";
  it("mantém a mensagem limpa", () => {
    const r = enforceNoName("Olá! Trabalhamos com rótulos adesivos.", "Doce Encanto", fallback);
    expect(r.replaced).toBe(false);
    expect(r.body).toContain("rótulos");
  });
  it("troca pela base quando cita o nome", () => {
    const r = enforceNoName("Olá, Doce Encanto! Tudo bem?", "Doce Encanto", fallback);
    expect(r.replaced).toBe(true);
    expect(r.body).toBe(fallback);
  });
});

describe("validateProspectForAutomaticOutreach — portão final do envio automático", () => {
  const ok: AutoOutreachInput = {
    prospectable: true,
    individualBusiness: true,
    competitor: false,
    resultType: "business",
    regionConfirmed: true,
    whatsappVerified: true,
    whatsapp: "+5541999998888",
    productMatchName: "Rótulos adesivos para embalagem",
    buyerFit: 80,
    productFit: 70,
    blocked: false,
    campaignActive: true,
    automaticEnabled: true,
    channel: "whatsapp",
    hasMessage: true,
    messageMentionsName: false,
    catalogRequired: true,
    catalogAvailable: true,
    alreadyInFlightOrDone: false,
    alreadyReplied: false,
  };
  it("aprova quando tudo passa", () => {
    expect(validateProspectForAutomaticOutreach(ok).ok).toBe(true);
  });
  it("bloqueia cada requisito que falha", () => {
    expect(validateProspectForAutomaticOutreach({ ...ok, automaticEnabled: false }).code).toBe("not_automatic");
    expect(validateProspectForAutomaticOutreach({ ...ok, campaignActive: false }).code).toBe("campaign_inactive");
    expect(validateProspectForAutomaticOutreach({ ...ok, individualBusiness: false }).code).toBe("not_a_business");
    expect(validateProspectForAutomaticOutreach({ ...ok, resultType: "aggregator" }).code).toBe("not_a_business");
    expect(validateProspectForAutomaticOutreach({ ...ok, competitor: true }).code).toBe("competitor");
    expect(validateProspectForAutomaticOutreach({ ...ok, regionConfirmed: false }).code).toBe("out_of_region");
    expect(validateProspectForAutomaticOutreach({ ...ok, buyerFit: 40 }).code).toBe("weak_buyer");
    expect(validateProspectForAutomaticOutreach({ ...ok, productMatchName: null }).code).toBe("no_product");
    expect(validateProspectForAutomaticOutreach({ ...ok, productFit: 20 }).code).toBe("no_product");
    expect(validateProspectForAutomaticOutreach({ ...ok, whatsappVerified: false }).code).toBe("no_whatsapp");
    expect(validateProspectForAutomaticOutreach({ ...ok, whatsapp: null }).code).toBe("no_whatsapp");
    expect(validateProspectForAutomaticOutreach({ ...ok, blocked: true }).code).toBe("opted_out");
    expect(validateProspectForAutomaticOutreach({ ...ok, alreadyReplied: true }).code).toBe("already_replied");
    expect(validateProspectForAutomaticOutreach({ ...ok, alreadyInFlightOrDone: true }).code).toBe("already_queued");
    expect(validateProspectForAutomaticOutreach({ ...ok, hasMessage: false }).code).toBe("no_message");
    expect(validateProspectForAutomaticOutreach({ ...ok, messageMentionsName: true }).code).toBe("name_leak");
    expect(validateProspectForAutomaticOutreach({ ...ok, catalogAvailable: false }).code).toBe("no_catalog");
  });
  it("catálogo indisponível é ok se a campanha não exige", () => {
    expect(validateProspectForAutomaticOutreach({ ...ok, catalogRequired: false, catalogAvailable: false }).ok).toBe(true);
  });
});

describe("window — janela e intervalo (controle operacional)", () => {
  it("minutesOfDay usa o fuso", () => {
    // 2026-01-01 12:00 UTC → 09:00 em São Paulo (UTC-3)
    const m = minutesOfDay(new Date("2026-01-01T12:00:00Z"), "America/Sao_Paulo");
    expect(m).toBe(9 * 60);
  });

  it("withinWindow dentro/fora do horário", () => {
    const noonUtc = new Date("2026-01-01T12:00:00Z"); // 09:00 SP
    expect(withinWindow(noonUtc, "09:00", "18:00", "America/Sao_Paulo")).toBe(true);
    const nightUtc = new Date("2026-01-01T03:00:00Z"); // 00:00 SP
    expect(withinWindow(nightUtc, "09:00", "18:00", "America/Sao_Paulo")).toBe(false);
  });

  it("intervalElapsed respeita o mínimo", () => {
    const now = new Date("2026-01-01T12:00:30Z");
    expect(intervalElapsed("2026-01-01T12:00:00Z", 30, now)).toBe(true);
    expect(intervalElapsed("2026-01-01T12:00:15Z", 30, now)).toBe(false);
    expect(intervalElapsed(null, 30, now)).toBe(true);
  });
});

describe("checkEligibility — checklist eliminatório", () => {
  const base = {
    whatsappVerified: true,
    whatsapp: "+5541999998888",
    blocked: false,
    invalidNumber: false,
    campaignStatus: "active",
    channel: "whatsapp",
    hasMessage: true,
    catalogRequired: true,
    catalogAvailable: true,
    alreadyReplied: false,
    whatsappIntegrationReady: true,
  };
  it("passa quando tudo ok", () => {
    expect(checkEligibility(base).ok).toBe(true);
  });
  it("sem WhatsApp confirmado → bloqueia", () => {
    expect(checkEligibility({ ...base, whatsappVerified: false }).code).toBe("no_whatsapp");
  });
  it("opt-out → bloqueia", () => {
    expect(checkEligibility({ ...base, blocked: true }).code).toBe("opted_out");
  });
  it("já respondeu → não inicia novo contato", () => {
    expect(checkEligibility({ ...base, alreadyReplied: true }).code).toBe("already_replied");
  });
  it("campanha pausada → bloqueia", () => {
    expect(checkEligibility({ ...base, campaignStatus: "paused" }).code).toBe("campaign_inactive");
  });
  it("catálogo exigido mas indisponível → bloqueia", () => {
    expect(checkEligibility({ ...base, catalogAvailable: false }).code).toBe("no_catalog");
  });
});

describe("classifyWhatsAppError — retry só p/ transitório", () => {
  it("timeout/5xx = transitório", () => {
    expect(classifyWhatsAppError("request timeout").transient).toBe(true);
    expect(classifyWhatsAppError("HTTP 503").transient).toBe(true);
  });
  it("429 = transitório", () => {
    expect(classifyWhatsAppError("429 too many requests").transient).toBe(true);
  });
  it("401/403 = permanente", () => {
    expect(classifyWhatsAppError("HTTP 401 unauthorized").transient).toBe(false);
  });
  it("número inválido = permanente + invalidNumber", () => {
    const r = classifyWhatsAppError("invalid recipient / not a whatsapp number");
    expect(r.transient).toBe(false);
    expect(r.invalidNumber).toBe(true);
  });
});

describe("looksLikeOptOut", () => {
  it("detecta pedidos de opt-out", () => {
    for (const s of [
      "não quero receber mensagens",
      "sem interesse",
      "pode parar",
      "me remova da lista",
      "não me manda mais nada",
      "descadastrar",
      "STOP",
    ]) {
      expect(looksLikeOptOut(s)).toBe(true);
    }
  });
  it("não marca respostas normais como opt-out", () => {
    for (const s of [
      "quero saber os valores",
      "pode mandar mais informações?",
      "tenho interesse sim",
      "qual o preço?",
    ]) {
      expect(looksLikeOptOut(s)).toBe(false);
    }
  });
});
