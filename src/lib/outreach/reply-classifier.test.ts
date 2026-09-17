import { describe, it, expect } from "vitest";
import { classifyReply } from "./reply-classifier";

describe("classifyReply — resposta automática vs. humana", () => {
  it("resposta de ausência automática não é 'precisa de você'", () => {
    const r = classifyReply(
      "Olá! Agradecemos sua mensagem. Não estamos disponíveis no momento, mas responderemos assim que possível.",
    );
    expect(r.kind).toBe("auto");
  });

  it("mensagem de fora do horário é automática", () => {
    const r = classifyReply("Estamos fora do horário. Retornaremos amanhã.");
    expect(r.kind).toBe("auto");
  });

  it("pergunta sobre preço é humana e interessada", () => {
    const r = classifyReply("Oi, gostaria de saber o valor das canecas.");
    expect(r).toEqual({ kind: "human", interest: "interested" });
  });

  it("pergunta sobre produto é humana e interessada", () => {
    const r = classifyReply("Olá, vocês trabalham com cartão de visita?");
    expect(r).toEqual({ kind: "human", interest: "interested" });
  });

  it("recusa educada é humana e sem interesse", () => {
    const r = classifyReply("Obrigado, não temos interesse.");
    expect(r).toEqual({ kind: "human", interest: "not_interested" });
  });

  it("mensagem neutra sem sinais fica neutra (ainda precisa de olhar humano)", () => {
    const r = classifyReply("Oi, aqui é o Carlos.");
    expect(r.kind).toBe("human");
    expect(r.interest).toBe("neutral");
  });

  it("pergunta genérica sem contexto de produto ainda conta como sinal de interesse", () => {
    const r = classifyReply("Oi, tudo bem?");
    expect(r).toEqual({ kind: "human", interest: "interested" });
  });

  it("texto vazio não quebra — trata como humano neutro", () => {
    expect(classifyReply("")).toEqual({ kind: "human", interest: "neutral" });
    expect(classifyReply(null)).toEqual({ kind: "human", interest: "neutral" });
  });

  it("menu de bot é automático", () => {
    const r = classifyReply("Bem-vindo! Digite o número da opção desejada.");
    expect(r.kind).toBe("auto");
  });
});
