/**
 * Base Comercial — schema e normalização da extração de catálogo (PDF).
 *
 * Tudo aqui é puro (sem I/O) e validado com zod, para que a extração da IA
 * nunca entre no banco sem estrutura. Se a saída do modelo não casar com o
 * schema, o job vai para erro/revisão — nunca importação silenciosa.
 */
import { z } from "zod";

// ── Schema da resposta do modelo ────────────────────────────────────────────
const AttrValue = z.union([z.string(), z.number(), z.null()]);

const RawVariant = z.object({
  /** Escolha por grupo: { "Material": "Couché 250g", "Impressão": "Frente e verso" } */
  options: z.record(z.string(), z.string()).default({}),
  attributes: z.record(z.string(), AttrValue).default({}),
  priceKind: z
    .enum(["fixed", "per_unit", "per_quantity", "quote"])
    .default("fixed"),
  price: z.number().nonnegative().nullable().default(null),
  /** Faixas de quantidade do MESMO produto/variação: [{minQty, price}] */
  priceTiers: z
    .array(z.object({ minQty: z.number().int().positive(), price: z.number().nonnegative() }))
    .nullable()
    .default(null),
  quantity: z.number().int().positive().nullable().default(null),
  minQuantity: z.number().int().positive().nullable().default(null),
  unit: z.string().nullable().default(null),
  leadTimeDays: z.number().int().nonnegative().nullable().default(null),
  sku: z.string().nullable().default(null),
});

const RawItem = z.object({
  name: z.string().min(1),
  description: z.string().nullable().default(null),
  category: z.string().nullable().default(null),
  kind: z.enum(["product", "service"]).default("product"),
  /** Atributos do produto (comuns a todas as variações). */
  attributes: z.record(z.string(), AttrValue).default({}),
  /** Grupos de variação e seus valores possíveis. */
  variationGroups: z
    .array(z.object({ name: z.string().min(1), values: z.array(z.string().min(1)) }))
    .default([]),
  variants: z.array(RawVariant).default([]),
  confidence: z.enum(["ok", "review"]).default("review"),
  notes: z.string().nullable().default(null),
});

export const ExtractionSchema = z.object({ items: z.array(RawItem) });
export type RawExtractionItem = z.infer<typeof RawItem>;
export type RawExtractionVariant = z.infer<typeof RawVariant>;

// ── Estrutura normalizada (o que vai para a tela de revisão / banco) ────────
export interface NormalizedVariant {
  /** rótulos legíveis, ex.: ["Couché 250g", "Frente e verso"] */
  optionLabels: string[];
  /** grupo → valor, ex.: { "Material": "Couché 250g" } */
  optionsByGroup: Record<string, string>;
  attributes: Record<string, string | number | null>;
  priceKind: "fixed" | "per_unit" | "per_quantity" | "quote";
  price: number | null;
  priceTiers: { minQty: number; price: number }[] | null;
  quantity: number | null;
  minQuantity: number | null;
  unit: string | null;
  leadTimeDays: number | null;
  sku: string | null;
}

export interface NormalizedItem {
  name: string;
  description: string | null;
  category: string | null;
  kind: "product" | "service";
  attributes: Record<string, string | number | null>;
  variationGroups: { name: string; values: string[] }[];
  variants: NormalizedVariant[];
  confidence: "ok" | "review";
  needsReview: boolean;
  notes: string | null;
}

export const EXTRACTION_SYSTEM = `Você extrai um catálogo comercial de um PDF e devolve APENAS JSON válido.

REGRAS INVIOLÁVEIS
- NÃO invente NADA. Só registre o que está EXPLÍCITO no PDF.
- Campo sem informação clara → null. Nunca preencha por dedução.
- Se você NÃO conseguir determinar com segurança qual preço pertence a qual
  variação, ou qual atributo pertence a qual produto → "confidence": "review"
  e explique em "notes". Nunca chute a relação.

COMO ESTRUTURAR
- "attributes" do PRODUTO: o que vale para todas as variações (ex.: tamanho,
  medidas, cor base). Use as chaves naturais do ramo: para gráfica
  {tamanho, material, gramatura, acabamento, impressao}; para vela
  {fragrancia, peso, recipiente}; para confeitaria {sabor, tamanho, recheio};
  etc. NÃO force "gramatura" onde o produto usa "peso".
- "variationGroups": os eixos de escolha (ex.: [{ "name":"Material",
  "values":["Couché 250g","Couché 300g"] }, { "name":"Impressão",
  "values":["Frente","Frente e verso"] }]).
- "variants": cada combinação concreta com preço. "options" mapeia
  grupo→valor escolhido. Preserve a relação opção↔preço do PDF.
- Tabela de preço por quantidade do MESMO item (100un R$20 / 200un R$35 / …):
  UMA variante com "priceKind":"per_quantity" e "priceTiers":[{minQty,price}…].
  NÃO crie um produto por linha da tabela.

Schema:
{"items":[{
  "name": string,
  "description": string|null,
  "category": string|null,
  "kind": "product"|"service",
  "attributes": { "<attr>": string|number|null },
  "variationGroups": [{ "name": string, "values": string[] }],
  "variants": [{
    "options": { "<grupo>": "<valor>" },
    "attributes": { "<attr>": string|number|null },
    "priceKind": "fixed"|"per_unit"|"per_quantity"|"quote",
    "price": number|null,
    "priceTiers": [{ "minQty": number, "price": number }]|null,
    "quantity": number|null,
    "minQuantity": number|null,
    "unit": string|null,
    "leadTimeDays": number|null,
    "sku": string|null
  }],
  "confidence": "ok"|"review",
  "notes": string|null
}]}`;

export interface ParseResult {
  ok: boolean;
  items: NormalizedItem[];
  error?: string;
}

function sliceJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start >= 0 && end >= 0 ? text.slice(start, end + 1) : text;
}

/** Valida a saída bruta do modelo e normaliza. Nunca lança. */
export function parseExtraction(text: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(sliceJson(text));
  } catch {
    return { ok: false, items: [], error: "resposta da IA não é JSON válido" };
  }
  const parsed = ExtractionSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      items: [],
      error: `estrutura inesperada: ${parsed.error.issues
        .slice(0, 3)
        .map((i) => i.path.join(".") + " " + i.message)
        .join("; ")}`,
    };
  }
  return { ok: true, items: parsed.data.items.map(normalizeItem) };
}

/** Regras de consistência que forçam revisão mesmo com JSON válido. */
export function normalizeItem(raw: RawExtractionItem): NormalizedItem {
  const variants = raw.variants.map((v) => normalizeVariant(v, raw.variationGroups));

  const reasons: string[] = [];
  // variante sem preço nem tiers nem "quote" explícito → relação preço↔variação incerta
  const pricelessNonQuote = variants.some(
    (v) =>
      v.priceKind !== "quote" &&
      v.price == null &&
      (!v.priceTiers || v.priceTiers.length === 0),
  );
  if (pricelessNonQuote) reasons.push("variação sem preço identificado");
  // grupo declarado mas nenhuma variante usa → estrutura frouxa
  const usedGroups = new Set(variants.flatMap((v) => Object.keys(v.optionsByGroup)));
  const danglingGroup = raw.variationGroups.some((g) => !usedGroups.has(g.name));
  if (danglingGroup && raw.variationGroups.length > 0 && variants.length > 0) {
    reasons.push("grupo de variação sem preço associado");
  }
  if (variants.length === 0 && raw.kind === "product") {
    reasons.push("nenhuma variação/preço extraído");
  }

  const needsReview = raw.confidence === "review" || reasons.length > 0;
  const notes = [raw.notes, ...reasons].filter(Boolean).join(" · ") || null;

  return {
    name: raw.name.trim(),
    description: raw.description,
    category: raw.category,
    kind: raw.kind,
    attributes: raw.attributes,
    variationGroups: raw.variationGroups,
    variants,
    confidence: needsReview ? "review" : "ok",
    needsReview,
    notes,
  };
}

function normalizeVariant(
  v: RawExtractionVariant,
  groups: { name: string; values: string[] }[],
): NormalizedVariant {
  const optionsByGroup: Record<string, string> = {};
  for (const [g, val] of Object.entries(v.options)) {
    if (val) optionsByGroup[g] = val;
  }
  // ordena os rótulos pela ordem dos grupos declarados
  const order = new Map(groups.map((g, i) => [g.name, i]));
  const optionLabels = Object.entries(optionsByGroup)
    .sort((a, b) => (order.get(a[0]) ?? 99) - (order.get(b[0]) ?? 99))
    .map(([, val]) => val);

  const tiers =
    v.priceTiers && v.priceTiers.length
      ? [...v.priceTiers].sort((a, b) => a.minQty - b.minQty)
      : null;

  return {
    optionLabels,
    optionsByGroup,
    attributes: v.attributes,
    priceKind: tiers ? "per_quantity" : v.priceKind,
    price: v.price,
    priceTiers: tiers,
    quantity: v.quantity,
    minQuantity: v.minQuantity ?? v.quantity ?? null,
    unit: v.unit,
    leadTimeDays: v.leadTimeDays,
    sku: v.sku,
  };
}

/** Extração de exemplo (modo dev sem chave de IA) — claramente sintética. */
export function demoExtraction(): NormalizedItem[] {
  return [
    normalizeItem({
      name: "Cartão de visita",
      description: "Exemplo sintético (modo demo — sem chave de IA configurada).",
      category: "Gráfica",
      kind: "product",
      attributes: { tamanho: "9x5 cm", material: "Couché" },
      variationGroups: [
        { name: "Gramatura", values: ["250g", "300g"] },
        { name: "Impressão", values: ["Frente", "Frente e verso"] },
      ],
      variants: [
        {
          options: { Gramatura: "250g", Impressão: "Frente" },
          attributes: {},
          priceKind: "per_quantity",
          price: null,
          priceTiers: [
            { minQty: 100, price: 30 },
            { minQty: 500, price: 90 },
          ],
          quantity: null,
          minQuantity: 100,
          unit: "un",
          leadTimeDays: 3,
          sku: null,
        },
        {
          options: { Gramatura: "250g", Impressão: "Frente e verso" },
          attributes: {},
          priceKind: "per_quantity",
          price: null,
          priceTiers: [{ minQty: 100, price: 39 }],
          quantity: null,
          minQuantity: 100,
          unit: "un",
          leadTimeDays: 3,
          sku: null,
        },
      ],
      confidence: "ok",
      notes: null,
    }),
    normalizeItem({
      name: "Banner",
      description: null,
      category: "Comunicação Visual",
      kind: "product",
      attributes: { tamanho: "60x40 cm" },
      variationGroups: [],
      variants: [
        {
          options: {},
          attributes: {},
          priceKind: "quote",
          price: null,
          priceTiers: null,
          quantity: null,
          minQuantity: null,
          unit: null,
          leadTimeDays: null,
          sku: null,
        },
      ],
      confidence: "review",
      notes: "Material e preço não localizados no PDF de exemplo.",
    }),
  ];
}
