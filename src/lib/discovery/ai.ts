/**
 * Refino da qualificação por IA (opcional).
 *
 * - Sem chave de IA (modo demo): ignorada; a heurística vale.
 * - A IA procura COMPRADORES do produto — não fornecedores nem concorrentes.
 *   Recebe o catálogo e é proibida de recomendar produto fora dele.
 * - Uma única chamada por lote.
 */
import { generateText, isAiDemoMode } from "@/lib/ai";
import { parseJsonFromText } from "@/lib/anthropic/client";
import { logAiRun } from "@/lib/ai/log";
import { qualificationBand } from "./score";
import type { CampaignBrief, DiscoveredCompany } from "./types";

const SYSTEM = `Você é o "Qualifier" do LumiHunter, agente de qualificação de leads B2B.

Você está procurando COMPRADORES do produto — empresas que comprariam esse
produto de um fornecedor. NÃO fornecedores, NÃO concorrentes, NÃO quem "usa"
ou "vende" o mesmo produto.

Você recebe:
1. O CATÁLOGO da campanha (o único produto que a empresa usuária vende).
2. O PERFIL DE COMPRADOR e os PERFIS EXCLUÍDOS (concorrentes/fornecedores).
3. Empresas encontradas, com SÓ os dados da busca.

REGRAS ABSOLUTAS:
- "competitor": true se a empresa FABRICA/VENDE o mesmo produto (gráfica,
  impressão, comunicação visual, fábrica de etiquetas…). competitor=true →
  buyer_fit=0, product_fit=0.
- "buyer_fit" (0-100): esta empresa COMPRA este produto de fornecedores? Ter
  site, telefone, Instagram ou estar na região NÃO aumenta buyer_fit.
- "product_fit" (0-100): o produto tem aplicação real no negócio dela?
- NUNCA invente dados. Se é inferência, escreva "indica", "sugere", "a confirmar".
- "result_type": "business" só para empresa/negócio específico.
- "recommended_approach": SÓ o produto do catálogo. PROIBIDO citar qualquer
  outro produto/serviço ("kit festa", "decoração", "brindes"…).
- "evidence": fatos do input, nunca invenção.
- Responda SOMENTE JSON.`;

interface AiItem {
  index: number;
  result_type: string;
  competitor: boolean;
  buyer_fit: number;
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
    ctx.applications.length ? `Aplicações: ${ctx.applications.join(", ")}` : null,
    ctx.variantNames.length ? `Variações: ${ctx.variantNames.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const list = batch
    .map((c, i) =>
      [
        `#${i}`,
        `nome: ${c.companyName}`,
        `tipo detectado: ${c.businessType} / ${c.resultType}${c.competitor ? " / possível concorrente" : ""}`,
        `cidade/UF: ${c.city ?? "—"}${c.state ? "/" + c.state : ""}`,
        `site: ${c.website ?? "—"} | instagram: ${c.instagram ?? "—"} | whatsapp confirmado: ${c.whatsappVerified ? "sim" : "não"}`,
        `descrição encontrada: ${c.description ?? "—"}`,
        `fonte: ${c.sourceUrl ?? "—"}`,
      ].join("\n"),
    )
    .join("\n\n");

  const prompt = `## CATÁLOGO DA CAMPANHA (único produto que pode ser oferecido)
${catalogBlock}

## Perfil de comprador (quem COMPRA)
${brief.buyerProfile.buyerSegments.join(", ") || "—"}

## Perfis EXCLUÍDOS (concorrentes/fornecedores — nunca são lead)
${brief.buyerProfile.excludedProfiles.join(", ") || "—"}

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
      "competitor": false,
      "buyer_fit": 0-100,
      "product_fit": 0-100,
      "business_fit": 0-100,
      "score": 0-100,
      "reason": "1-2 frases factuais",
      "evidence": ["fato do input"],
      "signals": ["Empresa compradora identificada", "Produto compatível", "..."],
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

  const catalogGuard = buildCatalogGuard(
    ctx.name,
    ctx.keywords,
    ctx.variantNames,
    ctx.applications,
  );

  for (const item of items) {
    const target = batch[item.index];
    if (!target) continue;

    if (typeof item.result_type === "string" && item.result_type !== "business") {
      target.resultType = item.result_type as DiscoveredCompany["resultType"];
    }
    if (item.competitor === true) {
      target.competitor = true;
      target.buyerFitScore = 0;
      target.productFitScore = 0;
    }
    if (!target.competitor) {
      if (typeof item.buyer_fit === "number") target.buyerFitScore = clamp(item.buyer_fit);
      if (typeof item.product_fit === "number") target.productFitScore = clamp(item.product_fit);
      if (typeof item.business_fit === "number") target.businessFitScore = clamp(item.business_fit);
    }
    if (typeof item.score === "number") target.score = clamp(item.score);
    if (
      brief.channelRequirement === "whatsapp" &&
      !target.whatsappVerified &&
      target.score > 49
    ) {
      target.score = 49;
    }

    target.qualification = qualificationBand({
      final: target.score,
      buyerFit: target.buyerFitScore,
      productFit: target.productFitScore,
      resultType: target.resultType,
      competitor: target.competitor,
      whatsappVerified: target.whatsappVerified,
      channelRequirement: brief.channelRequirement,
    });

    if (item.reason) target.qualificationReason = item.reason;
    if (Array.isArray(item.evidence))
      target.evidence = item.evidence.filter((s) => typeof s === "string" && s.trim());
    if (Array.isArray(item.signals) && item.signals.length)
      target.qualificationSignals = item.signals
        .filter((s) => typeof s === "string" && s.trim())
        .map((s) => ({ label: s.trim() }));

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
 * do catálogo.
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
