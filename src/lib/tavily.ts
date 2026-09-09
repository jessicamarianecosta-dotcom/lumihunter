/**
 * Integração REAL com a Tavily Search API (https://tavily.com).
 *
 * Camada server-side reutilizável. A chave vive SOMENTE em `TAVILY_API_KEY`
 * (variável de ambiente do servidor) — nunca no cliente, no banco ou na URL.
 *
 * Em caso de erro, lança `TavilyError` com um `code` estável para a camada de
 * cima traduzir numa mensagem amigável. NUNCA devolve resultados fictícios como
 * fallback silencioso.
 */

export type TavilyErrorCode =
  | "not_configured"
  | "unauthorized"
  | "rate_limited"
  | "timeout"
  | "network"
  | "bad_response"
  | "server_error";

export class TavilyError extends Error {
  code: TavilyErrorCode;
  status?: number;
  constructor(code: TavilyErrorCode, message: string, status?: number) {
    super(message);
    this.name = "TavilyError";
    this.code = code;
    this.status = status;
  }
}

/** Mensagem pronta para exibir ao usuário (pt-BR). */
export function tavilyErrorMessage(code: TavilyErrorCode): string {
  switch (code) {
    case "not_configured":
      return "A integração do Tavily não está configurada. Adicione a variável TAVILY_API_KEY no servidor.";
    case "unauthorized":
      return "A chave do Tavily foi recusada (não autorizada). Verifique a variável TAVILY_API_KEY.";
    case "rate_limited":
      return "O Tavily atingiu o limite de consultas. Tente novamente em alguns minutos.";
    case "timeout":
      return "A busca no Tavily demorou demais e foi interrompida. Tente novamente.";
    case "network":
      return "Não foi possível falar com o Tavily (erro de rede). Tente novamente.";
    case "bad_response":
      return "O Tavily respondeu num formato inesperado. Tente novamente.";
    case "server_error":
      return "O Tavily está com instabilidade no momento. Tente novamente mais tarde.";
  }
}

export interface TavilyResult {
  title: string;
  url: string;
  /** Trecho/resumo retornado pela Tavily. */
  content: string;
  /** Conteúdo bruto da página, quando solicitado. */
  rawContent: string | null;
  /** Relevância 0–1 atribuída pela Tavily. */
  relevance: number | null;
}

export interface TavilySearchResponse {
  query: string;
  answer: string | null;
  results: TavilyResult[];
}

export function tavilyConfigured(): boolean {
  return !!process.env.TAVILY_API_KEY;
}

interface TavilyOptions {
  maxResults?: number;
  searchDepth?: "basic" | "advanced";
  includeRawContent?: boolean;
  timeoutMs?: number;
}

const ENDPOINT = "https://api.tavily.com/search";

export async function tavilySearch(
  query: string,
  opts: TavilyOptions = {},
): Promise<TavilySearchResponse> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new TavilyError("not_configured", "TAVILY_API_KEY ausente");

  const {
    maxResults = 8,
    searchDepth = "advanced",
    includeRawContent = false,
    timeoutMs = 20_000,
  } = opts;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        query,
        search_depth: searchDepth,
        max_results: Math.min(Math.max(maxResults, 1), 20),
        include_answer: false,
        include_raw_content: includeRawContent,
        country: "brazil",
      }),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof Error && e.name === "AbortError") {
      throw new TavilyError("timeout", "Tavily: timeout");
    }
    throw new TavilyError("network", `Tavily: falha de rede (${String(e)})`);
  }
  clearTimeout(timer);

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new TavilyError("unauthorized", `Tavily ${res.status}`, res.status);
    }
    if (res.status === 429) {
      throw new TavilyError("rate_limited", "Tavily 429", 429);
    }
    if (res.status >= 500) {
      throw new TavilyError("server_error", `Tavily ${res.status}`, res.status);
    }
    throw new TavilyError("bad_response", `Tavily ${res.status}`, res.status);
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new TavilyError("bad_response", "Tavily: JSON inválido");
  }

  const raw = data as {
    query?: string;
    answer?: string | null;
    results?: {
      title?: string;
      url?: string;
      content?: string;
      raw_content?: string | null;
      score?: number;
    }[];
  };
  if (!raw || !Array.isArray(raw.results)) {
    throw new TavilyError("bad_response", "Tavily: sem array de resultados");
  }

  return {
    query: raw.query ?? query,
    answer: raw.answer ?? null,
    results: raw.results
      .filter((r): r is { title: string; url: string } & typeof r =>
        Boolean(r && r.url),
      )
      .map((r) => ({
        title: (r.title ?? "").trim(),
        url: r.url,
        content: (r.content ?? "").trim(),
        rawContent: r.raw_content ?? null,
        relevance: typeof r.score === "number" ? r.score : null,
      })),
  };
}
