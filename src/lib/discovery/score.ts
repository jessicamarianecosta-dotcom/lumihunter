/**
 * Qualificação de uma empresa candidata. Funções puras.
 *
 * O fator DOMINANTE é o `product_fit`: "esta empresa tem uma razão concreta
 * para comprar ESTE produto?". Região, contato e presença online são
 * secundários e nunca elevam sozinhos um lead a "alto potencial".
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
  regions: string[];
}

export interface QualificationResult {
  score: number;
  productFitScore: number;
  businessFitScore: number;
  qualification: Qualification;
  reason: string;
  signals: QualificationSignal[];
  evidence: string[];
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

/** Tipos de negócio que vendem bens físicos (correlaciona com embalagem/rótulo/impressão). */
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

export function qualificationBand(
  final: number,
  productFit: number,
): Qualification {
  if (productFit < 30) return "low";
  if (final >= 75 && productFit >= 50) return "high";
  if (final >= 55) return "medium";
  return "low";
}

const OWN_PRODUCTS_RE =
  /produtos?\s+(pr[óo]prios?|artesanais?|embalad|autorais?)|linha\s+(pr[óo]pria|de\s+produtos)|nossa\s+marca|encomendas|loja\s+(virtual|online|f[íi]sica)|vendas?\s+online|fabricamos|produzimos|feito\s+(à|a)\s+m[ãa]o/i;

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

  // ── product fit ────────────────────────────────────────────────────────
  const buyerTerms = terms([
    ...ctx.exampleBuyers,
    ...ctx.useCases,
    ...(ctx.idealAudience ? [ctx.idealAudience] : []),
  ]);
  const appTerms = terms([...ctx.applications, ...ctx.keywords]);
  const buyerHits = countOverlap(haystack, buyerTerms);
  const appHits = countOverlap(haystack, appTerms);

  let productFit = 0;
  if (c.resultType === "business") {
    productFit =
      buyerHits >= 2 ? 70 : buyerHits === 1 ? 55 : appHits >= 1 ? 40 : 20;
    if (PHYSICAL_GOODS.has(c.businessType)) productFit += 15;
    if (c.description && OWN_PRODUCTS_RE.test(c.description)) productFit += 10;
    productFit = Math.min(100, productFit);
  }

  // ── business fit ───────────────────────────────────────────────────────
  const specificType =
    c.businessType !== "other" &&
    c.businessType !== "unknown" &&
    c.businessType !== "company";
  let businessFit = 0;
  if (c.resultType === "business") {
    businessFit = specificType ? 90 : 60;
    if (!c.website && !c.instagram) businessFit -= 20;
  }

  // ── secundários ───────────────────────────────────────────────────────
  const regionMatch = c.regions.some((r) => {
    const main = norm(r.split(/\s+e\s+|,|\//)[0].trim());
    return (
      (c.city && norm(c.city).includes(main)) ||
      (main.length > 2 && norm(haystack).includes(main))
    );
  });
  const location = regionMatch ? 100 : c.city ? 20 : 35;

  const presence = Math.min(
    100,
    (c.website ? 50 : 0) + (c.instagram ? 30 : 0) + (c.email ? 20 : 0),
  );
  const contact = Math.min(
    100,
    (c.whatsapp ? 70 : c.phone ? 45 : 0) + (c.email ? 15 : 0),
  );
  const sourceQuality = c.sourceQuality;

  const score = Math.round(
    0.4 * productFit +
      0.2 * businessFit +
      0.15 * location +
      0.1 * presence +
      0.1 * contact +
      0.05 * sourceQuality,
  );

  const qualification = qualificationBand(score, productFit);

  // ── evidências (fatos concretos) ──────────────────────────────────────
  const evidence: string[] = [];
  if (c.website) evidence.push(`Site próprio: ${c.website}`);
  if (c.instagram) evidence.push(`Instagram comercial: ${c.instagram}`);
  if (specificType)
    evidence.push(`Segmento identificado: ${BUSINESS_TYPE_PT[c.businessType]}`);
  if (c.city) evidence.push(`Localização: ${c.city}${c.state ? "/" + c.state : ""}`);
  if (c.description && OWN_PRODUCTS_RE.test(c.description))
    evidence.push(
      `Descrição indica produtos/linha própria: "${c.description.slice(0, 140)}"`,
    );
  if (c.whatsapp) evidence.push("WhatsApp comercial listado");
  else if (c.phone) evidence.push("Telefone comercial listado");

  // ── sinais (produto primeiro, contato por último) ─────────────────────
  const signals: QualificationSignal[] = [];
  if (productFit >= 55)
    signals.push({ label: `Compatível com ${ctx.name.toLowerCase()}` });
  if (buyerHits >= 1)
    signals.push({
      label: "Segmento é comprador potencial",
      detail: buyerTerms.filter((t) => norm(haystack).includes(t)).slice(0, 3).join(", "),
    });
  if (c.description && OWN_PRODUCTS_RE.test(c.description))
    signals.push({ label: "Produtos/linha própria identificados" });
  if (appHits >= 1)
    signals.push({
      label: "Aplicação do produto plausível",
      detail: appTerms.filter((t) => norm(haystack).includes(t)).slice(0, 3).join(", "),
    });
  if (regionMatch) signals.push({ label: "Região compatível", detail: c.city ?? undefined });
  if (specificType) signals.push({ label: "Empresa específica identificada" });
  if (c.whatsapp || c.phone)
    signals.push({ label: "Contato comercial disponível" });

  // ── motivo (factual, marca inferência) ───────────────────────────────
  const bt = BUSINESS_TYPE_PT[c.businessType];
  const prod = ctx.name.toLowerCase();
  let fitPhrase: string;
  if (productFit >= 55)
    fitPhrase = `o segmento é comprador potencial de ${prod}`;
  else if (productFit >= 40)
    fitPhrase = `há relação plausível com ${prod} (a confirmar na conversa)`;
  else fitPhrase = `a relação com ${prod} ainda não está evidenciada`;

  const reason =
    c.resultType !== "business"
      ? `Resultado classificado como "${c.resultType}" — não é uma empresa compradora.`
      : `${c.companyName}${c.city ? `, em ${c.city}` : ""} — ${bt}. ${
          evidence.length ? evidence[0] + ". " : ""
        }${fitPhrase.charAt(0).toUpperCase() + fitPhrase.slice(1)}.`;

  return {
    score,
    productFitScore: productFit,
    businessFitScore: businessFit,
    qualification,
    reason,
    signals,
    evidence,
  };
}

/** Abordagem sugerida — SEMPRE presa ao produto real da campanha. */
export function heuristicApproach(
  c: Pick<DiscoveredCompany, "companyName" | "businessType">,
  ctx: ProductContext,
): string {
  return `Apresentar as opções de ${ctx.name.toLowerCase()} da empresa, mostrando como se aplicam aos produtos da ${c.companyName}. Não citar itens fora do catálogo.`;
}
