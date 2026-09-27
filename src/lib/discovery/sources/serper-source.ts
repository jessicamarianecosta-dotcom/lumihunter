/**
 * Fonte de descoberta: Serper (google.serper.dev). Implementa `LeadSource`.
 *
 * Camada 5 do pedido do usuário ("outras fontes já disponíveis no
 * projeto"): a integração com a Serper já existe em `src/lib/search/index.ts`
 * (usada pelo agente Hunter) — aqui ela só é reaproveitada como uma segunda
 * fonte para a descoberta de leads, sem criar nada novo. Só entra em ação
 * quando `SERPER_API_KEY` está configurada; sem a chave, fica desativada e
 * a descoberta segue só com a Tavily (nenhum dado fictício é gerado).
 */
import type { LeadSource, LeadSourceQuery, RawDiscoveryHit } from "../types";

async function serperSearch(query: string, limit: number, key: string) {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, gl: "br", hl: "pt-br", num: limit }),
  });
  if (!res.ok) throw new Error(`Serper ${res.status}`);
  const data = (await res.json()) as {
    organic?: { title: string; link: string; snippet?: string }[];
  };
  return data.organic ?? [];
}

export const serperSource: LeadSource = {
  id: "serper",
  label: "Serper (Google)",

  isConfigured() {
    return !!process.env.SERPER_API_KEY?.trim();
  },

  async search({ queries, perQuery = 6 }: LeadSourceQuery): Promise<RawDiscoveryHit[]> {
    const key = process.env.SERPER_API_KEY?.trim();
    if (!key) throw new Error("Serper não configurado");

    const hits: RawDiscoveryHit[] = [];
    for (const query of queries) {
      const results = await serperSearch(query, perQuery, key);
      for (const r of results) {
        hits.push({
          title: r.title,
          url: r.link,
          content: r.snippet ?? "",
          query,
          source: "serper",
        });
      }
    }
    return hits;
  },
};
