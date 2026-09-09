import { describe, it, expect } from "vitest";
import { pickCatalogPdf } from "./pdfs";

type P = Parameters<typeof pickCatalogPdf>[0][number];
const mk = (o: Partial<P>): P => ({
  id: "x",
  use_for_sending: true,
  is_default: false,
  created_at: "2026-01-01T00:00:00Z",
  ...o,
});

describe("pickCatalogPdf — prioridade de catálogo", () => {
  it("usa o PDF escolhido na campanha quando é enviável", () => {
    const pdfs = [
      mk({ id: "a", is_default: true }),
      mk({ id: "b" }),
    ];
    expect(pickCatalogPdf(pdfs, "b")).toBe("b");
  });

  it("ignora o escolhido se ele não é para envio, cai no padrão", () => {
    const pdfs = [
      mk({ id: "a", is_default: true }),
      mk({ id: "b", use_for_sending: false }),
    ];
    expect(pickCatalogPdf(pdfs, "b")).toBe("a");
  });

  it("sem escolha → padrão da empresa", () => {
    const pdfs = [mk({ id: "a" }), mk({ id: "b", is_default: true })];
    expect(pickCatalogPdf(pdfs, null)).toBe("b");
  });

  it("sem escolha e sem padrão → mais recente entre os enviáveis", () => {
    const pdfs = [
      mk({ id: "old", created_at: "2026-01-01T00:00:00Z" }),
      mk({ id: "new", created_at: "2026-06-01T00:00:00Z" }),
    ];
    expect(pickCatalogPdf(pdfs, null)).toBe("new");
  });

  it("nenhum PDF para envio → null", () => {
    const pdfs = [mk({ id: "a", use_for_sending: false })];
    expect(pickCatalogPdf(pdfs, "a")).toBeNull();
    expect(pickCatalogPdf([], null)).toBeNull();
  });
});
