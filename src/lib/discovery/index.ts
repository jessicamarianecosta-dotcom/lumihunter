/**
 * Descoberta de leads — orquestrador (Fase 1, prospecção por COMPRADOR).
 *
 *   catálogo → PERFIL DE COMPRADOR (quem compra, não quem fabrica) → consultas
 *   por comprador+região → fonte(s) → classificação (hard filter + concorrente)
 *   → normalização → dedupe → enriquecimento + BUSCA DE WHATSAPP → qualificação
 *   (buyer_fit + product_fit + whatsapp) → refino IA opcional
 *
 * Ponto de entrada único: `runDiscovery`. As rotas de API importam SÓ daqui.
 */
import { normalizePhoneBR, normalizeEmail } from "@/lib/utils";
import { buildDiscoveryQueries, buildScaleQueries } from "./queries";
import { classifyResult, detectCompetitor } from "./classify";
import { extractCompany } from "./extract";
import { dedupeKeyFor, mergeByDedupeKey } from "./dedupe";
import { qualify, heuristicApproach } from "./score";
import { findVerifiedWhatsApp } from "./whatsapp";
import { refineWithAI } from "./ai";
import { tavilySource } from "./sources/tavily-source";
import type {
  CampaignBrief,
  DiscoveredCompany,
  DiscoveryRunResult,
  LeadSource,
  QueryLogRow,
} from "./types";

export type {
  CampaignBrief,
  DiscoveredCompany,
  DiscoveryRunResult,
  ProductContext,
  BuyerProfile,
} from "./types";
export { TavilyError, tavilyErrorMessage } from "@/lib/tavily";
export {
  getCampaignProductContext,
  deriveBuyerProfile,
} from "./product-context";
export { buildScaleQueries, buildDiscoveryQueries } from "./queries";
export { expandRegions } from "./regions";

const SOURCES: LeadSource[] = [tavilySource];

export function discoverySourcesConfigured(): boolean {
  return SOURCES.some((s) => s.isConfigured());
}

interface RunArgs {
  brief: CampaignBrief;
  userId?: string | null;
  existingKeys?: Set<string>;
  perQuery?: number;
  maxCandidates?: number;
  /**
   * Consultas explícitas (descoberta em escala, batch a batch). Sem isto,
   * usa o plano curto `buildDiscoveryQueries` (rodada única, legado).
   */
  queries?: string[];
}

function productKeywords(brief: CampaignBrief): string[] {
  return [brief.productContext.name, ...brief.productContext.keywords]
    .join(" ")
    .toLowerCase()
    .split(/[\s,/]+/)
    .filter((w) => w.length > 3)
    .filter((w, i, a) => a.indexOf(w) === i);
}

function toCandidate(
  hit: { title: string; url: string; content: string; rawContent?: string | null; query: string; source: string; relevance?: number | null },
  brief: CampaignBrief,
): DiscoveredCompany | { discard: string } {
  const cls = classifyResult(hit);
  if (cls.resultType !== "business") return { discard: cls.resultType };

  const ex = extractCompany(
    { ...hit, rawContent: hit.rawContent ?? null, relevance: hit.relevance ?? null },
    brief.regions,
  );
  if (!ex.ok || !ex.company) return { discard: "no_company" };
  const c = ex.company;

  const comp = detectCompetitor(
    hit,
    brief.buyerProfile.excludedProfiles,
    productKeywords(brief),
  );
  const wa = findVerifiedWhatsApp(
    `${hit.title}\n${hit.content}\n${hit.rawContent ?? ""}`,
  );

  return {
    companyName: c.companyName,
    legalName: null,
    segment: null,
    description: c.description,
    city: c.city,
    state: c.state,
    country: "BR",
    address: c.address,
    phone: normalizePhoneBR(c.phone),
    whatsapp: wa.number ?? normalizePhoneBR(c.whatsapp),
    email: normalizeEmail(c.email),
    website: c.website,
    instagram: c.instagram,
    source: hit.source,
    sourceUrl: hit.url,
    discoveryQuery: hit.query,
    raw: { title: hit.title, content: hit.content, relevance: hit.relevance ?? null },
    dedupeKey: dedupeKeyFor({
      website: c.website,
      phone: c.phone,
      whatsapp: c.whatsapp,
      instagram: c.instagram,
      companyName: c.companyName,
      city: c.city,
    }),
    resultType: "business",
    businessType: cls.businessType,
    sourceQuality: cls.sourceQuality,
    individualBusiness: true,
    competitor: comp.competitor,
    whatsappVerified: wa.verified,
    whatsappEvidence: wa.evidence,
    score: 0,
    buyerFitScore: 0,
    productFitScore: 0,
    businessFitScore: 0,
    productMatch: null,
    prospectable: false,
    qualification: "low",
    qualificationReason: comp.competitor ? comp.reason ?? "" : "",
    qualificationSignals: [],
    evidence: [],
    discardReason: comp.competitor ? comp.reason ?? "Concorrente" : null,
    qualifiedBy: "heuristic",
    recommendedApproach: null,
  };
}

async function enrichCandidate(
  c: DiscoveredCompany,
  brief: CampaignBrief,
  opts: { lookupWhatsApp: boolean },
): Promise<void> {
  const queries: string[] = [];
  if (!c.website && c.city) queries.push(`${c.companyName} ${c.city}`);
  if (opts.lookupWhatsApp && !c.whatsappVerified && c.city)
    queries.push(`${c.companyName} ${c.city} whatsapp`);
  if (queries.length === 0) return;

  const hits = await tavilySource.search({ brief, queries, perQuery: 3 });
  for (const h of hits) {
    const text = `${h.title}\n${h.content}\n${h.rawContent ?? ""}`;
    const wa = findVerifiedWhatsApp(text);
    if (wa.verified && !c.whatsappVerified) {
      c.whatsappVerified = true;
      c.whatsappEvidence = wa.evidence;
      if (wa.number) c.whatsapp = wa.number;
    }
    const cl = classifyResult(h);
    if (cl.resultType !== "business") continue;
    const ex = extractCompany({ ...h, rawContent: null, relevance: null }, brief.regions);
    if (!ex.ok || !ex.company) continue;
    const e = ex.company;
    c.website ??= e.website;
    c.instagram ??= e.instagram;
    c.phone ??= normalizePhoneBR(e.phone);
    c.email ??= normalizeEmail(e.email);
    if (!c.description && e.description) c.description = e.description;
    if (!c.state && e.state) c.state = e.state;
    if (c.businessType === "company" && cl.businessType !== "company")
      c.businessType = cl.businessType;
    if (e.website) c.sourceQuality = Math.max(c.sourceQuality, 100);
  }
}

export async function runDiscovery(args: RunArgs): Promise<DiscoveryRunResult> {
  const { brief, existingKeys = new Set(), perQuery = 6, maxCandidates = 60 } = args;
  const queries = args.queries ?? buildDiscoveryQueries(brief);

  const configured = SOURCES.filter((s) => s.isConfigured());
  if (configured.length === 0) throw new Error("Nenhuma fonte de descoberta configurada.");

  const rawHits = (
    await Promise.all(configured.map((s) => s.search({ brief, queries, perQuery })))
  ).flat();

  // ── Funil consulta a consulta ────────────────────────────────────────
  const log = new Map<string, QueryLogRow>();
  const logFor = (q: string | null): QueryLogRow => {
    const key = q ?? "(sem consulta)";
    let row = log.get(key);
    if (!row) {
      row = {
        query: key,
        source: configured[0]?.id ?? "tavily",
        resultsReturned: 0,
        newCandidates: 0,
        duplicates: 0,
        rejected: 0,
        rejectBreakdown: {},
        qualified: 0,
        whatsappFound: 0,
        whatsappConfirmed: 0,
      };
      log.set(key, row);
    }
    return row;
  };
  for (const q of queries) logFor(q);
  for (const hit of rawHits) logFor(hit.query).resultsReturned += 1;

  // ── Classificação + normalização (hard filter: só "business") ──────────
  const discardReasons: Record<string, number> = {};
  const HARD_FILTER_LABEL: Record<string, string> = {
    aggregator: "Página que lista várias empresas (ranking/roteiro)",
    news: "Notícia / matéria de mercado",
    article: "Conteúdo editorial (guia/artigo)",
    directory: "Diretório / catálogo online",
    event: "Evento / feira",
    association: "Associação / sindicato",
    government: "Órgão público",
    community: "Fórum / rede social genérica",
    content: "Conteúdo editorial",
    unknown: "Tipo de página não identificado",
    no_company: "Título não é o nome de uma empresa específica",
  };
  const normalized: DiscoveredCompany[] = [];
  const keptByQuery = new Map<string, number>();
  for (const hit of rawHits) {
    const r = toCandidate(hit, brief);
    if ("discard" in r) {
      const label = HARD_FILTER_LABEL[r.discard] ?? r.discard;
      discardReasons[label] = (discardReasons[label] ?? 0) + 1;
      const lr = logFor(hit.query);
      lr.rejected += 1;
      lr.rejectBreakdown[label] = (lr.rejectBreakdown[label] ?? 0) + 1;
      continue;
    }
    normalized.push(r);
    keptByQuery.set(hit.query, (keptByQuery.get(hit.query) ?? 0) + 1);
  }

  // ── Deduplicação ─────────────────────────────────────────────────────
  let candidates = mergeByDedupeKey(normalized).filter(
    (c) => !existingKeys.has(c.dedupeKey),
  );

  // candidatos NOVOS por consulta (o que sobrou depois de dedupe/rodadas anteriores)
  const survivorsByQuery = new Map<string, number>();
  for (const c of candidates)
    survivorsByQuery.set(
      c.discoveryQuery ?? "(sem consulta)",
      (survivorsByQuery.get(c.discoveryQuery ?? "(sem consulta)") ?? 0) + 1,
    );
  for (const [q, row] of log) {
    row.newCandidates = survivorsByQuery.get(q) ?? 0;
    row.duplicates = Math.max(0, (keptByQuery.get(q) ?? 0) - row.newCandidates);
  }

  // ── Enriquecimento + busca de WhatsApp (bounded, best-effort) ─────────
  // prioriza os que parecem comprador e ainda não têm WhatsApp confirmado
  const enrichTargets = candidates
    .filter((c) => !c.competitor)
    .filter((c) => !c.website || !c.whatsappVerified)
    .slice(0, 15);
  if (configured.some((s) => s.id === "tavily")) {
    for (const c of enrichTargets) {
      try {
        await enrichCandidate(c, brief, { lookupWhatsApp: true });
      } catch {
        break; // enriquecimento é opcional
      }
    }
  }

  // ── Qualificação heurística ─────────────────────────────────────────
  for (const c of candidates) {
    const q = qualify(
      {
        companyName: c.companyName,
        segment: c.segment,
        description: c.description,
        city: c.city,
        state: c.state,
        phone: c.phone,
        whatsapp: c.whatsapp,
        email: c.email,
        website: c.website,
        instagram: c.instagram,
        discoveryQuery: c.discoveryQuery,
        resultType: c.resultType,
        businessType: c.businessType,
        sourceQuality: c.sourceQuality,
        individualBusiness: c.individualBusiness,
        competitor: c.competitor,
        whatsappVerified: c.whatsappVerified,
        channelRequirement: brief.channelRequirement,
        regions: brief.regions,
        buyerSegments: brief.buyerProfile.buyerSegments,
      },
      brief.productContext,
    );
    c.score = q.score;
    c.buyerFitScore = q.buyerFitScore;
    c.productFitScore = q.productFitScore;
    c.businessFitScore = q.businessFitScore;
    c.productMatch = q.productMatch;
    c.qualification = q.qualification;
    c.prospectable = q.prospectable;
    c.qualificationReason = q.reason;
    c.qualificationSignals = q.signals;
    c.evidence = q.evidence;
    c.discardReason = q.discardReason;
    c.recommendedApproach = heuristicApproach(c, brief.productContext);
  }

  candidates.sort(
    (a, b) => b.score - a.score || b.buyerFitScore - a.buyerFitScore,
  );
  candidates = candidates.slice(0, maxCandidates);

  // ── Refino por IA (opcional) ────────────────────────────────────────
  let aiUsed = false;
  try {
    const r = await refineWithAI(brief, candidates, args.userId ?? null);
    aiUsed = r.used;
  } catch {
    aiUsed = false;
  }

  // ── Split: LEAD válido (todos os gates) × descartado ─────────────────
  const qualified = candidates
    .filter((c) => c.prospectable)
    .sort((a, b) => b.score - a.score || b.buyerFitScore - a.buyerFitScore);
  const rejected = candidates
    .filter((c) => !c.prospectable)
    .sort((a, b) => b.score - a.score);

  for (const c of rejected) {
    const key = c.discardReason ?? "Não passou em todos os requisitos";
    discardReasons[key] = (discardReasons[key] ?? 0) + 1;
  }

  // ── Fecha o funil consulta a consulta ───────────────────────────────
  for (const c of candidates) {
    const row = logFor(c.discoveryQuery);
    if (c.whatsapp) row.whatsappFound += 1;
    if (c.whatsappVerified) row.whatsappConfirmed += 1;
    if (c.prospectable) row.qualified += 1;
  }

  return {
    rawCount: rawHits.length,
    screenedCount: candidates.length,
    qualified,
    rejected,
    discardReasons,
    queries,
    aiUsed,
    queryLog: [...log.values()],
  };
}
