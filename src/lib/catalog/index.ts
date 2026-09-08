/**
 * Base Comercial — ponto de entrada.
 *
 * Os agentes de IA importam APENAS daqui. Nunca falam com uma fonte de
 * catálogo diretamente.
 */
export * from "./types";
export { searchCatalog } from "./search";
export {
  classifySearch,
  resolvePriceConflict,
  mergeProductSources,
  priceRangeOf,
} from "./resolve";

import { searchCatalog } from "./search";
import type { CommercialProduct, SearchOutcome } from "./types";

/** Instrução anti-invenção injetada no system prompt de qualquer agente comercial. */
export const ANTI_INVENTION_RULE = `REGRA ABSOLUTA — NUNCA INVENTE informação comercial.
Você só pode afirmar preço, material, gramatura, medida, acabamento, quantidade,
prazo ou disponibilidade se isso estiver na BASE COMERCIAL fornecida abaixo.
Se a informação não estiver lá: diga que não encontrou aquela opção e ofereça as
opções que realmente existem. Nunca use conhecimento geral para definir preço ou
disponibilidade — conhecimento geral serve só para explicar conceitos.`;

function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function renderProduct(p: CommercialProduct): string {
  const lines: string[] = [];
  lines.push(`### ${p.name}${p.isActive ? "" : " (inativo)"} [fonte: ${p.source}]`);
  if (p.category) lines.push(`Categoria: ${p.category}`);
  if (p.description) lines.push(p.description);
  const active = p.variants.filter((v) => v.isActive);
  if (active.length === 0) {
    lines.push("Sem variações/preços cadastrados.");
  } else {
    for (const v of active) {
      const specs = [
        ...v.optionLabels,
        ...Object.entries(v.attributes)
          .filter(([, val]) => val != null && val !== "")
          .map(([k, val]) => `${k}: ${val}`),
      ].join(" · ");
      const price =
        v.priceKind === "quote"
          ? "sob orçamento"
          : typeof v.price === "number"
            ? fmtBRL(v.price)
            : "sem preço cadastrado";
      const extra = [
        v.minQuantity ? `mín. ${v.minQuantity}` : null,
        v.leadTimeDays ? `prazo ${v.leadTimeDays}d` : null,
      ]
        .filter(Boolean)
        .join(", ");
      lines.push(`- ${specs || "padrão"} → ${price}${extra ? ` (${extra})` : ""}`);
    }
  }
  return lines.join("\n");
}

/**
 * Contexto de catálogo pronto para colar no prompt de um agente, a partir de
 * uma pergunta do cliente. Retorna também o `outcome` para o agente decidir o
 * tom da resposta.
 */
export async function buildCommercialContext(args: {
  companyId: string;
  query: string;
  requestedSpecs?: string[];
}): Promise<{ outcome: SearchOutcome; contextText: string }> {
  const outcome = await searchCatalog(args);

  const header: Record<SearchOutcome["kind"], string> = {
    FOUND: "Produto encontrado na base comercial:",
    PARTIAL:
      "Produto encontrado, mas faltam especificações para definir preço/variação:",
    AMBIGUOUS: "Vários produtos possíveis — peça ao cliente para escolher:",
    NOT_FOUND:
      "NADA na base comercial corresponde a essa busca. NÃO invente. Diga que não encontrou.",
    SOURCE_UNAVAILABLE:
      "A fonte de catálogo está indisponível agora. NÃO invente preço. Ofereça encaminhar para atendimento.",
  };

  const body = outcome.products.map(renderProduct).join("\n\n");
  const missing =
    outcome.missingSpecs?.length && outcome.kind === "PARTIAL"
      ? `\n\nPergunte ao cliente sobre: ${outcome.missingSpecs.join(", ")}.`
      : "";

  return {
    outcome,
    contextText: `## BASE COMERCIAL\n${header[outcome.kind]}\n\n${body || "(sem itens)"}${missing}`,
  };
}
