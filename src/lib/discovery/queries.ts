/**
 * Geração das consultas de descoberta a partir da campanha. Função pura.
 *
 * A ideia NÃO é pesquisar "adesivos Curitiba" (isso traz artigos e lojas de
 * adesivo — concorrentes). A ideia é procurar EMPRESAS que teriam potencial de
 * COMPRAR o produto: os segmentos do público-alvo, em cada região.
 */
import type { CampaignBrief } from "./types";

const STOP = new Set([
  "e","de","da","do","das","dos","para","pra","com","sem","que","os","as","um","uma",
  "empresas","empresa","pequenas","pequenos","grandes","médias","medias","microempresas",
  "negócios","negocios","lojas","loja","the","and","of","a","o","em","por",
  "personalizado","personalizada","personalizados","personalizadas","sob","medida",
]);

/** Quebra um texto livre de público-alvo numa lista de segmentos pesquisáveis. */
export function parseAudienceSegments(audience: string): string[] {
  return audience
    .split(/[,;/\n•·]| e | ou /gi)
    .map((s) =>
      s
        .replace(/\(.*?\)/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((s) => {
      if (s.length < 3) return false;
      const words = s.toLowerCase().split(/\s+/).filter((w) => !STOP.has(w));
      return words.length > 0;
    })
    .map((s) => s.toLowerCase())
    .filter((s, i, arr) => arr.indexOf(s) === i)
    .slice(0, 8);
}

/** Palavras-chave do produto (para uma consulta de reforço). */
export function parseProductKeywords(product: string): string[] {
  return product
    .toLowerCase()
    .replace(/[.,;/()]/g, " ")
    .split(/\s+| e /)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOP.has(w))
    .filter((w, i, arr) => arr.indexOf(w) === i)
    .slice(0, 6);
}

export function buildDiscoveryQueries(brief: CampaignBrief): string[] {
  const segments = parseAudienceSegments(brief.audience);
  const regions = brief.regions.length ? brief.regions : ["Brasil"];
  const productKw = parseProductKeywords(brief.product);

  const queries: string[] = [];

  for (const region of regions.slice(0, 4)) {
    for (const seg of segments.slice(0, 6)) {
      queries.push(`${seg} em ${region} contato whatsapp`);
    }
    // 1 consulta de reforço ligando o produto à região, para pegar quem já
    // procura esse tipo de serviço.
    if (productKw.length) {
      queries.push(`empresas que usam ${productKw.slice(0, 3).join(" ")} em ${region}`);
    }
  }

  // fallback: se não deu para extrair segmentos, usa o próprio texto do público
  if (segments.length === 0) {
    for (const region of regions.slice(0, 3)) {
      queries.push(`${brief.audience.slice(0, 60)} em ${region}`);
    }
  }

  return queries
    .map((q) => q.replace(/\s+/g, " ").trim())
    .filter((q, i, arr) => q.length > 0 && arr.indexOf(q) === i)
    .slice(0, 16);
}
