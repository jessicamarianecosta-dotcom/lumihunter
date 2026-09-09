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
  "gostaria","quanto","fica","sai","seria","dá","tá","ta","aí","ai","favor","por",
  "ola","olá","oi","bom","dia","tarde","noite","obrigado","obrigada","você","vc",
]);

/**
 * Descritores comerciais genéricos: aparecem em quase todo nome de produto e
 * NÃO identificam um produto. Nunca contam como relevância na busca.
 */
const GENERIC = new Set([
  "personalizado","personalizada","personalizados","personalizadas","personalizar",
  "custom","customizado","customizada","exclusivo","exclusiva",
  "sob","medida","brinde","brindes","kit","kits","produto","produtos",
  "servico","serviço","impresso","impressa","grafica","gráfica",
]);

export interface DerivedQuery {
  /** consulta legível (para logs/telemetria). */
  query: string;
  /** palavras que IDENTIFICAM o produto (sem descritores genéricos). */
  terms: string[];
  /** especificações estruturadas mencionadas (couché 300g, 100un, 9x5…). */
  specs: string[];
}

/**
 * Extrai os termos de busca + especificações de uma mensagem livre. Puro.
 * Ex.: "quanto custa uma caneca personalizada?" →
 *   { query: "caneca personalizada", terms: ["caneca"], specs: [] }
 */
export function deriveCommercialQuery(message: string): DerivedQuery {
  const text = message.toLowerCase();
  const specs = [
    ...new Set(
      SPEC_PATTERNS.flatMap((re) => Array.from(text.matchAll(re), (m) => m[0].trim())),
    ),
  ];
  const words = text
    .replace(/[.!?,;:/()]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

  const terms = [...new Set(words.filter((w) => !GENERIC.has(w)))].slice(0, 8);
  const query = [...new Set(words)].slice(0, 8).join(" ").trim();
  return { query: query || message.trim().slice(0, 60), terms, specs };
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
  FOUND: "Produto/variação identificado. Responda com base SÓ no que está aqui.",
  PARTIAL:
    "Produto identificado, mas falta UMA informação para chegar ao preço. Faça só a próxima pergunta necessária (não pergunte o que o cliente já disse).",
  AMBIGUOUS:
    "Ainda há mais de um produto/modelo possível. A resposta deve APRESENTAR essas opções (só os nomes) e PERGUNTAR qual o cliente quer. NÃO escolha um por conta própria. NÃO cite preço ainda — o preço depende da escolha.",
  NOT_FOUND:
    "Esse produto NÃO existe em nenhuma fonte (base local nem Precy+). NÃO invente. Diga que não encontrou ESSE item e peça mais detalhes se fizer sentido. NUNCA ofereça outros produtos do catálogo como substituto.",
  SOURCE_UNAVAILABLE:
    "A fonte de catálogo está indisponível agora. NÃO invente preço. Ofereça encaminhar para atendimento. NÃO ofereça outros produtos.",
};

/**
 * Regra que garante que as 3 respostas sugeridas sejam 3 REDAÇÕES da MESMA
 * resposta — nunca 3 produtos/caminhos diferentes.
 */
const REPLY_RULE = `COMO ESCREVER AS 3 "suggested_replies":
- São 3 REDAÇÕES ALTERNATIVAS da MESMA resposta: mesmo(s) produto(s), mesmo(s)
  preço(s), mesma pergunta/intenção. Variam só tom, ordem da frase, emojis e CTA.
- NUNCA use uma resposta para um produto e outra para outro produto.
- Se ainda falta o cliente escolher (produto/modelo/variação/quantidade), TODAS
  as 3 fazem a MESMA pergunta, apresentando as MESMAS opções.
- Só cite preço/especificação que apareça na BASE COMERCIAL acima.`;

/** Bloco de contexto pronto para o prompt. Puro. */
export function renderCommercialContext(outcome: SearchOutcome): string {
  const body = outcome.products.slice(0, 6).map(renderProduct).join("\n\n");

  let hint = "";
  if (outcome.kind === "AMBIGUOUS") {
    const names = outcome.products.map((p) => `"${p.name}"`).join(", ");
    hint = `\n\nOpções a apresentar (todas, em cada resposta): ${names}. Peça ao cliente para escolher.`;
  } else if (outcome.kind === "PARTIAL" && outcome.missingSpecs?.length) {
    hint = `\n\nFalta o cliente escolher: ${outcome.missingSpecs.join(" ou ")}. Pergunte isso (mesma pergunta nas 3 respostas), mostrando o preço de cada opção quando houver.`;
  }

  return `## BASE COMERCIAL\n${HEADER[outcome.kind]}\n\n${body || "(sem itens)"}${hint}\n\n${REPLY_RULE}`;
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

  // Sem nenhum termo que identifique um produto (ex.: "quanto custa?") →
  // não sai listando o catálogo; pede o produto.
  if (derived.terms.length === 0) {
    return {
      outcome: {
        kind: "NOT_FOUND",
        query: derived.query,
        products: [],
        sourcesChecked: [],
        note: "O cliente não disse qual produto — pergunte qual produto/serviço ele procura.",
      },
      contextText:
        "## BASE COMERCIAL\nO cliente ainda não disse QUAL produto quer. Pergunte qual produto/serviço ele procura antes de falar preço. NÃO liste o catálogo.",
      derived,
    };
  }

  let outcome = await searchCatalog({
    companyId: args.companyId,
    query: derived.query,
    terms: derived.terms,
    requestedSpecs: derived.specs,
  });

  // Fallback: nada na base local → consulta o catálogo online conectado (Precy+).
  if (outcome.kind === "NOT_FOUND") {
    const remote = await livePrecySearch({
      companyId: args.companyId,
      query: derived.query,
      terms: derived.terms,
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
