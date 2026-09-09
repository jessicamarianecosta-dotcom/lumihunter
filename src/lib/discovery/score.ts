/**
 * Qualificação de uma empresa candidata. Funções puras.
 *
 * Pergunta central: "esta empresa provavelmente COMPRA este produto de um
 * fornecedor como a LumiLife?" — não "trabalha com" nem "usa".
 *
 * Fatores: buyer_fit (35%) + product_fit (30%) + whatsapp (20%) + região (10%)
 * + fonte (5%). Concorrente/fornecedor → nunca qualifica. Campanha de WhatsApp
 * sem WhatsApp confirmado → nunca qualifica e score ≤ 49.
 */
import { GENERIC_AUDIENCE } from "./queries";
import type {
  BusinessType,
  DiscoveredCompany,
  ProductContext,
  Qualification,
  QualificationSignal,
  ResultType,
} from "./types";

export interface ScoreInput {
  companyName: string;
  segment: string | null;
  description: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  discoveryQuery: string | null;
  resultType: ResultType;
  businessType: BusinessType;
  sourceQuality: number;
  competitor: boolean;
  whatsappVerified: boolean;
  channelRequirement: "whatsapp" | "email" | "none";
  regions: string[];
  buyerSegments: string[];
}

export interface QualificationResult {
  score: number;
  buyerFitScore: number;
  productFitScore: number;
  businessFitScore: number;
  qualification: Qualification;
  reason: string;
  signals: QualificationSignal[];
  evidence: string[];
  discardReason: string | null;
}

const BUSINESS_TYPE_PT: Record<BusinessType, string> = {
  company: "empresa",
  store: "loja",
  brand: "marca",
  manufacturer: "fabricante",
  bakery: "padaria",
  confectionery: "confeitaria",
  cosmetics_brand: "marca de cosméticos",
  soap_brand: "saboaria",
  candle_brand: "marca de velas",
  artisan_business: "negócio artesanal",
  restaurant: "restaurante/food service",
  service_business: "prestadora de serviço",
  other: "negócio",
  unknown: "negócio",
};

/** Tipos de negócio que vendem bens físicos (usam embalagem/identificação). */
const PHYSICAL_GOODS: Set<BusinessType> = new Set([
  "confectionery", "bakery", "soap_brand", "candle_brand", "cosmetics_brand",
  "artisan_business", "manufacturer", "brand", "store",
]);

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function terms(list: string[]): string[] {
  return list
    .flatMap((s) => norm(s).split(/[\s,/]+/))
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !GENERIC_AUDIENCE.has(w))
    .filter((w, i, a) => a.indexOf(w) === i);
}
function countOverlap(haystack: string, needles: string[]): number {
  const h = norm(haystack);
  return needles.filter((n) => h.includes(n)).length;
}

const OWN_PRODUCTS_RE =
  /produtos?\s+(pr[óo]prios?|artesanais?|embalad|autorais?)|linha\s+(pr[óo]pria|de\s+produtos)|nossa\s+marca|encomendas|loja\s+(virtual|online|f[íi]sica)|vendas?\s+online|fabricamos|produzimos|feito\s+(à|a)\s+m[ãa]o/i;

/** Banda de qualificação. Requisitos críticos podem forçar "low". */
export function qualificationBand(args: {
  final: number;
  buyerFit: number;
  productFit: number;
  resultType: ResultType;
  competitor: boolean;
  whatsappVerified: boolean;
  channelRequirement: "whatsapp" | "email" | "none";
}): Qualification {
  const { final, buyerFit, productFit } = args;
  if (args.competitor) return "low";
  if (args.resultType !== "business") return "low";
  if (args.channelRequirement === "whatsapp" && !args.whatsappVerified) return "low";
  if (buyerFit < 40) return "low";
  if (final >= 70 && buyerFit >= 50 && productFit >= 40) return "high";
  if (final >= 55) return "medium";
  return "low";
}

export function qualify(
  c: ScoreInput,
  ctx: ProductContext,
): QualificationResult {
  const haystack = [
    c.companyName,
    c.segment ?? "",
    c.description ?? "",
    BUSINESS_TYPE_PT[c.businessType],
    c.discoveryQuery ?? "",
  ].join(" ");

  const isBusiness = c.resultType === "business" && !c.competitor;

  const buyerTerms = terms([
    ...ctx.exampleBuyers,
    ...ctx.useCases,
    ...c.buyerSegments,
    ...(ctx.idealAudience ? [ctx.idealAudience] : []),
  ]);
  const appTerms = terms([...ctx.applications, ...ctx.keywords]);
  const buyerHits = countOverlap(haystack, buyerTerms);
  const appHits = countOverlap(haystack, appTerms);
  const ownProducts = !!c.description && OWN_PRODUCTS_RE.test(c.description);

  // ── buyer fit: é um COMPRADOR do produto? ─────────────────────────────
  let buyerFit = 0;
  if (isBusiness) {
    buyerFit = buyerHits >= 2 ? 75 : buyerHits === 1 ? 55 : 25;
    if (PHYSICAL_GOODS.has(c.businessType)) buyerFit += 15;
    if (ownProducts) buyerFit += 10;
    buyerFit = Math.min(100, buyerFit);
  }

  // ── product fit: o produto tem aplicação real no negócio? ─────────────
  let productFit = 0;
  if (isBusiness) {
    productFit = appHits >= 2 ? 70 : appHits === 1 ? 50 : buyerHits >= 1 ? 40 : 20;
    if (PHYSICAL_GOODS.has(c.businessType)) productFit += 15;
    if (ownProducts) productFit += 10;
    productFit = Math.min(100, productFit);
  }

  // ── business fit ─────────────────────────────────────────────────────
  const specificType =
    c.businessType !== "other" &&
    c.businessType !== "unknown" &&
    c.businessType !== "company";
  let businessFit = 0;
  if (isBusiness) {
    businessFit = specificType ? 90 : 60;
    if (!c.website && !c.instagram) businessFit -= 20;
  }

  // ── secundários ─────────────────────────────────────────────────────
  const regionMatch = c.regions.some((r) => {
    const main = norm(r.split(/\s+e\s+|,|\//)[0].trim());
    return (
      (c.city && norm(c.city).includes(main)) ||
      (main.length > 2 && norm(haystack).includes(main))
    );
  });
  const location = regionMatch ? 100 : c.city ? 20 : 35;
  const whatsapp = c.whatsappVerified ? 100 : 0;
  const sourceQuality = c.sourceQuality;

  let score = Math.round(
    0.35 * buyerFit +
      0.3 * productFit +
      0.2 * whatsapp +
      0.1 * location +
      0.05 * sourceQuality,
  );
  // campanha de WhatsApp sem WhatsApp confirmado → nunca prioridade
  if (c.channelRequirement === "whatsapp" && !c.whatsappVerified) {
    score = Math.min(score, 49);
  }

  const qualification = qualificationBand({
    final: score,
    buyerFit,
    productFit,
    resultType: c.resultType,
    competitor: c.competitor,
    whatsappVerified: c.whatsappVerified,
    channelRequirement: c.channelRequirement,
  });

  // ── por que NÃO virou lead prospectável ─────────────────────────────
  let discardReason: string | null = null;
  if (c.competitor) discardReason = "Possível concorrente/fornecedor do mesmo produto";
  else if (c.resultType !== "business") discardReason = `Resultado é "${c.resultType}", não uma empresa`;
  else if (!regionMatch && c.city) discardReason = "Fora da região da campanha";
  else if (buyerFit < 40) discardReason = "Sem evidência de que é comprador do produto";
  else if (c.channelRequirement === "whatsapp" && !c.whatsappVerified)
    discardReason = "WhatsApp comercial não confirmado";

  // ── evidências ─────────────────────────────────────────────────────
  const evidence: string[] = [];
  if (specificType) evidence.push(`Empresa comercial real: ${BUSINESS_TYPE_PT[c.businessType]}`);
  if (buyerHits >= 1) evidence.push("Segmento é comprador do tipo de produto da campanha");
  if (ownProducts)
    evidence.push(`Vende produtos próprios: "${c.description!.slice(0, 130)}"`);
  if (appHits >= 1) evidence.push("Aplicação do produto plausível no negócio");
  if (regionMatch) evidence.push(`Na região: ${c.city ?? "—"}${c.state ? "/" + c.state : ""}`);
  if (c.whatsappVerified) evidence.push("WhatsApp comercial encontrado");
  if (c.website) evidence.push(`Site: ${c.website}`);
  if (c.instagram) evidence.push(`Instagram: ${c.instagram}`);

  // ── sinais (comprador primeiro; contato/site por último) ────────────
  const signals: QualificationSignal[] = [];
  if (isBusiness && buyerFit >= 55)
    signals.push({ label: "Empresa compradora identificada" });
  if (productFit >= 50)
    signals.push({ label: `Produto compatível (${ctx.name.toLowerCase()})` });
  if (buyerHits >= 1)
    signals.push({
      label: "Segmento compatível",
      detail: buyerTerms.filter((t) => norm(haystack).includes(t)).slice(0, 3).join(", "),
    });
  if (ownProducts) signals.push({ label: "Produtos/linha própria identificados" });
  if (regionMatch) signals.push({ label: "Região compatível", detail: c.city ?? undefined });
  if (c.whatsappVerified) signals.push({ label: "WhatsApp comercial confirmado" });
  else if (c.channelRequirement === "whatsapp")
    signals.push({ label: "Sem WhatsApp confirmado" });

  // ── motivo ─────────────────────────────────────────────────────────
  const bt = BUSINESS_TYPE_PT[c.businessType];
  const prod = ctx.name.toLowerCase();
  let reason: string;
  if (c.competitor) {
    reason = `${c.companyName} parece oferecer ${prod} como serviço — concorrente/fornecedor, não comprador.`;
  } else if (c.resultType !== "business") {
    reason = `Resultado classificado como "${c.resultType}" — não é uma empresa compradora.`;
  } else {
    const fit =
      buyerFit >= 55
        ? `o segmento compra ${prod} de fornecedores`
        : buyerFit >= 40
          ? `há relação plausível com ${prod} (a confirmar)`
          : `ainda sem evidência de que compra ${prod}`;
    const wa = c.whatsappVerified
      ? "WhatsApp comercial confirmado"
      : c.channelRequirement === "whatsapp"
        ? "sem WhatsApp confirmado (canal da campanha é WhatsApp)"
        : "";
    reason = `${c.companyName}${c.city ? `, em ${c.city}` : ""} — ${bt}. ${
      fit.charAt(0).toUpperCase() + fit.slice(1)
    }${wa ? `; ${wa}` : ""}.`;
  }

  return {
    score,
    buyerFitScore: buyerFit,
    productFitScore: productFit,
    businessFitScore: businessFit,
    qualification,
    reason,
    signals,
    evidence,
    discardReason,
  };
}

/** Abordagem sugerida — SEMPRE presa ao produto real da campanha. */
export function heuristicApproach(
  c: Pick<DiscoveredCompany, "companyName" | "businessType">,
  ctx: ProductContext,
): string {
  const app = ctx.applications[0]?.toLowerCase() ?? "os produtos e embalagens do negócio";
  return `Apresentar ${ctx.name.toLowerCase()} como opção para ${app} da ${c.companyName}. Falar somente do produto da campanha — nada fora do catálogo.`;
}
