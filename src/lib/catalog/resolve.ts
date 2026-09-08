/**
 * Base Comercial — consolidação de fontes (funções puras, testáveis).
 *
 * Regra de prioridade: precy_online > pdf > manual.
 * Mas a consolidação é "inteligente": campos complementares de uma fonte de
 * menor prioridade NÃO são apagados só porque a fonte principal não os tem.
 * Só há substituição quando há CONFLITO DIRETO no mesmo campo.
 */
import {
  SOURCE_PRIORITY,
  type CatalogSourceKind,
  type CommercialProduct,
  type CommercialVariant,
  type SearchOutcome,
  type SearchOutcomeKind,
} from "./types";

export function higherPriority(
  a: CatalogSourceKind,
  b: CatalogSourceKind,
): CatalogSourceKind {
  return SOURCE_PRIORITY[a] >= SOURCE_PRIORITY[b] ? a : b;
}

/**
 * Resolve um conflito de preço entre fontes.
 * Ex.: PDF diz R$ 35, Precy+ diz R$ 39 → usa 39 (Precy+ é a fonte dinâmica).
 * Retorna o preço da fonte de maior prioridade que tem um valor definido.
 */
export function resolvePriceConflict(
  candidates: { source: CatalogSourceKind; price: number | null }[],
): { price: number | null; source: CatalogSourceKind | null; conflict: boolean } {
  const withPrice = candidates.filter(
    (c): c is { source: CatalogSourceKind; price: number } =>
      typeof c.price === "number" && Number.isFinite(c.price),
  );
  if (withPrice.length === 0) return { price: null, source: null, conflict: false };

  withPrice.sort((a, b) => SOURCE_PRIORITY[b.source] - SOURCE_PRIORITY[a.source]);
  const winner = withPrice[0];
  const distinct = new Set(withPrice.map((c) => c.price));
  return { price: winner.price, source: winner.source, conflict: distinct.size > 1 };
}

/**
 * Consolida um mesmo produto vindo de várias fontes num único
 * `CommercialProduct`. `parts` deve estar ordenado por prioridade crescente ou
 * decrescente — a função ordena internamente.
 */
export function mergeProductSources(
  parts: CommercialProduct[],
): CommercialProduct {
  if (parts.length === 0) throw new Error("mergeProductSources: sem partes");
  const ordered = [...parts].sort(
    (a, b) => SOURCE_PRIORITY[a.source] - SOURCE_PRIORITY[b.source],
  );

  // Começa da fonte de menor prioridade e vai sobrescrevendo campos preenchidos.
  const merged: CommercialProduct = { ...ordered[0] };
  const sources = new Set<CatalogSourceKind>([ordered[0].source]);

  for (const part of ordered.slice(1)) {
    sources.add(part.source);
    merged.source = higherPriority(merged.source, part.source);
    // sobrescreve só o que a fonte de maior prioridade realmente informa
    if (part.name) merged.name = part.name;
    if (part.description != null) merged.description = part.description;
    if (part.category != null) merged.category = part.category;
    if (part.externalUrl != null) merged.externalUrl = part.externalUrl;
    if (part.lastSyncedAt != null) merged.lastSyncedAt = part.lastSyncedAt;
    merged.isActive = part.isActive;
    merged.needsReview = merged.needsReview || part.needsReview;
    // variantes: união por assinatura de opções; conflito de preço → prioridade
    merged.variants = mergeVariants(merged.variants, part.variants);
  }

  merged.contributingSources = [...sources].sort(
    (a, b) => SOURCE_PRIORITY[b] - SOURCE_PRIORITY[a],
  );
  merged.priceRange = priceRangeOf(merged.variants);
  return merged;
}

function variantSignature(v: CommercialVariant): string {
  return [...v.optionLabels].map((s) => s.toLowerCase().trim()).sort().join(" | ");
}

export function mergeVariants(
  a: CommercialVariant[],
  b: CommercialVariant[],
): CommercialVariant[] {
  const bySig = new Map<string, CommercialVariant>();
  for (const v of a) bySig.set(variantSignature(v), v);
  for (const v of b) {
    const sig = variantSignature(v);
    const existing = bySig.get(sig);
    if (!existing) {
      bySig.set(sig, v);
      continue;
    }
    const { price, source } = resolvePriceConflict([
      { source: existing.source, price: existing.price },
      { source: v.source, price: v.price },
    ]);
    bySig.set(sig, {
      ...existing,
      // preenche buracos com a outra fonte
      sku: existing.sku ?? v.sku,
      attributes: { ...v.attributes, ...existing.attributes },
      leadTimeDays: existing.leadTimeDays ?? v.leadTimeDays,
      stockQuantity: existing.stockQuantity ?? v.stockQuantity,
      minQuantity: existing.minQuantity ?? v.minQuantity,
      notes: existing.notes ?? v.notes,
      price,
      source: source ?? existing.source,
      needsReview: existing.needsReview || v.needsReview,
    });
  }
  return [...bySig.values()];
}

export function priceRangeOf(
  variants: CommercialVariant[],
): { min: number; max: number } | null {
  const prices = variants
    .filter((v) => v.isActive && typeof v.price === "number")
    .map((v) => v.price as number);
  if (prices.length === 0) return null;
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

// ── Classificação semântica de uma busca (Fase 8) ────────────────────────

export interface ClassifyInput {
  query: string;
  matches: CommercialProduct[];
  /** Termos de especificação que o cliente já mencionou (ex.: ["couché 300g"]). */
  requestedSpecs?: string[];
  sourcesChecked: { source: CatalogSourceKind; ok: boolean }[];
}

/**
 * Decide o `SearchOutcomeKind` a partir dos matches.
 * Pura — não toca no banco.
 */
export function classifySearch(input: ClassifyInput): SearchOutcome {
  const { query, matches, requestedSpecs = [], sourcesChecked } = input;

  const anySourceDown = sourcesChecked.some((s) => !s.ok);
  const allNeededSourcesDown =
    sourcesChecked.length > 0 && sourcesChecked.every((s) => !s.ok);

  if (matches.length === 0) {
    if (allNeededSourcesDown) {
      return {
        kind: "SOURCE_UNAVAILABLE",
        query,
        products: [],
        sourcesChecked,
        note: "Nenhuma fonte de catálogo respondeu.",
      };
    }
    return { kind: "NOT_FOUND", query, products: [], sourcesChecked };
  }

  if (matches.length > 1) {
    return { kind: "AMBIGUOUS", query, products: matches, sourcesChecked };
  }

  // exatamente 1 produto
  const product = matches[0];
  const specText = requestedSpecs.map((s) => s.toLowerCase()).join(" ");
  const activeVariants = product.variants.filter((v) => v.isActive);

  // Se o cliente pediu especificações e nenhuma variante ativa casa com todas → PARTIAL
  const matchingVariants = specText
    ? activeVariants.filter((v) =>
        requestedSpecs.every((spec) =>
          [...v.optionLabels, ...Object.values(v.attributes).map(String)]
            .join(" ")
            .toLowerCase()
            .includes(spec.toLowerCase()),
        ),
      )
    : activeVariants;

  const groupsWithoutChoice = missingSpecGroups(product, requestedSpecs);

  if (specText && matchingVariants.length === 0) {
    return {
      kind: "PARTIAL",
      query,
      products: [product],
      missingSpecs: groupsWithoutChoice,
      sourcesChecked,
      note: "Produto existe, mas a especificação pedida não aparece nas opções cadastradas.",
    };
  }

  if (groupsWithoutChoice.length > 0 && matchingVariants.length !== 1) {
    return {
      kind: "PARTIAL",
      query,
      products: [product],
      missingSpecs: groupsWithoutChoice,
      sourcesChecked,
    };
  }

  return { kind: "FOUND", query, products: [product], sourcesChecked };
}

/**
 * Grupos de variação do produto para os quais o cliente ainda não deu uma
 * escolha (nome do grupo não aparece nos specs pedidos).
 */
export function missingSpecGroups(
  product: CommercialProduct,
  requestedSpecs: string[],
): string[] {
  const said = requestedSpecs.join(" ").toLowerCase();
  const groups = new Set<string>();
  for (const v of product.variants) {
    for (const label of v.optionLabels) {
      // heurística: se nenhuma palavra do rótulo aparece nos specs, falta escolher
      const words = label.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      if (!words.some((w) => said.includes(w))) groups.add(label);
    }
  }
  return [...groups];
}

export type { SearchOutcomeKind };
