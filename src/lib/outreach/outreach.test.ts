import { describe, it, expect } from "vitest";
import { renderTemplate, DEFAULT_BASE_MESSAGE } from "./vars";
import {
  withinWindow,
  intervalElapsed,
  minutesOfDay,
} from "./window";
import { checkEligibility, classifyWhatsAppError } from "./eligibility";
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

  it("mensagem base padrão funciona sem IA", () => {
    const { text } = renderTemplate(DEFAULT_BASE_MESSAGE, {
      empresa: "Saboaria Lua",
      cidade: "Curitiba",
      estado: "PR",
      segmento: "saboaria",
      nome_contato: null,
      produto: "rótulos",
      site: null,
    });
    expect(text).toContain("Saboaria Lua");
    expect(text).not.toContain("{{");
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
