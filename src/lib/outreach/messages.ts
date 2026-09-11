/**
 * Preparação das mensagens de abordagem.
 *
 * - Sem IA: usa a mensagem base com variáveis seguras (cita a empresa pelo nome).
 * - Com IA: uma chamada por lead (nunca reaproveita uma mensagem entre
 *   empresas). A IA usa SÓ dados reais da empresa (nome, segmento, cidade,
 *   site, Instagram, descrição, evidências) + catálogo real. Não pode
 *   inventar contato anterior, necessidade, produto ou preço. Se a saída
 *   citar produto fora do catálogo, ou a IA falhar, cai na mensagem base
 *   (sem quebrar a campanha).
 */
import { generateText, isAiDemoMode } from "@/lib/ai";
import { parseJsonFromText } from "@/lib/anthropic/client";
import { logAiRun } from "@/lib/ai/log";
import { buildCatalogGuard } from "@/lib/discovery/ai";
import { renderTemplate, DEFAULT_BASE_MESSAGE, type LeadVars } from "./vars";

export interface OutreachLead {
  leadId: string;
  companyName: string;
  city: string | null;
  state: string | null;
  segment: string | null;
  contactName: string | null;
  website: string | null;
  instagram: string | null;
  /** Descrição pública do negócio (quando encontrada na pesquisa). */
  description: string | null;
  evidence: string[];
  buyerFit: number | null;
  productFit: number | null;
}

export interface PreparedMessage {
  leadId: string;
  body: string;
  by: "ai" | "base";
}

interface PrepareArgs {
  companyId: string;
  campaignId: string;
  productName: string;
  /** Produtos/serviços concretos do catálogo que a IA pode citar. */
  catalogItems: string[];
  catalogKeywords: string[];
  baseMessage: string | null;
  personalizeAi: boolean;
  leads: OutreachLead[];
  userId: string | null;
}

const SYSTEM = `Você é o "Copywriter" do LumiHunter — escreve a PRIMEIRA mensagem de
prospecção comercial B2B pelo WhatsApp, em nome da empresa usuária, para UMA
empresa específica por vez.

REGRAS ABSOLUTAS:
- Mensagem curta (3-5 linhas): saudação citando o nome da empresa + o que a
  empresa usuária oferece + convite para ver o catálogo.
- SEMPRE mencione o nome da empresa prospectada logo na saudação (ex.: "Olá,
  <nome da empresa>! 😊"). Nunca comece de forma genérica quando o nome é
  dado.
- Use os dados reais fornecidos (segmento, cidade, site, Instagram, descrição,
  evidências) para deixar a mensagem relevante para AQUELE negócio
  especificamente — mas só cite o que está no input. É PROIBIDO inventar:
  "vi seu Instagram", "conheci sua empresa", "um cliente indicou", "sei que
  vocês precisam de X", "notei que vocês estão lançando", necessidade,
  contato anterior, ou qualquer fato que não esteja no input.
- Sem informação específica suficiente sobre a empresa → use uma mensagem
  ainda personalizada pelo nome e segmento, mas mais genérica no resto.
- NÃO invente nome de pessoa de contato.
- Só mencione produtos/serviços que estão na lista "CATÁLOGO". Nunca cite
  item fora dela. Sem preço, medida, prazo, material ou promoção.
- Varie a abertura, a estrutura, o produto citado e a chamada para ação de
  mensagem para mensagem — a variação é para soar natural e relevante para
  cada empresa, NUNCA para tentar burlar filtros antispam da Meta. A
  comunicação deve ser transparente e seguir as regras da API oficial do
  WhatsApp.
- Sem promessa exagerada, no máx. 1-2 emojis. Tom cordial e comercial.
- Responda SOMENTE JSON: { "message": "..." }`;

function buildLeadBlock(l: OutreachLead, productName: string): string {
  const lines = [
    `nome da empresa: ${l.companyName}`,
    `segmento / tipo de negócio: ${l.segment ?? "não identificado"}`,
    `cidade${l.state ? "/UF" : ""}: ${[l.city, l.state].filter(Boolean).join("/") || "não identificado"}`,
    `produto compatível do catálogo: ${productName}`,
  ];
  if (l.website) lines.push(`site: ${l.website}`);
  if (l.instagram) lines.push(`instagram: ${l.instagram}`);
  if (l.description) lines.push(`descrição pública do negócio: ${l.description}`);
  lines.push(
    `evidências reais: ${l.evidence.length ? l.evidence.join("; ") : "nenhuma além do segmento"}`,
  );
  return lines.join("\n");
}

function renderBase(
  l: OutreachLead,
  base: string,
  productName: string,
): PreparedMessage {
  const vars: LeadVars = {
    empresa: l.companyName,
    cidade: l.city,
    estado: l.state,
    segmento: l.segment,
    nome_contato: l.contactName,
    produto: productName,
    site: l.website,
  };
  const body = renderTemplate(base, vars).text;
  return { leadId: l.leadId, body, by: "base" };
}

/** Roda `worker` com no máximo `limit` execuções simultâneas, preservando a ordem. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      out[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return out;
}

export async function prepareMessages(args: PrepareArgs): Promise<PreparedMessage[]> {
  const base = args.baseMessage?.trim() || DEFAULT_BASE_MESSAGE;
  const toBase = (l: OutreachLead) => renderBase(l, base, args.productName);

  if (
    !args.personalizeAi ||
    args.leads.length === 0 ||
    (await isAiDemoMode(args.companyId))
  ) {
    return args.leads.map(toBase);
  }

  // até 60 empresas por chamada de "preparar" — acima disso usa a base
  // (evita estourar o tempo da função serverless; 100 leads/dia cabem em
  // 2 gerações).
  const batch = args.leads.slice(0, 60);
  const guard = buildCatalogGuard(args.productName, args.catalogKeywords, [], args.catalogItems);

  const results = await mapWithConcurrency(batch, 5, async (l): Promise<PreparedMessage> => {
    const started = Date.now();
    const prompt = `## CATÁLOGO (únicos produtos/serviços que podem ser mencionados)
${args.catalogItems.join(", ") || args.productName}

## Produto foco da campanha
${args.productName}

## Mensagem base (referência de tom e estrutura, NÃO copie literalmente)
${base}

## Empresa a abordar
${buildLeadBlock(l, args.productName)}

## Tarefa
Escreva a mensagem de WhatsApp para ESTA empresa, citando o nome dela.
{ "message": "..." }`;

    let provider: "anthropic" | "openai" = "anthropic";
    let model = "unknown";
    try {
      const res = await generateText({
        companyId: args.companyId,
        system: SYSTEM,
        prompt,
        maxTokens: 500,
      });
      provider = res.provider;
      model = res.model;
      const parsed = parseJsonFromText<{ message: string }>(res.text);
      const ai = parsed.message;

      if (
        ai &&
        typeof ai === "string" &&
        ai.trim().length > 20 &&
        ai.length < 900 &&
        guard(ai)
      ) {
        await logAiRun({
          companyId: args.companyId,
          agentKind: "copywriter",
          provider,
          model,
          campaignId: args.campaignId,
          leadId: l.leadId,
          input: { companyName: l.companyName, segment: l.segment },
          output: { ai: true },
          usage: res.usage,
          durationMs: Date.now() - started,
          createdBy: args.userId,
        });
        return { leadId: l.leadId, body: ai.trim(), by: "ai" };
      }

      await logAiRun({
        companyId: args.companyId,
        agentKind: "copywriter",
        provider,
        model,
        campaignId: args.campaignId,
        leadId: l.leadId,
        input: { companyName: l.companyName, segment: l.segment },
        output: { error: "saída inválida ou fora do catálogo", raw: ai ?? null },
        usage: res.usage,
        durationMs: Date.now() - started,
        status: "error",
        error: "invalid_or_out_of_catalog",
        createdBy: args.userId,
      });
    } catch (e) {
      await logAiRun({
        companyId: args.companyId,
        agentKind: "copywriter",
        provider,
        model,
        campaignId: args.campaignId,
        leadId: l.leadId,
        input: { companyName: l.companyName, segment: l.segment },
        output: { error: String(e) },
        usage: null,
        durationMs: Date.now() - started,
        status: "error",
        error: String(e),
        createdBy: args.userId,
      });
    }
    // falhou (erro, saída inválida ou produto fora do catálogo) → mensagem
    // base para este lead; não derruba os outros nem a campanha.
    return toBase(l);
  });

  // leads além do lote usam base
  const rest = args.leads.slice(60).map(toBase);
  return [...results, ...rest];
}
