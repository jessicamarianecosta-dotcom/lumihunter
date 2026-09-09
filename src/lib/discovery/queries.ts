/**
 * Geração das consultas de descoberta. Função pura.
 *
 * Regra: a consulta parte do PRODUTO real da campanha + suas aplicações +
 * o perfil de comprador — nunca de "público + cidade" genérico. Toda consulta
 * de segmento carrega uma âncora de produto/aplicação para não virar
 * "empreendedores Curitiba".
 */
import type { CampaignBrief, ProductContext } from "./types";

/** Termos que descrevem "qualquer negócio" e produzem ruído se buscados sozinhos. */
export const GENERIC_AUDIENCE = new Set([
  "empreendedores", "empreendedor", "empreendedorismo", "microempreendedores",
  "microempreendedor", "mei", "autônomos", "autonomos", "autônomo",
  "pequenas", "pequenos", "empresas", "empresa", "negócios", "negocios",
  "negócio", "lojas", "loja", "comércio", "comercio", "gente", "pessoas",
  "clientes", "público", "publico", "profissionais", "profissional",
  "todos", "geral", "diversos", "vários", "varios", "locais", "regionais",
]);

const STOP = new Set([
  "e", "de", "da", "do", "das", "dos", "para", "pra", "com", "sem", "que",
  "os", "as", "um", "uma", "the", "and", "of", "a", "o", "em", "por", "ou",
  "personalizado", "personalizada", "personalizados", "personalizadas",
  "sob", "medida", "custom", "exclusivo", "exclusiva",
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[.,;/()]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/** Quebra um texto livre de público-alvo em segmentos, removendo os genéricos. */
export function parseAudienceSegments(audience: string): string[] {
  return audience
    .split(/[,;/\n•·]| e | ou /gi)
    .map((s) => s.replace(/\(.*?\)/g, " ").replace(/\s+/g, " ").trim().toLowerCase())
    .filter((s) => {
      if (s.length < 3) return false;
      const ws = s.split(/\s+/).filter((w) => !STOP.has(w));
      if (ws.length === 0) return false;
      // descarta se TODAS as palavras são genéricas ("pequenas empresas", "empreendedores")
      return !ws.every((w) => GENERIC_AUDIENCE.has(w));
    })
    .map((s) =>
      s
        .split(/\s+/)
        .filter((w) => !GENERIC_AUDIENCE.has(w) && !STOP.has(w))
        .join(" ")
        .trim(),
    )
    .filter(Boolean)
    .filter((s, i, a) => a.indexOf(s) === i)
    .slice(0, 8);
}

export function parseProductKeywords(product: string): string[] {
  return tokens(product)
    .filter((w, i, a) => a.indexOf(w) === i)
    .slice(0, 6);
}

/** Segmentos de comprador ideais: catálogo primeiro, público como complemento. */
export function deriveBuyerSegments(
  ctx: ProductContext,
  audience: string,
): string[] {
  const fromCatalog = [...ctx.exampleBuyers, ...ctx.useCases]
    .flatMap((s) => s.split(/[,;/]| e | ou /i))
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 2 && !s.split(/\s+/).every((w) => GENERIC_AUDIENCE.has(w)));

  const fromAudience = parseAudienceSegments(audience);

  return [...new Set([...fromCatalog, ...fromAudience])].slice(0, 8);
}

export function buildDiscoveryQueries(brief: CampaignBrief): string[] {
  const ctx = brief.productContext;
  const regions = brief.regions.length ? brief.regions : ["Brasil"];
  const buyerSegments = deriveBuyerSegments(ctx, brief.audience);
  const productKw = [
    ...parseProductKeywords(ctx.name),
    ...ctx.keywords.flatMap(tokens),
  ].filter((w, i, a) => a.indexOf(w) === i);
  const appKw = ctx.applications.flatMap(tokens);
  const anchor = productKw[0] ?? appKw[0] ?? "";

  const queries: string[] = [];

  for (const region of regions.slice(0, 4)) {
    // produto direto na região
    queries.push(`${ctx.name} ${region}`);
    // cada segmento comprador SEMPRE com âncora de produto
    for (const seg of buyerSegments.slice(0, 6)) {
      queries.push(`${seg} ${region} ${anchor}`.replace(/\s+/g, " ").trim());
    }
  }

  // sem segmentos identificáveis: ao menos ancora nas keywords do produto
  if (buyerSegments.length === 0) {
    for (const region of regions.slice(0, 3)) {
      for (const kw of productKw.slice(0, 3)) {
        queries.push(`empresas ${kw} ${region}`);
      }
      for (const app of appKw.slice(0, 2)) {
        queries.push(`${app} ${region}`);
      }
    }
  }

  return queries
    .map((q) => q.replace(/\s+/g, " ").trim())
    .filter((q, i, a) => q.length > 2 && a.indexOf(q) === i)
    .slice(0, 16);
}
