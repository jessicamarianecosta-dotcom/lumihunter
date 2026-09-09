/**
 * Fonte de descoberta: Tavily. Implementa `LeadSource`.
 *
 * Fase 3 adiciona outras fontes (Google Places…) implementando a mesma
 * interface — o orquestrador (`../index.ts`) não muda.
 */
import { tavilyConfigured, tavilySearch, TavilyError } from "@/lib/tavily";
import type { LeadSource, LeadSourceQuery, RawDiscoveryHit } from "../types";

export const tavilySource: LeadSource = {
  id: "tavily",
  label: "Tavily",

  isConfigured() {
    return tavilyConfigured();
  },

  async search({ queries, perQuery = 6 }: LeadSourceQuery): Promise<RawDiscoveryHit[]> {
    if (!tavilyConfigured()) {
      throw new TavilyError("not_configured", "Tavily não configurado");
    }

    const hits: RawDiscoveryHit[] = [];
    // Sequencial e limitado: evita rajada de chamadas e respeita rate limit.
    for (const query of queries) {
      const res = await tavilySearch(query, {
        maxResults: perQuery,
        searchDepth: "advanced",
        includeRawContent: false,
      });
      for (const r of res.results) {
        hits.push({
          title: r.title,
          url: r.url,
          content: r.content,
          rawContent: r.rawContent,
          relevance: r.relevance,
          query,
          source: "tavily",
        });
      }
    }
    return hits;
  },
};
