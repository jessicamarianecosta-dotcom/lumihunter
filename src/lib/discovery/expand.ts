/**
 * PESQUISA ADAPTATIVA EM CAMADAS.
 *
 * A quantidade pedida pelo usuário é a quantidade FINAL de leads válidos —
 * não uma lista de consultas para tentar uma vez. Quando o plano inicial de
 * consultas (`buildScaleQueries`) se esgota antes de atingir a meta, esta
 * camada gera automaticamente MAIS consultas, escalando por níveis, até
 * atingir a meta ou esgotar de verdade todas as estratégias disponíveis.
 *
 * Camadas (nesta ordem, uma só avança quando a anterior não rendeu nada NOVO):
 *  1. variações de intenção sobre os MESMOS segmentos/regiões já usados;
 *  2. novos segmentos de comprador via IA (produto-agnóstico, exclui os já
 *     tentados) — cobre "mais categorias" e "sinônimos" ao mesmo tempo;
 *  3. mais regiões: aumenta o teto de bairros conhecidos e adiciona
 *     sub-regiões genéricas (Centro/Zona Norte/Zona Sul/...) para cidades
 *     sem bairro mapeado;
 *  4. combinação ampla final (todos os segmentos × todas as regiões, com
 *     formulações adicionais).
 *
 * A camada 5 do pedido original ("outras fontes") não é uma camada de
 * consulta — é resolvida à parte, registrando mais uma `LeadSource` no
 * orquestrador (`discovery/index.ts`), que já roda TODAS as fontes
 * configuradas em toda consulta, desta e das camadas acima.
 */
import { generateText, isAiDemoMode } from "@/lib/ai";
import { parseJsonFromText } from "@/lib/anthropic/client";
import { expandRegions, hasKnownDistricts } from "./regions";
import type { CampaignBrief } from "./types";

export interface ExpansionState {
  /** Quantas camadas já foram tentadas nesta rodada (0 = nenhuma ainda). */
  layer: number;
  /** Segmentos de comprador extras já incorporados (evita repetir a IA). */
  extraSegments: string[];
  /** Teto atual de unidades de região (cidade + bairros) usado na expansão. */
  districtCap: number;
}

export const DEFAULT_EXPANSION_STATE: ExpansionState = {
  layer: 0,
  extraSegments: [],
  districtCap: 16,
};

export const MAX_EXPANSION_LAYER = 4;

/** Lê `discovery_runs.expansion_state` (jsonb) com defaults seguros. */
export function normalizeExpansionState(raw: unknown): ExpansionState {
  const r = (raw ?? {}) as Partial<ExpansionState>;
  return {
    layer: typeof r.layer === "number" ? r.layer : DEFAULT_EXPANSION_STATE.layer,
    extraSegments: Array.isArray(r.extraSegments)
      ? r.extraSegments.filter((s): s is string => typeof s === "string")
      : [],
    districtCap:
      typeof r.districtCap === "number" ? r.districtCap : DEFAULT_EXPANSION_STATE.districtCap,
  };
}

const GENERIC_SUBREGIONS = [
  "Centro",
  "Zona Norte",
  "Zona Sul",
  "Zona Leste",
  "Zona Oeste",
  "Região Central",
];

/** Unidades de região + sub-regiões genéricas para cidades sem bairro mapeado. */
function regionUnitsWithFallback(regions: string[], cap: number): string[] {
  const known = expandRegions(regions, cap).map((u) => u.label);
  const extra: string[] = [];
  for (const city of regions) {
    if (!hasKnownDistricts(city)) {
      for (const sub of GENERIC_SUBREGIONS) extra.push(`${sub}, ${city}`);
    }
  }
  return [...new Set([...known, ...extra])];
}

const EXTRA_SEGMENTS_SYSTEM = `Você ajuda um sistema de prospecção B2B a AMPLIAR a busca por
compradores de um produto. Dado um produto e segmentos de comprador JÁ
tentados (sem resultado suficiente), sugira NOVOS segmentos de empresas que
também poderiam comprar esse produto — categorias diferentes das já
tentadas, e sinônimos/variações das mesmas categorias (ex.: "loja de
roupas" também pode ser "boutique", "moda feminina", "vestuário"). Nunca
sugira fornecedores/fabricantes do mesmo produto (concorrentes). Responda
SOMENTE JSON.`;

async function aiExtraSegments(
  companyId: string,
  brief: CampaignBrief,
  excluded: string[],
): Promise<string[]> {
  if (await isAiDemoMode(companyId)) return [];
  const prompt = `## Produto vendido
Nome: ${brief.productContext.name}
${brief.productContext.description ? `Descrição: ${brief.productContext.description}` : ""}
${brief.productContext.applications.length ? `Aplicações: ${brief.productContext.applications.join(", ")}` : ""}

## Segmentos de comprador já tentados (não repita estes, nem sinônimos óbvios deles)
${excluded.length ? excluded.join(", ") : "(nenhum ainda)"}

## Tarefa
{
  "segments": ["12 a 20 novos segmentos de empresas compradoras, em português, minúsculas, sem repetir os já tentados"]
}`;
  try {
    const res = await generateText({
      companyId,
      system: EXTRA_SEGMENTS_SYSTEM,
      prompt,
      maxTokens: 800,
    });
    const parsed = parseJsonFromText<{ segments?: string[] }>(res.text);
    const excludedSet = new Set(excluded.map((s) => s.toLowerCase()));
    return (parsed.segments ?? [])
      .filter((s) => typeof s === "string" && s.trim())
      .map((s) => s.trim().toLowerCase())
      .filter((s) => !excludedSet.has(s))
      .filter((s, i, a) => a.indexOf(s) === i)
      .slice(0, 20);
  } catch {
    return [];
  }
}

export interface ExpansionResult {
  queries: string[];
  nextState: ExpansionState;
  note: string;
}

/**
 * Gera a próxima leva de consultas quando o plano atual se esgotou antes da
 * meta. Avança camada a camada até produzir ao menos uma consulta nova (não
 * presente em `usedQueries`) ou esgotar `MAX_EXPANSION_LAYER` — nesse caso
 * `queries` vem vazio e quem chama deve encerrar a rodada de verdade.
 */
export async function expandSearchStrategy(params: {
  companyId: string;
  brief: CampaignBrief;
  usedQueries: string[];
  expansionState: ExpansionState;
}): Promise<ExpansionResult> {
  const { companyId, brief, usedQueries } = params;
  const usedSet = new Set(usedQueries);
  const regions = brief.regions.length ? brief.regions : ["Brasil"];
  const baseSegments = brief.buyerProfile.buyerSegments.length
    ? brief.buyerProfile.buyerSegments
    : ["comércio local"];

  let state = { ...params.expansionState };
  let queries: string[] = [];
  let note = "";

  const dedupe = (qs: string[]) =>
    qs
      .map((q) => q.replace(/\s+/g, " ").trim())
      .filter((q, i, a) => q.length > 2 && a.indexOf(q) === i && !usedSet.has(q));

  while (queries.length === 0 && state.layer < MAX_EXPANSION_LAYER) {
    const layer = state.layer + 1;
    state = { ...state, layer };

    if (layer === 1) {
      // Camada: mais variações de intenção sobre os mesmos segmentos/regiões.
      const units = expandRegions(regions, state.districtCap).map((u) => u.label);
      const intents = ["endereço", "telefone", "instagram", "avaliações", "site"];
      const gen: string[] = [];
      for (const seg of baseSegments)
        for (const unit of units) for (const intent of intents) gen.push(`${seg} ${unit} ${intent}`);
      queries = dedupe(gen);
      note = "camada 1: variações de intenção sobre os segmentos/regiões já usados";
    } else if (layer === 2) {
      // Camada: novos segmentos de comprador via IA (cobre categorias e sinônimos).
      const extra = await aiExtraSegments(companyId, brief, [
        ...baseSegments,
        ...state.extraSegments,
      ]);
      if (extra.length) {
        state = { ...state, extraSegments: [...state.extraSegments, ...extra] };
        const units = expandRegions(regions, state.districtCap).map((u) => u.label);
        const intents = ["", "contato", "whatsapp"];
        const gen: string[] = [];
        for (const seg of extra)
          for (const unit of units)
            for (const intent of intents) gen.push(`${seg} ${unit}${intent ? " " + intent : ""}`);
        queries = dedupe(gen);
      }
      note = "camada 2: novos segmentos de comprador (via IA)";
    } else if (layer === 3) {
      // Camada: mais regiões — aumenta o teto de bairros + sub-regiões genéricas.
      state = { ...state, districtCap: state.districtCap + 24 };
      const allSegments = [...baseSegments, ...state.extraSegments];
      const units = regionUnitsWithFallback(regions, state.districtCap);
      const intents = ["", "contato"];
      const gen: string[] = [];
      for (const seg of allSegments)
        for (const unit of units)
          for (const intent of intents) gen.push(`${seg} ${unit}${intent ? " " + intent : ""}`);
      queries = dedupe(gen);
      note = "camada 3: mais regiões (bairros/sub-regiões adicionais)";
    } else if (layer === 4) {
      // Camada final: combinação ampla com formulações adicionais.
      const allSegments = [...baseSegments, ...state.extraSegments];
      const units = regionUnitsWithFallback(regions, state.districtCap);
      const gen: string[] = [];
      for (const seg of allSegments)
        for (const unit of units) {
          gen.push(`"${seg}" ${unit}`);
          gen.push(`${seg} perto de ${unit}`);
          gen.push(`onde encontrar ${seg} em ${unit}`);
        }
      queries = dedupe(gen);
      note = "camada 4: combinação ampla final";
    }
  }

  return { queries: queries.slice(0, 200), nextState: state, note };
}
