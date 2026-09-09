/**
 * Refino da qualificação por IA (opcional).
 *
 * - Se a empresa NÃO tem chave de IA configurada (modo demo), esta camada é
 *   ignorada e a heurística vale. A descoberta via Tavily NÃO depende disto.
 * - A IA recebe só os dados REAIS já extraídos + o briefing da campanha e
 *   devolve score/qualificação/motivo/sinais. Ela NÃO pode inventar dados.
 * - Uma única chamada por lote (barata e previsível).
 */
import { generateText, isAiDemoMode } from "@/lib/ai";
import { parseJsonFromText } from "@/lib/anthropic/client";
import { logAiRun } from "@/lib/ai/log";
import { qualificationBand } from "./score";
import type { CampaignBrief, DiscoveredCompany } from "./types";

const SYSTEM = `Você é o "Qualifier" do LumiHunter, um agente de qualificação de leads B2B.
Recebe o briefing de uma campanha (o que a empresa vende, para quem, onde) e uma
lista de empresas encontradas em buscas públicas, com SÓ os dados que a busca
trouxe. Sua tarefa: dar a cada empresa um score de 0 a 100 de potencial de
COMPRAR o produto da campanha, e explicar.

REGRAS ABSOLUTAS:
- NUNCA invente dados (telefone, site, cidade, segmento). Use só o que está no input.
- Se faltam dados, o score deve refletir a incerteza (não chute alto).
- "reason" tem 1-2 frases, factual, em português do Brasil.
- "signals" são observações curtas derivadas do input (ex.: "Segmento compatível",
  "Tem WhatsApp comercial", "Região compatível"). Não repita algo que não esteja no input.
- Responda SOMENTE com JSON válido no schema pedido.`;

interface AiItem {
  index: number;
  score: number;
  reason: string;
  signals: string[];
  recommended_approach?: string | null;
}

export async function refineWithAI(
  companyId: string,
  brief: CampaignBrief,
  companies: DiscoveredCompany[],
  userId: string | null,
): Promise<{ used: boolean }> {
  if (companies.length === 0) return { used: false };
  if (await isAiDemoMode(companyId)) return { used: false };

  const batch = companies.slice(0, 30);
  const started = Date.now();

  const list = batch
    .map((c, i) =>
      [
        `#${i}`,
        `nome: ${c.companyName}`,
        `segmento: ${c.segment ?? "—"}`,
        `cidade/UF: ${c.city ?? "—"}${c.state ? "/" + c.state : ""}`,
        `site: ${c.website ?? "—"}`,
        `instagram: ${c.instagram ?? "—"}`,
        `telefone: ${c.phone ?? "—"} | whatsapp: ${c.whatsapp ?? "—"}`,
        `descrição: ${c.description ?? "—"}`,
      ].join("\n"),
    )
    .join("\n\n");

  const prompt = `## Briefing da campanha
Produto/serviço: ${brief.product}
Público-alvo: ${brief.audience}
Região: ${brief.regions.join(", ") || "—"}

## Empresas encontradas (dados reais das buscas)
${list}

## Tarefa
Para cada empresa, devolva:
{
  "items": [
    { "index": 0, "score": 0-100, "reason": "1-2 frases", "signals": ["..."], "recommended_approach": "1 frase ou null" }
  ]
}`;

  let items: AiItem[] = [];
  let usage = null;
  let provider: "anthropic" | "openai" = "anthropic";
  let model = "unknown";
  try {
    const res = await generateText({
      companyId,
      system: SYSTEM,
      prompt,
      maxTokens: 4000,
    });
    usage = res.usage;
    provider = res.provider;
    model = res.model;
    const parsed = parseJsonFromText<{ items: AiItem[] }>(res.text);
    items = Array.isArray(parsed.items) ? parsed.items : [];
  } catch (e) {
    await logAiRun({
      companyId,
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

  for (const item of items) {
    const target = batch[item.index];
    if (!target) continue;
    if (typeof item.score === "number") {
      target.score = Math.max(0, Math.min(100, Math.round(item.score)));
      target.qualification = qualificationBand(target.score);
    }
    if (item.reason) target.qualificationReason = item.reason;
    if (Array.isArray(item.signals) && item.signals.length) {
      target.qualificationSignals = item.signals
        .filter((s) => typeof s === "string" && s.trim())
        .map((s) => ({ label: s.trim() }));
    }
    if (item.recommended_approach) target.recommendedApproach = item.recommended_approach;
    target.qualifiedBy = "ai";
  }

  await logAiRun({
    companyId,
    agentKind: "qualifier",
    provider,
    model,
    campaignId: brief.id,
    input: { discovery: batch.length },
    output: { qualified: items.length },
    usage,
    durationMs: Date.now() - started,
    createdBy: userId,
  });

  return { used: true };
}
