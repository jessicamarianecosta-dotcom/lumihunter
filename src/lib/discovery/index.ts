/**
 * Descoberta de leads — orquestrador (Fase 1).
 *
 *   campanha → consultas → fonte(s) → normalização → descarte de não-empresas
 *            → deduplicação → qualificação (heurística + IA opcional)
 *
 * Ponto de entrada único: `runDiscovery`. As rotas de API importam SÓ daqui.
 */
import { normalizePhoneBR, normalizeEmail } from "@/lib/utils";
import { buildDiscoveryQueries } from "./queries";
import { extractCompany } from "./extract";
import { dedupeKeyFor, mergeByDedupeKey } from "./dedupe";
import { qualifyHeuristic } from "./score";
import { refineWithAI } from "./ai";
import { tavilySource } from "./sources/tavily-source";
import type {
  CampaignBrief,
  DiscoveredCompany,
  DiscoveryRunResult,
  LeadSource,
} from "./types";

export type { CampaignBrief, DiscoveredCompany, DiscoveryRunResult } from "./types";
export { TavilyError, tavilyErrorMessage } from "@/lib/tavily";

/** Fontes ativas na Fase 1. Fase 3 adiciona itens aqui. */
const SOURCES: LeadSource[] = [tavilySource];

export function discoverySourcesConfigured(): boolean {
  return SOURCES.some((s) => s.isConfigured());
}

interface RunArgs {
  brief: CampaignBrief;
  userId?: string | null;
  /** Chaves de dedupe já existentes nesta campanha (não recria). */
  existingKeys?: Set<string>;
  perQuery?: number;
  maxCandidates?: number;
}

export async function runDiscovery(args: RunArgs): Promise<DiscoveryRunResult> {
  const { brief, existingKeys = new Set(), perQuery = 6, maxCandidates = 60 } = args;

  const queries = buildDiscoveryQueries(brief);

  // ── 1. Busca nas fontes configuradas ────────────────────────────────────
  const configured = SOURCES.filter((s) => s.isConfigured());
  if (configured.length === 0) {
    // A rota trata isto antes; aqui é rede de segurança.
    throw new Error("Nenhuma fonte de descoberta configurada.");
  }

  const rawHits = (
    await Promise.all(configured.map((s) => s.search({ brief, queries, perQuery })))
  ).flat();

  // ── 2. Normalização + descarte de não-empresas ─────────────────────────
  let discarded = 0;
  const normalized: DiscoveredCompany[] = [];
  for (const hit of rawHits) {
    const ex = extractCompany(hit, brief.regions);
    if (!ex.ok || !ex.company) {
      discarded++;
      continue;
    }
    const c = ex.company;
    const dedupeKey = dedupeKeyFor({
      website: c.website,
      phone: c.phone,
      whatsapp: c.whatsapp,
      instagram: c.instagram,
      companyName: c.companyName,
      city: c.city,
    });

    normalized.push({
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
      dedupeKey,
      score: 0,
      qualification: "low",
      qualificationReason: "",
      qualificationSignals: [],
      qualifiedBy: "heuristic",
      recommendedApproach: null,
    });
  }

  // ── 3. Deduplicação (no lote + contra o que já existe) ─────────────────
  let candidates = mergeByDedupeKey(normalized).filter(
    (c) => !existingKeys.has(c.dedupeKey),
  );

  // ── 4. Qualificação heurística (sempre) ────────────────────────────────
  for (const c of candidates) {
    const q = qualifyHeuristic(
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
      },
      brief,
    );
    c.score = q.score;
    c.qualification = q.qualification;
    c.qualificationReason = q.reason;
    c.qualificationSignals = q.signals;
  }

  candidates.sort((a, b) => b.score - a.score);
  candidates = candidates.slice(0, maxCandidates);

  // ── 5. Refino por IA (opcional, não bloqueante) ────────────────────────
  let aiUsed = false;
  try {
    const r = await refineWithAI(brief.companyId, brief, candidates, args.userId ?? null);
    aiUsed = r.used;
    if (aiUsed) candidates.sort((a, b) => b.score - a.score);
  } catch {
    aiUsed = false;
  }

  return {
    rawCount: rawHits.length,
    discardedCount: discarded,
    candidates,
    queries,
    aiUsed,
  };
}
