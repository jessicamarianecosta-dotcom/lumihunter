/**
 * Base Comercial — tipos compartilhados.
 *
 * A "Base Comercial" é a camada que reúne produtos/serviços de três fontes
 * (manual, PDF, catálogo externo Precy+) num formato único consultável pelos
 * agentes de IA. Nenhum agente fala com uma fonte diretamente: sempre passa
 * por `src/lib/catalog`.
 */
import type { CatalogSourceKind } from "@/lib/supabase/database.types";

export type { CatalogSourceKind };

/** Ordem de prioridade quando o mesmo produto aparece em mais de uma fonte. */
export const SOURCE_PRIORITY: Record<CatalogSourceKind, number> = {
  precy_online: 3,
  pdf: 2,
  manual: 1,
};

export type PriceKind = "fixed" | "per_unit" | "per_quantity" | "quote";

export interface PriceTier {
  min_qty: number;
  price: number;
}

/** Uma configuração concreta de um produto (papel × gramatura × quantidade…). */
export interface CommercialVariant {
  id: string;
  sku: string | null;
  /** Rótulos legíveis das opções escolhidas, ex.: ["Couché 250g", "Frente e verso"]. */
  optionLabels: string[];
  /** Atributos estruturados: { material: "Couché", gramatura: "250g", ... }. */
  attributes: Record<string, string | number | null>;
  priceKind: PriceKind;
  price: number | null;
  priceTiers: PriceTier[] | null;
  currency: string;
  minQuantity: number | null;
  leadTimeDays: number | null;
  stockQuantity: number | null;
  notes: string | null;
  isActive: boolean;
  needsReview: boolean;
  source: CatalogSourceKind;
}

export interface CommercialProduct {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  kind: string;
  isActive: boolean;
  /** Fonte de maior prioridade que contribuiu para este produto. */
  source: CatalogSourceKind;
  /** Todas as fontes que contribuíram (para exibição/depuração). */
  contributingSources: CatalogSourceKind[];
  externalUrl: string | null;
  lastSyncedAt: string | null;
  needsReview: boolean;
  variants: CommercialVariant[];
  /** Faixa de preço observada nas variantes ativas (para resumo rápido). */
  priceRange: { min: number; max: number } | null;
}

/**
 * Resultado semântico de uma busca comercial — a IA age diferente em cada caso
 * (ver Fase 8 do escopo).
 */
export type SearchOutcomeKind =
  | "FOUND" //          um produto claramente correspondente
  | "PARTIAL" //        produto encontrado, faltam especificações para fechar variante/preço
  | "AMBIGUOUS" //      várias correspondências plausíveis
  | "NOT_FOUND" //      nada corresponde
  | "SOURCE_UNAVAILABLE"; // a fonte necessária está fora do ar

export interface SearchOutcome {
  kind: SearchOutcomeKind;
  query: string;
  products: CommercialProduct[];
  /** Quando PARTIAL: grupos de variação sem escolha definida (ex.: "Papel"). */
  missingSpecs?: string[];
  /** Fontes consultadas e se responderam. */
  sourcesChecked: { source: CatalogSourceKind; ok: boolean }[];
  note?: string;
}

// ── Provider de fonte externa ────────────────────────────────────────────
export interface ProviderProductRef {
  externalId: string;
  name: string;
  url: string | null;
}

export interface ProviderProduct extends ProviderProductRef {
  description: string | null;
  category: string | null;
  basePrice: number | null;
  leadTimeDays: number | null;
  photoUrls: string[];
  variationGroups: {
    externalId: string;
    name: string;
    options: { externalId: string; value: string }[];
  }[];
  variants: {
    externalId: string;
    sku: string | null;
    price: number | null;
    stockQuantity: number | null;
    leadTimeDays: number | null;
    optionExternalIds: string[];
  }[];
}

export interface ProviderSyncDiff {
  added: number;
  updated: number;
  removed: number;
  priceChanged: number;
  errors: string[];
}

/**
 * Contrato de qualquer fonte de catálogo externa. Somente leitura.
 * Implementações reais só devem existir quando a integração for confirmada;
 * até lá, usa-se `MockCatalogProvider` (isolado, nunca ativo em produção).
 */
export interface CatalogProvider {
  readonly id: string;
  /** true = implementação real e utilizável; false = mock/placeholder. */
  readonly isReal: boolean;
  testConnection(config: CatalogProviderConfig): Promise<{ ok: boolean; message: string }>;
  listProducts(config: CatalogProviderConfig): Promise<ProviderProduct[]>;
  getProduct(
    config: CatalogProviderConfig,
    externalId: string,
  ): Promise<ProviderProduct | null>;
}

export interface CatalogProviderConfig {
  /** URL pública do catálogo (ex.: https://precyplus.com.br/loja/lumilife). */
  url: string;
  /** Referência a um segredo no Vault, quando a fonte exigir credencial. */
  vaultSecretRef?: string;
  [key: string]: unknown;
}
