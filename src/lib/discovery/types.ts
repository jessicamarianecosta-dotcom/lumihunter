/**
 * Descoberta de leads (Fase 1) — tipos compartilhados.
 *
 * A arquitetura é preparada para múltiplas fontes (`LeadSource`): hoje só a
 * Tavily; Google Places e outras entram na Fase 3 implementando a mesma
 * interface, sem tocar no orquestrador.
 */

export interface CampaignBrief {
  id: string;
  companyId: string;
  name: string;
  /** O que a empresa vende (texto livre). */
  product: string;
  /** Para quem ela quer vender (texto livre). */
  audience: string;
  /** Onde: cidades/regiões. */
  regions: string[];
  channel: string;
}

/** Resultado cru de uma fonte, antes de normalizar. */
export interface RawDiscoveryHit {
  title: string;
  url: string;
  content: string;
  rawContent?: string | null;
  relevance?: number | null;
  /** Consulta que produziu este resultado. */
  query: string;
  /** Identificador da fonte ("tavily", "google_places"…). */
  source: string;
}

export interface LeadSourceQuery {
  brief: CampaignBrief;
  /** Consultas já montadas pelo orquestrador. */
  queries: string[];
  /** Teto de resultados por consulta. */
  perQuery?: number;
}

export interface LeadSource {
  id: string;
  label: string;
  /** true se a fonte tem credenciais/config para rodar. */
  isConfigured(): boolean;
  /**
   * Executa as buscas. Deve LANÇAR um erro (com mensagem clara) se a fonte não
   * estiver configurada ou falhar — nunca devolver dados fictícios.
   */
  search(input: LeadSourceQuery): Promise<RawDiscoveryHit[]>;
}

/** Sinal de qualificação derivado de dados REAIS encontrados. */
export interface QualificationSignal {
  label: string;
  detail?: string;
}

export type Qualification = "high" | "medium" | "low";

/** Empresa candidata já normalizada + qualificada, pronta para virar `lead_discoveries`. */
export interface DiscoveredCompany {
  companyName: string;
  legalName: string | null;
  segment: string | null;
  description: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  source: string;
  sourceUrl: string | null;
  discoveryQuery: string | null;
  raw: Record<string, unknown>;
  dedupeKey: string;
  score: number;
  qualification: Qualification;
  qualificationReason: string;
  qualificationSignals: QualificationSignal[];
  qualifiedBy: "heuristic" | "ai";
  recommendedApproach: string | null;
}

export interface DiscoveryRunResult {
  /** Total de resultados brutos vindos das fontes. */
  rawCount: number;
  /** Resultados descartados por não serem empresas (artigos, diretórios…). */
  discardedCount: number;
  /** Candidatos após normalização + dedupe. */
  candidates: DiscoveredCompany[];
  queries: string[];
  aiUsed: boolean;
}
