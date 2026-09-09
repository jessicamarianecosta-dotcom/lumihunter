/**
 * Refino da qualificação por IA (opcional).
 *
 * - Sem chave de IA (modo demo): ignorada; a heurística vale.
 * - A IA identifica EMPRESAS INDIVIDUAIS que compram um produto CONCRETO do
 *   catálogo. Página editorial / lista / ranking / roteiro NUNCA é empresa.
 * - Após o refino, os gates e sinais são RECALCULADOS (não vêm da IA).
 */
import { generateText, isAiDemoMode } from "@/lib/ai";
import { parseJsonFromText } from "@/lib/anthropic/client";
import { logAiRun } from "@/lib/ai/log";
import { evaluateGates, deriveSignals, heuristicApproach } from "./score";
import type { CampaignBrief, DiscoveredCompany, ResultType } from "./types";

const SYSTEM = `Você é o "Qualifier" do LumiHunter — identifica EMPRESAS INDIVIDUAIS
que comprariam um produto CONCRETO do catálogo da empresa usuária.

REGRAS ABSOLUTAS:
- Uma página editorial NUNCA é uma empresa.
- Uma lista/ranking/roteiro ("8 espaços…", "Os 20 dentistas…", "Melhores
  cafés de Curitiba", "Cafés e docerias em Curitiba") NUNCA é uma empresa.
- Uma notícia/matéria de mercado NUNCA é uma empresa.
- Ter telefone/WhatsApp NÃO prova que a página representa uma empresa.
- Um segmento ("cafeteria", "confeitaria") NÃO prova buyer_fit.
- "individual_business": true SÓ se a URL representa UMA empresa específica,
  com nome próprio identificável.
- "competitor": true se FABRICA/VENDE o mesmo produto (gráfica, impressão,
  comunicação visual…).
- "product_match": aponte UM produto do CATÁLOGO abaixo que faz sentido REAL
  para esta empresa, com o motivo. Se nenhum produto concreto casar, use null
  — "comunicação visual" / "personalizados" genérico NÃO conta.
- "buyer_fit"/"product_fit" (0-100): product_fit=0 se product_match=null.
- Na dúvida → result_type diferente de "business" e product_match=null.
- NUNCA invente dados. Responda SOMENTE JSON.`;

interface AiItem {
  index: number;
  result_type: string;
  individual_business: boolean;
  competitor: boolean;
  buyer_fit: number;
  product_fit: number;
  business_fit: number;
  reason: string;
  evidence: string[];
  product_match: { name: string; reason: string } | null;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
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

  const catalogBlock =
    ctx.catalogProducts.length > 0
      ? ctx.catalogProducts
          .slice(0, 40)
          .map(
            (p) =>
              `- ${p.name}${p.applications.length ? ` (aplicações: ${p.applications.join(", ")})` : ""}`,
          )
          .join("\n")
      : `- ${ctx.name}`;

  const list = batch
    .map((c, i) =>
      [
        `#${i}`,
        `título/nome: ${c.companyName}`,
        `tipo detectado: ${c.businessType} / ${c.resultType}`,
        `cidade/UF: ${c.city ?? "—"}${c.state ? "/" + c.state : ""}`,
        `site: ${c.website ?? "—"} | instagram: ${c.instagram ?? "—"} | whatsapp confirmado: ${c.whatsappVerified ? "sim" : "não"}`,
        `descrição encontrada: ${c.description ?? "—"}`,
        `fonte: ${c.sourceUrl ?? "—"}`,
      ].join("\n"),
    )
    .join("\n\n");

  const prompt = `## CATÁLOGO DA EMPRESA (produtos concretos — o único que pode ser oferecido)
${catalogBlock}

## Perfil de comprador (quem COMPRA)
${brief.buyerProfile.buyerSegments.join(", ") || "—"}

## Perfis EXCLUÍDOS (concorrentes/fornecedores)
${brief.buyerProfile.excludedProfiles.join(", ") || "—"}

## Regiões-alvo
${brief.regions.join(", ") || "—"}

## Resultados encontrados (podem ser empresas OU páginas editoriais/listas)
${list}

## Tarefa
{
  "items": [
    {
      "index": 0,
      "result_type": "business|aggregator|article|news|directory|event|association|government|community|unknown",
      "individual_business": true,
      "competitor": false,
      "buyer_fit": 0-100,
      "product_fit": 0-100,
      "business_fit": 0-100,
      "reason": "1-2 frases factuais",
      "evidence": ["fato do input"],
      "product_match": { "name": "nome EXATO de um produto do catálogo", "reason": "..." }
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

  const catalogNames = new Set(
    ctx.catalogProducts.map((p) => p.name.toLowerCase().trim()),
  );

  for (const item of items) {
    const target = batch[item.index];
    if (!target) continue;

    if (typeof item.result_type === "string" && item.result_type !== "business") {
      target.resultType = item.result_type as ResultType;
    }
    if (item.individual_business === false) target.individualBusiness = false;
    if (item.competitor === true) target.competitor = true;

    const isBiz =
      target.resultType === "business" &&
      !target.competitor &&
      target.individualBusiness;

    // product_match só vale se for um produto REAL do catálogo
    let productMatch = target.productMatch;
    if (
      isBiz &&
      item.product_match &&
      typeof item.product_match.name === "string" &&
      catalogNames.has(item.product_match.name.toLowerCase().trim())
    ) {
      productMatch = {
        name: item.product_match.name.trim(),
        reason: item.product_match.reason?.trim() || `${item.product_match.name}: compatível.`,
      };
    } else if (!isBiz) {
      productMatch = null;
    }
    target.productMatch = productMatch;

    if (isBiz) {
      if (typeof item.buyer_fit === "number") target.buyerFitScore = clamp(item.buyer_fit);
      if (typeof item.business_fit === "number") target.businessFitScore = clamp(item.business_fit);
      target.productFitScore = productMatch
        ? Math.max(target.productFitScore, typeof item.product_fit === "number" ? clamp(item.product_fit) : 60)
        : 0;
    } else {
      target.buyerFitScore = 0;
      target.productFitScore = 0;
    }

    // score recalculado a partir dos fatores
    const regionMatch = target.evidence.some((e) => e.startsWith("Na região"));
    let score = Math.round(
      0.35 * target.buyerFitScore +
        0.3 * target.productFitScore +
        0.2 * (target.whatsappVerified ? 100 : 0) +
        0.1 * (regionMatch ? 100 : target.city ? 15 : 30) +
        0.05 * target.sourceQuality,
    );
    if (brief.channelRequirement === "whatsapp" && !target.whatsappVerified)
      score = Math.min(score, 49);
    target.score = score;

    const gate = evaluateGates({
      score,
      buyerFit: target.buyerFitScore,
      productFit: target.productFitScore,
      productMatch,
      individualBusiness: target.individualBusiness,
      resultType: target.resultType,
      competitor: target.competitor,
      regionMatch,
      hasCity: !!target.city,
      whatsappVerified: target.whatsappVerified,
      channelRequirement: brief.channelRequirement,
    });
    target.qualification = gate.qualification;
    target.prospectable = gate.prospectable;
    target.discardReason = gate.discardReason;

    target.qualificationSignals = deriveSignals({
      individualBusiness: target.individualBusiness,
      competitor: target.competitor,
      resultType: target.resultType,
      buyerFit: target.buyerFitScore,
      productFit: target.productFitScore,
      productMatch,
      regionMatch,
      city: target.city,
      whatsappVerified: target.whatsappVerified,
      channelRequirement: brief.channelRequirement,
    });

    if (item.reason) target.qualificationReason = item.reason;
    if (Array.isArray(item.evidence)) {
      const aiEv = item.evidence.filter((s) => typeof s === "string" && s.trim());
      if (aiEv.length) target.evidence = aiEv;
    }
    target.recommendedApproach = heuristicApproach(target, ctx);
    target.qualifiedBy = "ai";
  }

  await logAiRun({
    companyId: brief.companyId,
    agentKind: "qualifier",
    provider,
    model,
    campaignId: brief.id,
    input: { discovery: batch.length, catalog: ctx.catalogProducts.length },
    output: { qualified: batch.filter((c) => c.prospectable).length },
    usage,
    durationMs: Date.now() - started,
    createdBy: userId,
  });

  return { used: true };
}

/**
 * Retorna um validador: `true` se o texto NÃO menciona produto suspeito fora
 * do catálogo. Mantido para a Fase 2 (personalização de mensagem).
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
      return !bare.split(/[\s-]+/).some((w) => allowed.has(w));
    });
  };
}
