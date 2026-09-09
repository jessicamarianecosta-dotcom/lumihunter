/**
 * Preparação das mensagens de abordagem.
 *
 * - Sem IA: usa a mensagem base com variáveis seguras.
 * - Com IA: adapta por lead usando SÓ dados reais + catálogo real. A IA NÃO
 *   pode inventar contato anterior, necessidade, produto ou preço. Se a saída
 *   citar produto fora do catálogo, cai na mensagem base.
 * - Uma chamada por lote.
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
prospecção B2B pelo WhatsApp, em nome da empresa usuária.

REGRAS ABSOLUTAS:
- Mensagem curta (3-5 linhas): saudação + de onde veio o contato + o que a
  empresa faz + pergunta simples (ex.: "posso te enviar nosso catálogo?").
- Só use FATOS do input. É PROIBIDO: "vi seu Instagram", "conheci sua empresa",
  "um cliente indicou", "sei que vocês precisam de X", "vi que vocês estão
  lançando". Se não está nas evidências, não afirme.
- NÃO invente nome de pessoa. Se não houver "contato", use "Olá! Tudo bem?" ou
  "Olá, pessoal da <empresa>!".
- Só mencione produtos/serviços que estão na lista "CATÁLOGO". Nunca cite item
  fora dela.
- Sem preço, sem promessa exagerada, sem emoji em excesso (no máx. 1-2).
- Trate o destinatário como um par. Tom cordial e comercial.
- Responda SOMENTE JSON.`;

export async function prepareMessages(args: PrepareArgs): Promise<PreparedMessage[]> {
  const base = args.baseMessage?.trim() || DEFAULT_BASE_MESSAGE;

  const renderBase = (l: OutreachLead): PreparedMessage => {
    const vars: LeadVars = {
      empresa: l.companyName,
      cidade: l.city,
      estado: l.state,
      segmento: l.segment,
      nome_contato: l.contactName,
      produto: args.productName,
      site: l.website,
    };
    return { leadId: l.leadId, body: renderTemplate(base, vars).text, by: "base" };
  };

  if (
    !args.personalizeAi ||
    args.leads.length === 0 ||
    (await isAiDemoMode(args.companyId))
  ) {
    return args.leads.map(renderBase);
  }

  const batch = args.leads.slice(0, 20);
  const started = Date.now();
  const guard = buildCatalogGuard(args.productName, args.catalogKeywords, [], args.catalogItems);

  const list = batch
    .map((l, i) =>
      [
        `#${i}`,
        `empresa: ${l.companyName}`,
        `segmento: ${l.segment ?? "—"}`,
        `cidade/UF: ${l.city ?? "—"}${l.state ? "/" + l.state : ""}`,
        `contato (nome): ${l.contactName ?? "não informado"}`,
        `evidências reais: ${l.evidence.length ? l.evidence.join("; ") : "nenhuma além do segmento"}`,
      ].join("\n"),
    )
    .join("\n\n");

  const prompt = `## CATÁLOGO (únicos produtos/serviços que podem ser mencionados)
${args.catalogItems.join(", ") || args.productName}

## Produto foco da campanha
${args.productName}

## Mensagem base (referência de tom e estrutura)
${base}

## Empresas a abordar
${list}

## Tarefa
Para cada empresa, escreva a mensagem de WhatsApp.
{ "items": [ { "index": 0, "message": "..." } ] }`;

  let items: { index: number; message: string }[] = [];
  let usage = null;
  let provider: "anthropic" | "openai" = "anthropic";
  let model = "unknown";
  try {
    const res = await generateText({
      companyId: args.companyId,
      system: SYSTEM,
      prompt,
      maxTokens: 4000,
    });
    usage = res.usage;
    provider = res.provider;
    model = res.model;
    const parsed = parseJsonFromText<{ items: { index: number; message: string }[] }>(res.text);
    items = Array.isArray(parsed.items) ? parsed.items : [];
  } catch (e) {
    await logAiRun({
      companyId: args.companyId,
      agentKind: "copywriter",
      provider,
      model,
      campaignId: args.campaignId,
      input: { outreach: batch.length },
      output: { error: String(e) },
      usage,
      durationMs: Date.now() - started,
      status: "error",
      error: String(e),
      createdBy: args.userId,
    });
    return args.leads.map(renderBase);
  }

  const byIndex = new Map(items.map((it) => [it.index, it.message]));
  const out = batch.map((l, i): PreparedMessage => {
    const ai = byIndex.get(i);
    if (
      ai &&
      typeof ai === "string" &&
      ai.trim().length > 20 &&
      ai.length < 900 &&
      guard(ai)
    ) {
      return { leadId: l.leadId, body: ai.trim(), by: "ai" };
    }
    return renderBase(l);
  });
  // leads além do lote (>20) usam base
  for (const l of args.leads.slice(20)) out.push(renderBase(l));

  await logAiRun({
    companyId: args.companyId,
    agentKind: "copywriter",
    provider,
    model,
    campaignId: args.campaignId,
    input: { outreach: batch.length },
    output: { ai: out.filter((m) => m.by === "ai").length },
    usage,
    durationMs: Date.now() - started,
    createdBy: args.userId,
  });

  return out;
}
