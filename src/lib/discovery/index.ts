/**
 * Descoberta de leads — orquestrador (Fase 1, prospecção cirúrgica).
 *
 *   catálogo do produto → consultas → fonte(s) → CLASSIFICAÇÃO (hard filter:
 *   só "business") → normalização → deduplicação → (enriquecimento por empresa)
 *   → qualificação (product fit dominante) → refino IA opcional
 *
 * Ponto de entrada único: `runDiscovery`. As rotas de API importam SÓ daqui.
 */
import { normalizePhoneBR, normalizeEmail } from "@/lib/utils";
import { buildDiscoveryQueries } from "./queries";
import { classifyResult } from "./classify";
import { extractCompany } from "./extract";
import { dedupeKeyFor, mergeByDedupeKey } from "./dedupe";
import { qualify, heuristicApproach } from "./score";
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
} from "./types";
export { TavilyError, tavilyErrorMessage } from "@/lib/tavily";
export { getCampaignProductContext } from "./product-context";

/** Fontes ativas na Fase 1. Fase 3 adiciona itens aqui. */
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

function toCandidate(
  hit: { title: string; url: string; content: string; query: string; source: string; relevance?: number | null },
  regions: string[],
): DiscoveredCompany | { discard: string } {
  const cls = classifyResult(hit);
  if (cls.resultType !== "business") return { discard: cls.resultType };

  const ex = extractCompany(
    { ...hit, rawContent: null, relevance: hit.relevance ?? null },
    regions,
  );
  if (!ex.ok || !ex.company) return { discard: "no_company" };
  const c = ex.company;

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
    whatsapp: normalizePhoneBR(c.whatsapp),
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
    score: 0,
    productFitScore: 0,
    businessFitScore: 0,
    qualification: "low",
    qualificationReason: "",
    qualificationSignals: [],
    evidence: [],
    qualifiedBy: "heuristic",
    recommendedApproach: null,
  };
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
    const r = toCandidate(hit, brief.regions);
    if ("discard" in r) {
      discarded++;
      discardReasons[r.discard] = (discardReasons[r.discard] ?? 0) + 1;
      continue;
    }
    normalized.push(r);
  }

  // ── Deduplicação (lote + contra o que já existe) ──────────────────────
  let candidates = mergeByDedupeKey(normalized).filter(
    (c) => !existingKeys.has(c.dedupeKey),
  );

  // ── Enriquecimento por empresa (2ª etapa, best-effort e limitado) ─────
  const needEnrich = candidates
    .filter((c) => !c.website && !!c.city && (!c.description || c.description.length < 60))
    .slice(0, 8);
  if (needEnrich.length && configured.some((s) => s.id === "tavily")) {
    for (const c of needEnrich) {
      try {
        const hits = await tavilySource.search({
          brief,
          queries: [`${c.companyName} ${c.city}`],
          perQuery: 3,
        });
        for (const h of hits) {
          const cls = classifyResult(h);
          if (cls.resultType !== "business") continue;
          const ex = extractCompany({ ...h, rawContent: null, relevance: null }, brief.regions);
          if (!ex.ok || !ex.company) continue;
          const e = ex.company;
          c.website ??= e.website;
          c.instagram ??= e.instagram;
          c.phone ??= normalizePhoneBR(e.phone);
          c.whatsapp ??= normalizePhoneBR(e.whatsapp);
          c.email ??= normalizeEmail(e.email);
          if (!c.description && e.description) c.description = e.description;
          if (!c.state && e.state) c.state = e.state;
          if (c.businessType === "company" && cls.businessType !== "company")
            c.businessType = cls.businessType;
          if (e.website) c.sourceQuality = Math.max(c.sourceQuality, 100);
        }
      } catch {
        // enriquecimento é opcional — a busca principal já entregou o candidato
        break;
      }
    }
  }

  // ── Qualificação heurística (product fit dominante) ───────────────────
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
        regions: brief.regions,
      },
      brief.productContext,
    );
    c.score = q.score;
    c.productFitScore = q.productFitScore;
    c.businessFitScore = q.businessFitScore;
    c.qualification = q.qualification;
    c.qualificationReason = q.reason;
    c.qualificationSignals = q.signals;
    c.evidence = q.evidence;
    c.recommendedApproach = heuristicApproach(c, brief.productContext);
  }

  candidates.sort((a, b) => b.score - a.score || b.productFitScore - a.productFitScore);
  candidates = candidates.slice(0, maxCandidates);

  // ── Refino por IA (opcional, não bloqueante) ─────────────────────────
  let aiUsed = false;
  try {
    const r = await refineWithAI(brief, candidates, args.userId ?? null);
    aiUsed = r.used;
    if (aiUsed)
      candidates.sort(
        (a, b) => b.score - a.score || b.productFitScore - a.productFitScore,
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
