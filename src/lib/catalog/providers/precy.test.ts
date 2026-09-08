import { describe, expect, it } from "vitest";
import { parseStoreSlug, precyCatalogProvider } from "./precy";

describe("parseStoreSlug", () => {
  it("extrai o slug da loja", () => {
    expect(parseStoreSlug("https://precyplus.com.br/loja/lumilife")).toBe("lumilife");
    expect(parseStoreSlug("https://precyplus.com.br/loja/lumilife/produto/abc")).toBe(
      "lumilife",
    );
    expect(parseStoreSlug("https://precyplus.com.br/loja/minha-loja?x=1")).toBe(
      "minha-loja",
    );
  });
  it("retorna null para URL sem /loja/", () => {
    expect(parseStoreSlug("https://precyplus.com.br")).toBeNull();
  });
});

describe("precyCatalogProvider (desligado por padrão)", () => {
  it("não é uma integração real sem PRECY_ENABLED", () => {
    expect(precyCatalogProvider.isReal).toBe(false);
  });

  it("testConnection valida a URL mas avisa que o sync não está disponível", async () => {
    const r = await precyCatalogProvider.testConnection({
      url: "https://precyplus.com.br/loja/lumilife",
    });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/lumilife/);
  });

  it("testConnection rejeita URL fora do padrão de loja", async () => {
    const r = await precyCatalogProvider.testConnection({
      url: "https://exemplo.com",
    });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/inválida|loja/i);
  });
});
