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
import { livePrecySearch } from "./live";
import type { CommercialProduct, SearchOutcome } from "./types";

export { livePrecySearch, precyIsConsultable } from "./live";

/** Instrução anti-invenção — injetada no system prompt de todo agente comercial. */
export const ANTI_INVENTION_RULE = `REGRA ABSOLUTA — NUNCA INVENTE informação comercial.
Você só pode afirmar que um produto, preço, material, gramatura, medida,
acabamento, quantidade, prazo ou disponibilidade EXISTE se isso aparecer na
seção "BASE COMERCIAL" desta conversa.
- Se a base não trouxer o item: diga que vai verificar / que não encontrou aquela
  opção, e ofereça o que REALMENTE existe na base. Nunca diga "sim, fazemos" sem
  respaldo.
- Se o produto existe mas falta uma especificação para fechar preço/variação:
  pergunte só o que falta.
- Se há várias opções possíveis: apresente-as ou pergunte, nunca escolha sozinho.
- Conhecimento geral serve só para explicar conceitos, jamais para definir preço,
  especificação ou disponibilidade.`;

// ── Derivação da consulta a partir de uma mensagem do cliente (pura) ────────
const SPEC_PATTERNS: RegExp[] = [
  /\bcouch[êe]\s*\d{2,3}\s*g?\b/gi,
  /\b\d{2,4}\s?g\b/gi, //           gramatura: 300g
  /\b\d{1,3}\s?x\s?\d{1,3}(\s?cm)?\b/gi, // medida: 9x5
  /\b\d{2,5}\s?(un|unidades|und|pçs|peças)\b/gi, // quantidade
  /\bfrente e verso\b/gi,
  /\b(fosco|brilho|holográfic[oa]|laminad[oa]|verniz)\b/gi,
];

const STOPWORDS = new Set([
  "quero","preciso","vocês","voces","fazem","tem","teria","de","do","da","um","uma",
  "com","para","por","quanto","custa","qual","valor","preço","preco","o","a","e",
  "me","manda","gostaria","orçamento","orcamento","fazer","consigo","poderia",
]);

export interface DerivedQuery {
  query: string;
  specs: string[];
}

/**
 * Extrai um termo de busca + especificações mencionadas de uma mensagem livre.
 * Puro. Ex.: "quero cartão de visita couché 300g frente e verso" →
 *   { query: "cartão visita", specs: ["couché 300g", "300g", "frente e verso"] }
 */
export function deriveCommercialQuery(message: string): DerivedQuery {
  const text = message.toLowerCase();
  const specs = [
    ...new Set(
      SPEC_PATTERNS.flatMap((re) => Array.from(text.matchAll(re), (m) => m[0].trim())),
    ),
  ];
  const query = text
    .replace(/[.!?,;:]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .slice(0, 8)
    .join(" ")
    .trim();
  return { query: query || message.trim().slice(0, 60), specs };
}

// ── Renderização do contexto para o prompt (pura) ──────────────────────────
function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function renderProduct(p: CommercialProduct): string {
  const lines: string[] = [];
  lines.push(`### ${p.name}${p.isActive ? "" : " (inativo)"}`);
  if (p.category) lines.push(`Categoria: ${p.category}`);
  if (p.description) lines.push(p.description.slice(0, 240));
  const active = p.variants.filter((v) => v.isActive).slice(0, 12);
  if (active.length === 0) {
    lines.push("Sem variações/preços cadastrados.");
  }
  for (const v of active) {
    const specs = [
      ...v.optionLabels,
      ...Object.entries(v.attributes)
        .filter(([, val]) => val != null && val !== "")
        .map(([k, val]) => `${k}: ${val}`),
    ].join(" · ");
    let price: string;
    if (v.priceKind === "quote") price = "sob orçamento";
    else if (v.priceTiers?.length)
      price = v.priceTiers
        .map((t) => `${t.min_qty}un ${fmtBRL(t.price)}`)
        .join(" / ");
    else price = typeof v.price === "number" ? fmtBRL(v.price) : "SEM PREÇO CADASTRADO";
    const extra = [
      v.minQuantity ? `mín. ${v.minQuantity}` : null,
      v.leadTimeDays ? `prazo ${v.leadTimeDays}d` : null,
    ]
      .filter(Boolean)
      .join(", ");
    lines.push(`- ${specs || "padrão"} → ${price}${extra ? ` (${extra})` : ""}`);
  }
  return lines.join("\n");
}

const HEADER: Record<SearchOutcome["kind"], string> = {
  FOUND: "Produto encontrado na base comercial. Responda com base SÓ no que está aqui:",
  PARTIAL:
    "Produto encontrado, mas falta especificação para definir preço/variação. Pergunte só o que falta:",
  AMBIGUOUS:
    "Vários produtos possíveis — apresente as opções ou pergunte qual, NÃO escolha sozinho:",
  NOT_FOUND:
    "NADA na base comercial corresponde. NÃO invente. Diga que vai verificar essa opção.",
  SOURCE_UNAVAILABLE:
    "A fonte de catálogo está indisponível agora. NÃO invente preço. Ofereça encaminhar para atendimento.",
};

/** Bloco de contexto pronto para o prompt. Puro. */
export function renderCommercialContext(outcome: SearchOutcome): string {
  const body = outcome.products.slice(0, 4).map(renderProduct).join("\n\n");
  const missing =
    outcome.kind === "PARTIAL" && outcome.missingSpecs?.length
      ? `\n\nEspecificações a confirmar com o cliente: ${outcome.missingSpecs.join(", ")}.`
      : "";
  return `## BASE COMERCIAL\n${HEADER[outcome.kind]}\n\n${body || "(sem itens)"}${missing}`;
}

/**
 * Consulta a Base Comercial a partir de uma pergunta do cliente e devolve o
 * contexto pronto para colar no prompt + o `outcome` (para o agente decidir o
 * tom). Filtra por `companyId` — nunca cruza empresas.
 */
export async function buildCommercialContext(args: {
  companyId: string;
  message: string;
}): Promise<{ outcome: SearchOutcome; contextText: string; derived: DerivedQuery }> {
  const derived = deriveCommercialQuery(args.message);
  let outcome = await searchCatalog({
    companyId: args.companyId,
    query: derived.query,
    requestedSpecs: derived.specs,
  });

  // Fallback: nada na base local → consulta o catálogo online conectado (Precy+).
  if (outcome.kind === "NOT_FOUND") {
    const words = derived.query.split(/\s+/).map((w) => w.toLowerCase());
    const remote = await livePrecySearch({
      companyId: args.companyId,
      query: derived.query,
      words,
      requestedSpecs: derived.specs,
    });
    if (remote && remote.kind !== "NOT_FOUND") outcome = remote;
    else if (remote) {
      // remoto também vazio: registra que ambas as fontes foram checadas
      outcome = { ...outcome, sourcesChecked: [...outcome.sourcesChecked, { source: "precy_online", ok: true }] };
    }
  }

  return { outcome, contextText: renderCommercialContext(outcome), derived };
}
