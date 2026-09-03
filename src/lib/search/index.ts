/**
 * Camada de busca web para o agente Hunter.
 * Provedores: "serper" (google.serper.dev), "tavily" (tavily.com) ou "mock".
 * Configure via HUNTER_SEARCH_PROVIDER no .env.
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source?: string;
}

const ENV_PROVIDER = process.env.HUNTER_SEARCH_PROVIDER || "mock";

export async function webSearch(
  query: string,
  opts: {
    limit?: number;
    location?: string;
    /** Sobrescreve o provedor configurado (ex: config da empresa no banco). */
    provider?: string;
    /** Sobrescreve a chave de API do provedor (ex: config da empresa no banco). */
    apiKey?: string;
  } = {},
): Promise<SearchResult[]> {
  const limit = opts.limit ?? 10;
  const provider = opts.provider || ENV_PROVIDER;
  switch (provider) {
    case "serper":
      return serper(query, limit, opts.location, opts.apiKey);
    case "tavily":
      return tavily(query, limit, opts.apiKey);
    default:
      return mock(query, limit);
  }
}

async function serper(
  query: string,
  limit: number,
  location?: string,
  apiKeyOverride?: string,
) {
  const key = apiKeyOverride || process.env.SERPER_API_KEY;
  if (!key) throw new Error("SERPER_API_KEY ausente");
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      q: query,
      gl: "br",
      hl: "pt-br",
      num: limit,
      location: location || "Brazil",
    }),
  });
  if (!res.ok) throw new Error(`Serper ${res.status}`);
  const data = (await res.json()) as {
    organic?: { title: string; link: string; snippet?: string }[];
  };
  return (data.organic ?? []).slice(0, limit).map((o) => ({
    title: o.title,
    url: o.link,
    snippet: o.snippet ?? "",
    source: "serper",
  }));
}

async function tavily(query: string, limit: number, apiKeyOverride?: string) {
  const key = apiKeyOverride || process.env.TAVILY_API_KEY;
  if (!key) throw new Error("TAVILY_API_KEY ausente");
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      query,
      max_results: limit,
      country: "brazil",
    }),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}`);
  const data = (await res.json()) as {
    results?: { title: string; url: string; content?: string }[];
  };
  return (data.results ?? []).slice(0, limit).map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.content ?? "",
    source: "tavily",
  }));
}

/** Gera resultados sintéticos plausíveis para desenvolvimento sem credenciais. */
function mock(query: string, limit: number): SearchResult[] {
  const segments = [
    "Confeitaria",
    "Barbearia",
    "Academia",
    "Loja de Roupas",
    "Cafeteria",
    "Petshop",
    "Clínica de Estética",
    "Restaurante",
    "Floricultura",
    "Distribuidora",
  ];
  const cities = ["São Paulo", "Guarulhos", "Osasco", "Santo André", "Barueri"];
  return Array.from({ length: limit }).map((_, i) => {
    const seg = segments[i % segments.length];
    const city = cities[i % cities.length];
    const slug = `${seg.toLowerCase().replace(/\s+/g, "-")}-${i + 1}`;
    return {
      title: `${seg} ${["Aurora", "Bella", "Central", "do Bairro", "Prime"][i % 5]} — ${city}`,
      url: `https://exemplo-${slug}.com.br`,
      snippet: `${seg} em ${city}. Resultado sintético (mock) para a busca "${query}". Instagram ativo, atende encomendas, contato via WhatsApp.`,
      source: "mock",
    };
  });
}
