/**
 * Descoberta de leads (Fase 1) — tipos compartilhados.
 *
 * A arquitetura é preparada para múltiplas fontes (`LeadSource`): hoje só a
 * Tavily; Google Places e outras entram na Fase 3 implementando a mesma
 * interface, sem tocar no orquestrador.
 */

/** Produto concreto do catálogo da empresa. */
export interface CatalogProductRef {
  name: string;
  keywords: string[];
  applications: string[];
}

/** Contexto do produto REAL da campanha — a "regra de negócio" da busca. */
export interface ProductContext {
  name: string;
  description: string | null;
  category: string | null;
  keywords: string[];
  applications: string[];
  useCases: string[];
  exampleBuyers: string[];
  idealAudience: string | null;
  variantNames: string[];
  /**
   * Produtos concretos do catálogo (Produtos & Serviços). A qualificação exige
   * apontar UM destes — "comunicação visual" genérico não conta.
   */
  catalogProducts: CatalogProductRef[];
  /** "catalog" = veio de um produto cadastrado; "text" = só o campo livre. */
  source: "catalog" | "text";
}

/** Quem COMPRA o produto (não quem o fabrica/vende) + quem é concorrente. */
export interface BuyerProfile {
  /** Segmentos de empresas que compram este produto. */
  buyerSegments: string[];
  /** Perfis a EXCLUIR: fornecedores/concorrentes do mesmo produto. */
  excludedProfiles: string[];
  /** Como o perfil foi derivado. */
  source: "ai" | "heuristic";
}

export interface CampaignBrief {
  id: string;
  companyId: string;
  name: string;
  /** O que a empresa vende (texto livre — legado / exibição). */
  product: string;
  /** Contexto estruturado do produto (fonte da verdade para a busca). */
  productContext: ProductContext;
  /** Perfil de comprador derivado do produto. */
  buyerProfile: BuyerProfile;
  /** Para quem ela quer vender (texto livre). */
  audience: string;
  /** Onde: cidades/regiões. */
  regions: string[];
  channel: string;
  /** Requisito de canal: "whatsapp" exige WhatsApp comercial confirmado. */
  channelRequirement: "whatsapp" | "email" | "none";
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

/** Tipo do resultado — só `business` pode virar lead. */
export type ResultType =
  | "business"
  | "article"
  | "aggregator"
  | "news"
  | "directory"
  | "event"
  | "association"
  | "government"
  | "community"
  | "content"
  | "unknown";

export type BusinessType =
  | "company"
  | "store"
  | "brand"
  | "manufacturer"
  | "bakery"
  | "confectionery"
  | "cosmetics_brand"
  | "soap_brand"
  | "candle_brand"
  | "artisan_business"
  | "restaurant"
  | "service_business"
  | "other"
  | "unknown";

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

  resultType: ResultType;
  businessType: BusinessType;
  sourceQuality: number;
  /** true = a URL representa UMA empresa específica (não uma lista/artigo). */
  individualBusiness: boolean;
  /** true = fornecedor/concorrente do mesmo produto (nunca vira lead). */
  competitor: boolean;
  /** WhatsApp comercial confirmado por evidência (não assumido do telefone). */
  whatsappVerified: boolean;
  whatsappEvidence: string | null;

  /** Score final (0-100). */
  score: number;
  buyerFitScore: number;
  productFitScore: number;
  businessFitScore: number;
  /** Produto CONCRETO do catálogo compatível — obrigatório para qualificar. */
  productMatch: { name: string; reason: string } | null;
  qualification: Qualification;
  /** true = passou em TODOS os gates → aparece na lista principal. */
  prospectable: boolean;
  qualificationReason: string;
  qualificationSignals: QualificationSignal[];
  /** Fatos concretos que embasam a qualificação (nunca especulação). */
  evidence: string[];
  /** Se não virou lead prospectável, por quê. */
  discardReason: string | null;
  qualifiedBy: "heuristic" | "ai";
  recommendedApproach: string | null;
}

export interface DiscoveryRunResult {
  /** Total de páginas cruas vindas das fontes. */
  rawCount: number;
  /** Total que passou por classificação/qualificação (candidatos analisados). */
  screenedCount: number;
  /** LEADS válidos — passaram em TODOS os gates. Vão para a lista principal. */
  qualified: DiscoveredCompany[];
  /** Candidatos analisados mas reprovados — ficam só na aba "Descartados". */
  rejected: DiscoveredCompany[];
  /** Motivos de descarte agregados (para o relatório e a aba). */
  discardReasons: Record<string, number>;
  queries: string[];
  aiUsed: boolean;
}
