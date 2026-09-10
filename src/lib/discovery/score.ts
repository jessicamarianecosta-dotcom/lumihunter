/**
 * Qualificação de uma empresa candidata. Funções puras.
 *
 * REGRA: resultado de busca NÃO é lead. Só vira LEAD (aparece na lista
 * principal) o candidato que passa nos gates DUROS do fluxo principal:
 *   empresa real individual · não concorrente · na região da campanha ·
 *   WhatsApp comercial confirmado (quando o canal é WhatsApp).
 * buyer_fit e product_fit NÃO bloqueiam — servem só para priorizar (banda
 * high/medium). "Achou comprador possível + WhatsApp válido → abordar."
 */
import { GENERIC_AUDIENCE } from "./queries";
import type {
  BusinessType,
  CatalogProductRef,
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
  individualBusiness: boolean;
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
  productMatch: { name: string; reason: string } | null;
  qualification: Qualification;
  prospectable: boolean;
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

// Termos genéricos que NÃO contam como "produto concreto do catálogo".
const BROAD_PRODUCT_TERMS = new Set([
  "comunicacao", "visual", "grafica", "grafico", "rapida", "personalizado",
  "personalizada", "personalizados", "personalizadas", "personalizar",
  "impresso", "impressao", "material", "materiais", "servico", "servicos",
  "produto", "produtos", "custom", "generico",
]);

/**
 * Encontra UM produto CONCRETO do catálogo que faz sentido para esta empresa.
 * Retorna null se nada casar de verdade (→ product_fit = 0 → descartar).
 */
export function pickProductMatch(
  haystack: string,
  catalog: CatalogProductRef[],
): { name: string; reason: string; strength: number } | null {
  const h = norm(haystack);
  let best: { name: string; reason: string; strength: number } | null = null;

  for (const p of catalog) {
    const kw = terms([p.name, ...p.keywords]).filter(
      (t) => !BROAD_PRODUCT_TERMS.has(t),
    );
    const apps = terms(p.applications).filter((t) => !BROAD_PRODUCT_TERMS.has(t));
    const kwHits = kw.filter((t) => h.includes(t));
    const appHits = apps.filter((t) => h.includes(t));

    // precisa haver relação real: a atividade da empresa aparece nas
    // aplicações/keywords do produto (não só o nome amplo do produto)
    if (kwHits.length === 0 && appHits.length === 0) continue;

    const strength =
      (appHits.length >= 1 ? 70 : 0) +
      (kwHits.length >= 2 ? 25 : kwHits.length === 1 ? 15 : 0);
    if (strength < 15) continue;

    if (!best || strength > best.strength) {
      const why =
        appHits.length >= 1
          ? `aplicação "${apps[appHits.length ? apps.indexOf(appHits[0]) : 0] ?? appHits[0]}" compatível com o negócio`
          : `atividade relacionada a ${kwHits.slice(0, 2).join(", ")}`;
      best = { name: p.name, reason: `${p.name}: ${why}.`, strength: Math.min(100, strength) };
    }
  }
  return best;
}

/** Sinais SEMPRE derivados dos números finais — nunca contraditórios. Pura. */
export function deriveSignals(args: {
  individualBusiness: boolean;
  competitor: boolean;
  resultType: ResultType;
  buyerFit: number;
  productFit: number;
  productMatch: { name: string } | null;
  regionMatch: boolean;
  city: string | null;
  whatsappVerified: boolean;
  channelRequirement: "whatsapp" | "email" | "none";
}): QualificationSignal[] {
  const s: QualificationSignal[] = [];
  if (args.competitor || args.resultType !== "business" || !args.individualBusiness)
    return s;
  if (args.individualBusiness) s.push({ label: "Empresa individual identificada" });
  if (args.buyerFit >= 70) s.push({ label: "Comprador potencial confirmado" });
  else if (args.buyerFit >= 50) s.push({ label: "Provável comprador (a confirmar)" });
  if (args.productMatch && args.productFit >= 60)
    s.push({ label: "Produto do catálogo compatível", detail: args.productMatch.name });
  if (args.regionMatch)
    s.push({ label: "Região compatível", detail: args.city ?? undefined });
  if (args.whatsappVerified) s.push({ label: "WhatsApp comercial confirmado" });
  else if (args.channelRequirement === "whatsapp")
    s.push({ label: "Sem WhatsApp confirmado" });
  return s;
}

const GATE_HIGH_BUYER = 70;
const GATE_HIGH_PRODUCT = 60;

/** Banda + `prospectable`. Requisitos críticos forçam "low"/false. */
export function evaluateGates(args: {
  score: number;
  buyerFit: number;
  productFit: number;
  productMatch: unknown;
  individualBusiness: boolean;
  resultType: ResultType;
  competitor: boolean;
  regionMatch: boolean;
  hasCity: boolean;
  whatsappVerified: boolean;
  channelRequirement: "whatsapp" | "email" | "none";
}): { qualification: Qualification; prospectable: boolean; discardReason: string | null } {
  const fail = (r: string) =>
    ({ qualification: "low" as const, prospectable: false, discardReason: r });

  // ── Gates DUROS do fluxo principal ────────────────────────────────────
  // empresa real individual · não concorrente · na região · (WhatsApp, se o
  // canal exige). buyer_fit / product_fit NÃO bloqueiam — são só prioridade.
  if (args.resultType !== "business")
    return fail(`Resultado é "${args.resultType}", não uma empresa`);
  if (!args.individualBusiness)
    return fail("Não é uma empresa individual (página de várias empresas)");
  if (args.competitor)
    return fail("Concorrente/fornecedor do mesmo produto");
  if (!args.regionMatch)
    return fail(args.hasCity ? "Fora da região da campanha" : "Região não confirmada");
  if (args.channelRequirement === "whatsapp" && !args.whatsappVerified)
    return fail("WhatsApp comercial não confirmado");

  // passou em todos os gates duros → é um lead abordável.
  // A banda (high/medium) é só para ordenar/priorizar na tela.
  const strong =
    args.score >= 65 &&
    args.buyerFit >= GATE_HIGH_BUYER &&
    !!args.productMatch &&
    args.productFit >= GATE_HIGH_PRODUCT;
  const qualification: Qualification = strong ? "high" : "medium";
  return { qualification, prospectable: true, discardReason: null };
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

  const isBusiness =
    c.resultType === "business" && !c.competitor && c.individualBusiness;

  const buyerTerms = terms([
    ...ctx.exampleBuyers,
    ...ctx.useCases,
    ...c.buyerSegments,
    ...(ctx.idealAudience ? [ctx.idealAudience] : []),
  ]);
  const buyerHits = countOverlap(haystack, buyerTerms);
  const ownProducts = !!c.description && OWN_PRODUCTS_RE.test(c.description);

  // ── produto CONCRETO do catálogo ─────────────────────────────────────
  const match = isBusiness ? pickProductMatch(haystack, ctx.catalogProducts) : null;
  const productMatch = match ? { name: match.name, reason: match.reason } : null;

  // ── buyer fit ────────────────────────────────────────────────────────
  let buyerFit = 0;
  if (isBusiness) {
    buyerFit = buyerHits >= 2 ? 75 : buyerHits === 1 ? 58 : 25;
    if (PHYSICAL_GOODS.has(c.businessType)) buyerFit += 12;
    if (ownProducts) buyerFit += 10;
    if (match) buyerFit += 8;
    buyerFit = Math.min(100, buyerFit);
  }

  // ── product fit = força do product match (0 se não houver) ────────────
  const productFit = isBusiness && match ? match.strength : 0;

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
  const location = regionMatch ? 100 : c.city ? 15 : 30;
  const whatsapp = c.whatsappVerified ? 100 : 0;

  let score = Math.round(
    0.35 * buyerFit +
      0.3 * productFit +
      0.2 * whatsapp +
      0.1 * location +
      0.05 * c.sourceQuality,
  );
  if (c.channelRequirement === "whatsapp" && !c.whatsappVerified)
    score = Math.min(score, 49);

  const gate = evaluateGates({
    score,
    buyerFit,
    productFit,
    productMatch,
    individualBusiness: c.individualBusiness,
    resultType: c.resultType,
    competitor: c.competitor,
    regionMatch,
    hasCity: !!c.city,
    whatsappVerified: c.whatsappVerified,
    channelRequirement: c.channelRequirement,
  });

  const signals = deriveSignals({
    individualBusiness: c.individualBusiness,
    competitor: c.competitor,
    resultType: c.resultType,
    buyerFit,
    productFit,
    productMatch,
    regionMatch,
    city: c.city,
    whatsappVerified: c.whatsappVerified,
    channelRequirement: c.channelRequirement,
  });

  // ── evidências ─────────────────────────────────────────────────────
  const evidence: string[] = [];
  if (isBusiness && specificType)
    evidence.push(`Empresa comercial real: ${BUSINESS_TYPE_PT[c.businessType]}`);
  if (buyerHits >= 1) evidence.push("Segmento é comprador do tipo de produto da campanha");
  if (ownProducts && c.description)
    evidence.push(`Vende produtos próprios: "${c.description.slice(0, 130)}"`);
  if (productMatch) evidence.push(productMatch.reason);
  if (regionMatch) evidence.push(`Na região: ${c.city ?? "—"}${c.state ? "/" + c.state : ""}`);
  if (c.whatsappVerified) evidence.push("WhatsApp comercial encontrado");
  if (c.website) evidence.push(`Site: ${c.website}`);
  if (c.instagram) evidence.push(`Instagram: ${c.instagram}`);

  // ── motivo ─────────────────────────────────────────────────────────
  const bt = BUSINESS_TYPE_PT[c.businessType];
  let reason: string;
  if (!isBusiness) {
    reason =
      gate.discardReason ??
      `Resultado não é uma empresa compradora individual.`;
  } else if (gate.prospectable) {
    reason = `${c.companyName}${c.city ? `, em ${c.city}` : ""} — ${bt}. Comprador potencial de ${
      productMatch?.name.toLowerCase() ?? "materiais do catálogo"
    }; WhatsApp comercial confirmado.`;
  } else {
    reason = `${c.companyName}${c.city ? `, em ${c.city}` : ""} — ${bt}. ${
      gate.discardReason ?? "Não passou em todos os requisitos"
    }.`;
  }

  return {
    score,
    buyerFitScore: buyerFit,
    productFitScore: productFit,
    businessFitScore: businessFit,
    productMatch,
    qualification: gate.qualification,
    prospectable: gate.prospectable,
    reason,
    signals,
    evidence,
    discardReason: gate.discardReason,
  };
}

/** Abordagem sugerida — presa a um produto CONCRETO do catálogo. */
export function heuristicApproach(
  c: Pick<DiscoveredCompany, "companyName" | "productMatch">,
  ctx: ProductContext,
): string {
  const prod = c.productMatch?.name ?? ctx.name;
  return `Apresentar ${prod.toLowerCase()} para a ${c.companyName}. Falar somente de produtos do catálogo — nada fora dele.`;
}
