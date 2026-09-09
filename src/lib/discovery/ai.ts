/**
 * Refino da qualificação por IA (opcional).
 *
 * - Sem chave de IA (modo demo): ignorada; a heurística vale. A descoberta via
 *   Tavily NÃO depende disto.
 * - A IA recebe só dados REAIS + o CATÁLOGO da campanha e devolve product fit,
 *   business fit, evidências e a abordagem. Ela NÃO pode inventar dados NEM
 *   recomendar produto/serviço fora do catálogo.
 * - Uma única chamada por lote.
 */
import { generateText, isAiDemoMode } from "@/lib/ai";
import { parseJsonFromText } from "@/lib/anthropic/client";
import { logAiRun } from "@/lib/ai/log";
import { qualificationBand } from "./score";
import type { CampaignBrief, DiscoveredCompany } from "./types";

const SYSTEM = `Você é o "Qualifier" do LumiHunter, agente de qualificação de leads B2B.

Você recebe:
1. O CATÁLOGO da campanha (o único produto/serviço que a empresa usuária vende).
2. Empresas encontradas em buscas públicas, com SÓ os dados que a busca trouxe.

Para cada empresa, avalie o POTENCIAL DE COMPRA do produto do catálogo.

REGRAS ABSOLUTAS:
- NUNCA invente dados (telefone, site, cidade, segmento, faturamento).
- NUNCA afirme um fato sem evidência no input. Se é inferência, escreva "indica",
  "sugere", "a confirmar" — nunca "usa", "compra", "precisa".
- "product_fit" (0-100) mede SÓ: esta empresa tem razão concreta para comprar
  ESTE produto? Região, ter site ou WhatsApp NÃO aumentam product_fit.
- "recommended_approach" só pode mencionar o produto do catálogo. É PROIBIDO
  sugerir qualquer outro produto/serviço (ex.: "kit festa", "decoração",
  "brindes") que não esteja no catálogo. Se não souber a aplicação, escreva
  uma abordagem genérica sobre o produto do catálogo.
- "result_type": "business" só se for uma empresa/negócio específico. Órgão
  público, associação, evento, feira, lista/diretório, portal de
  empreendedorismo, artigo → o tipo correspondente, e product_fit = 0.
- "evidence": lista de FATOS do input (ex.: "Site apresenta linha de velas em
  potes individuais"). Não invente.
- Responda SOMENTE com JSON válido.`;

interface AiItem {
  index: number;
  result_type: string;
  product_fit: number;
  business_fit: number;
  score: number;
  reason: string;
  evidence: string[];
  signals: string[];
  recommended_approach: string | null;
}

export async function refineWithAI(
  brief: CampaignBrief,
  companies: DiscoveredCompany[],
  userId: string | null,
): Promise<{ used: boolean }> {
  if (companies.length === 0) return { used: false };
  if (await isAiDemoMode(brief.companyId)) return { used: false };

  const batch = companies.slice(0, 25);
  const started = Date.now();
  const ctx = brief.productContext;

  const catalogBlock = [
    `Produto: ${ctx.name}`,
    ctx.description ? `Descrição: ${ctx.description}` : null,
    ctx.category ? `Categoria: ${ctx.category}` : null,
    ctx.applications.length ? `Aplicações: ${ctx.applications.join(", ")}` : null,
    ctx.exampleBuyers.length ? `Compradores típicos: ${ctx.exampleBuyers.join(", ")}` : null,
    ctx.variantNames.length ? `Variações: ${ctx.variantNames.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const list = batch
    .map((c, i) =>
      [
        `#${i}`,
        `nome: ${c.companyName}`,
        `tipo detectado: ${c.businessType} / ${c.resultType}`,
        `cidade/UF: ${c.city ?? "—"}${c.state ? "/" + c.state : ""}`,
        `site: ${c.website ?? "—"} | instagram: ${c.instagram ?? "—"}`,
        `descrição encontrada: ${c.description ?? "—"}`,
        `fonte: ${c.sourceUrl ?? "—"}`,
      ].join("\n"),
    )
    .join("\n\n");

  const prompt = `## CATÁLOGO DA CAMPANHA (único produto que pode ser oferecido)
${catalogBlock}

## Regiões-alvo
${brief.regions.join(", ") || "—"}

## Empresas encontradas (dados reais)
${list}

## Tarefa
{
  "items": [
    {
      "index": 0,
      "result_type": "business|article|directory|event|association|government|community|content|unknown",
      "product_fit": 0-100,
      "business_fit": 0-100,
      "score": 0-100,
      "reason": "1-2 frases factuais",
      "evidence": ["fato do input", "..."],
      "signals": ["Compatível com <produto>", "Segmento comprador potencial", "..."],
      "recommended_approach": "abordagem citando SÓ o produto do catálogo, ou null"
    }
  ]
}`;

  let items: AiItem[] = [];
  let usage = null;
  let provider: "anthropic" | "openai" = "anthropic";
  let model = "unknown";
  try {
    const res = await generateText({
      companyId: brief.companyId,
      system: SYSTEM,
      prompt,
      maxTokens: 6000,
    });
    usage = res.usage;
    provider = res.provider;
    model = res.model;
    const parsed = parseJsonFromText<{ items: AiItem[] }>(res.text);
    items = Array.isArray(parsed.items) ? parsed.items : [];
  } catch (e) {
    await logAiRun({
      companyId: brief.companyId,
      agentKind: "qualifier",
      provider,
      model,
      campaignId: brief.id,
      input: { discovery: batch.length },
      output: { error: String(e) },
      usage,
      durationMs: Date.now() - started,
      status: "error",
      error: String(e),
      createdBy: userId,
    });
    return { used: false };
  }

  const catalogGuard = buildCatalogGuard(ctx.name, ctx.keywords, ctx.variantNames, ctx.applications);

  for (const item of items) {
    const target = batch[item.index];
    if (!target) continue;

    if (typeof item.result_type === "string" && item.result_type !== "business") {
      target.resultType = item.result_type as DiscoveredCompany["resultType"];
      target.productFitScore = 0;
    }
    if (typeof item.product_fit === "number")
      target.productFitScore = clamp(item.product_fit);
    if (typeof item.business_fit === "number")
      target.businessFitScore = clamp(item.business_fit);
    if (typeof item.score === "number") target.score = clamp(item.score);
    target.qualification = qualificationBand(target.score, target.productFitScore);

    if (item.reason) target.qualificationReason = item.reason;
    if (Array.isArray(item.evidence))
      target.evidence = item.evidence.filter((s) => typeof s === "string" && s.trim());
    if (Array.isArray(item.signals) && item.signals.length)
      target.qualificationSignals = item.signals
        .filter((s) => typeof s === "string" && s.trim())
        .map((s) => ({ label: s.trim() }));

    // abordagem: só passa se não citar produto fora do catálogo
    if (item.recommended_approach && catalogGuard(item.recommended_approach)) {
      target.recommendedApproach = item.recommended_approach;
    }
    target.qualifiedBy = "ai";
  }

  await logAiRun({
    companyId: brief.companyId,
    agentKind: "qualifier",
    provider,
    model,
    campaignId: brief.id,
    input: { discovery: batch.length, catalog: ctx.name },
    output: { qualified: items.length },
    usage,
    durationMs: Date.now() - started,
    createdBy: userId,
  });

  return { used: true };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Retorna um validador: `true` se o texto NÃO menciona produto suspeito fora
 * do catálogo. Lista curta de itens que a IA costuma alucinar nesse contexto.
 */
export function buildCatalogGuard(
  name: string,
  keywords: string[],
  variants: string[],
  applications: string[],
): (text: string) => boolean {
  const allowed = new Set(
    [name, ...keywords, ...variants, ...applications]
      .join(" ")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .split(/[\s,/]+/)
      .filter((w) => w.length > 2),
  );
  const SUSPECT = [
    "kit festa", "kit-festa", "decoração", "decoracao", "brinde", "brindes",
    "lembrancinha", "lembrancinhas", "convite", "topo de bolo", "painel",
    "camiseta", "caneca", "cartão de visita", "cartao de visita", "banner",
    "panfleto", "flyer", "adesivo de parede", "plotagem de veículo",
  ];
  return (text: string) => {
    const t = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    return !SUSPECT.some((s) => {
      const bare = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
      if (!t.includes(bare)) return false;
      // permitido se alguma palavra do termo estiver no catálogo
      return !bare.split(/[\s-]+/).some((w) => allowed.has(w));
    });
  };
}
