import { describe, expect, it } from "vitest";
import { candidateToPhone, nextCandidate, parseDdd, parseStartNumber } from "./candidates";

describe("parseStartNumber", () => {
  it("aceita 9 dígitos começando em 9", () => {
    expect(parseStartNumber("991111111")).toBe(991111111n);
  });
  it("aceita 8 dígitos e adiciona o 9º dígito", () => {
    expect(parseStartNumber("91111111")).toBe(991111111n);
  });
  it("aceita com máscara", () => {
    expect(parseStartNumber("99111-1111")).toBe(991111111n);
  });
  it("rejeita número que não começa em 9", () => {
    expect(parseStartNumber("811111111")).toBeNull();
  });
  it("rejeita vazio", () => {
    expect(parseStartNumber("")).toBeNull();
  });
});

describe("parseDdd", () => {
  it("aceita 2 dígitos", () => {
    expect(parseDdd("41")).toBe("41");
  });
  it("rejeita com máscara e usa só os dígitos válidos", () => {
    expect(parseDdd("(41)")).toBe("41");
  });
  it("rejeita comprimento errado", () => {
    expect(parseDdd("415")).toBeNull();
  });
});

describe("candidateToPhone", () => {
  it("formata em E.164 BR", () => {
    expect(candidateToPhone("41", 991111111n)).toBe("+5541991111111");
  });
  it("zero-pad quando necessário", () => {
    expect(candidateToPhone("41", 900000001n)).toBe("+5541900000001");
  });
  it("null fora da faixa de celular", () => {
    expect(candidateToPhone("41", 100000000n)).toBeNull();
  });
});

describe("nextCandidate", () => {
  it("incrementa", () => {
    expect(nextCandidate(991111111n)).toBe(991111112n);
  });
  it("null ao esgotar a faixa", () => {
    expect(nextCandidate(999999999n)).toBeNull();
  });
});
