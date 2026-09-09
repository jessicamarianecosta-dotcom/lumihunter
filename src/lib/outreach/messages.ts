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
import {
  renderTemplate,
  mentionsCompanyName,
  DEFAULT_BASE_MESSAGE,
  type LeadVars,
} from "./vars";

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
  /** true se a saída da IA citou o nome da empresa e foi substituída. */
  nameLeakFixed?: boolean;
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
  /**
   * Anonimiza a abordagem: a mensagem NUNCA cita o nome da empresa prospectada
   * (regra do produto). Default true. O nome só é usado para auditoria.
   */
  anonymize?: boolean;
}

const SYSTEM = `Você é o "Copywriter" do LumiHunter — escreve a PRIMEIRA mensagem de
prospecção comercial B2B pelo WhatsApp, em nome da empresa usuária.

REGRAS ABSOLUTAS:
- Mensagem curta (3-5 linhas): saudação + o que a empresa oferece + convite para
  ver o catálogo (ex.: "vou deixar nosso catálogo, se tiver interesse é só chamar").
- NUNCA mencione o nome da empresa prospectada. Você NÃO recebe esse nome de
  propósito. Nada de "Olá, <nome>!" ou "vi a <nome>". A abordagem tem de soar
  como um contato comercial natural.
- Pode usar: o SEGMENTO/tipo de negócio e o PRODUTO compatível. Nada além disso.
- Só use FATOS do input. É PROIBIDO: "vi seu Instagram", "conheci sua empresa",
  "um cliente indicou", "sei que vocês precisam de X", "notei que vocês estão
  lançando". Não invente necessidade nem contato anterior.
- NÃO invente nome de pessoa. Comece com "Olá! Tudo bem?".
- Só mencione produtos/serviços que estão na lista "CATÁLOGO". Nunca cite item
  fora dela. Sem preço, medida, prazo, material ou promoção.
- Sem promessa exagerada, no máx. 1-2 emojis. Tom cordial e comercial.
- Responda SOMENTE JSON.`;

/** Regra do produto: a abordagem NUNCA cita o nome da empresa. Puro. */
export function enforceNoName(
  body: string,
  companyName: string | null,
  fallback: string,
): { body: string; replaced: boolean } {
  if (body.trim() && !mentionsCompanyName(body, companyName)) {
    return { body: body.trim(), replaced: false };
  }
  return { body: fallback.trim(), replaced: true };
}

export async function prepareMessages(args: PrepareArgs): Promise<PreparedMessage[]> {
  const anonymize = args.anonymize !== false;
  const base = args.baseMessage?.trim() || DEFAULT_BASE_MESSAGE;

  const renderBase = (l: OutreachLead): PreparedMessage => {
    const vars: LeadVars = {
      // anonimizado: o nome NUNCA entra na mensagem
      empresa: anonymize ? null : l.companyName,
      cidade: anonymize ? null : l.city,
      estado: anonymize ? null : l.state,
      segmento: l.segment,
      nome_contato: anonymize ? null : l.contactName,
      produto: args.productName,
      site: anonymize ? null : l.website,
    };
    let body = renderTemplate(base, vars).text;
    // se o template base do usuário tiver o nome literal, cai no padrão
    if (anonymize) {
      const safe = enforceNoName(body, l.companyName, renderTemplate(DEFAULT_BASE_MESSAGE, vars).text);
      body = safe.body;
    }
    return { leadId: l.leadId, body, by: "base" };
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
        // SEM o nome da empresa — de propósito
        `segmento / tipo de negócio: ${l.segment ?? "não identificado"}`,
        `produto compatível do catálogo: ${args.productName}`,
        `evidências reais: ${l.evidence.length ? l.evidence.join("; ") : "nenhuma além do segmento"}`,
      ].join("\n"),
    )
    .join("\n\n");

  const prompt = `## CATÁLOGO (únicos produtos/serviços que podem ser mencionados)
${args.catalogItems.join(", ") || args.productName}

## Produto foco da campanha
${args.productName}

## Mensagem base (referência de tom e estrutura — repare que NÃO cita nome)
${base}

## Negócios a abordar (SEM nome — não invente um)
${list}

## Tarefa
Para cada item, escreva a mensagem de WhatsApp. NUNCA cite o nome da empresa.
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
      // validação pós-geração: a IA NÃO pode ter citado o nome da empresa
      if (anonymize && mentionsCompanyName(ai, l.companyName)) {
        return { ...renderBase(l), nameLeakFixed: true };
      }
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
