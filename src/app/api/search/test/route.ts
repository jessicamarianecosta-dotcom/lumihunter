import { NextResponse } from "next/server";
import { tryGetContext, isAdmin } from "@/lib/auth/context";
import { getIntegrationConfig, type SearchConfig } from "@/lib/integrations/config";
import { webSearch } from "@/lib/search";

export const maxDuration = 20;

/** Testa a conexão real com o provedor de busca (Tavily/Serper) do Hunter. */
export async function POST() {
  const ctx = await tryGetContext();
  if (!ctx)
    return NextResponse.json({ ok: false, error: "não autenticado" }, { status: 401 });
  if (!isAdmin(ctx.role))
    return NextResponse.json({ ok: false, error: "sem permissão" }, { status: 403 });

  const cfg = (await getIntegrationConfig<SearchConfig>(ctx.company.id, "search"))
    ?.config;
  const provider = cfg?.provider || process.env.HUNTER_SEARCH_PROVIDER || "mock";
  const apiKey =
    cfg?.api_key ||
    (provider === "serper" ? process.env.SERPER_API_KEY : process.env.TAVILY_API_KEY);

  if (provider === "mock") {
    return NextResponse.json({
      ok: false,
      error: "Provedor definido como Mock — configure Tavily ou Serper para busca real.",
    });
  }
  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      error: `${provider === "serper" ? "Serper" : "Tavily"} não configurado. Adicione a chave da API nas configurações.`,
    });
  }

  try {
    const results = await webSearch("teste de conexão LumiHunter", {
      limit: 1,
      provider,
      apiKey,
    });
    return NextResponse.json({
      ok: true,
      message: `${provider === "serper" ? "Serper" : "Tavily"} respondeu (${results.length} resultado${results.length === 1 ? "" : "s"})`,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: (e as Error).message || "Falha ao consultar o provedor de busca.",
    });
  }
}
