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
import { buildDiscoveryQueries } from "./queries";
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
    competitor: comp.competitor,
    whatsappVerified: wa.verified,
    score: 0,
    buyerFitScore: 0,
    productFitScore: 0,
    businessFitScore: 0,
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
  const queries = buildDiscoveryQueries(brief);

  const configured = SOURCES.filter((s) => s.isConfigured());
  if (configured.length === 0) throw new Error("Nenhuma fonte de descoberta configurada.");

  const rawHits = (
    await Promise.all(configured.map((s) => s.search({ brief, queries, perQuery })))
  ).flat();

  // ── Classificação + normalização (hard filter: só "business") ──────────
  const discardReasons: Record<string, number> = {};
  let discarded = 0;
  const normalized: DiscoveredCompany[] = [];
  for (const hit of rawHits) {
    const r = toCandidate(hit, brief);
    if ("discard" in r) {
      discarded++;
      discardReasons[r.discard] = (discardReasons[r.discard] ?? 0) + 1;
      continue;
    }
    normalized.push(r);
  }

  // ── Deduplicação ─────────────────────────────────────────────────────
  let candidates = mergeByDedupeKey(normalized).filter(
    (c) => !existingKeys.has(c.dedupeKey),
  );

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
    c.qualification = q.qualification;
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
    if (aiUsed)
      candidates.sort(
        (a, b) => b.score - a.score || b.buyerFitScore - a.buyerFitScore,
      );
  } catch {
    aiUsed = false;
  }

  return {
    rawCount: rawHits.length,
    discardedCount: discarded,
    discardReasons,
    candidates,
    queries,
    aiUsed,
  };
}
