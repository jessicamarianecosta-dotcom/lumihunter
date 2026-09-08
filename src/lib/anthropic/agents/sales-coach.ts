import { parseJsonFromText } from "../client";
import { SALES_COACH_SYSTEM } from "../prompts";
import { generateText, isAiDemoMode } from "@/lib/ai";
import { logAiRun } from "@/lib/ai/log";
import {
  ANTI_INVENTION_RULE,
  buildCommercialContext,
  type SearchOutcome,
} from "@/lib/catalog";
import type { Company, Lead } from "@/lib/supabase/database.types";

export interface SalesCoachResult {
  classification:
    | "interested"
    | "not_now"
    | "not_interested"
    | "question"
    | "objection"
    | "complaint"
    | "other";
  summary: string;
  suggested_replies: string[];
  next_step: string;
  /** Como a Base Comercial respondeu à última mensagem do lead (quando aplicável). */
  catalog_outcome?: SearchOutcome["kind"];
}

interface RunArgs {
  companyId: string;
  company: Pick<Company, "name" | "segment">;
  lead: Pick<Lead, "id" | "name" | "segment" | "city">;
  messages: { direction: "inbound" | "outbound"; body: string | null }[];
  knowledge: { title: string; content: string }[];
  userId?: string | null;
}

const LABELS: Record<SalesCoachResult["classification"], string> = {
  interested: "Interessado",
  not_now: "Agora não",
  not_interested: "Não tem interesse",
  question: "Fez uma pergunta",
  objection: "Objeção",
  complaint: "Reclamação",
  other: "Outro",
};
export const CLASSIFICATION_LABELS = LABELS;

/** Última mensagem recebida do lead (base para a consulta comercial). */
function lastInbound(args: RunArgs): string | null {
  const m = [...args.messages].reverse().find((x) => x.direction === "inbound");
  return m?.body?.trim() || null;
}

/** Palavras que indicam pergunta comercial (produto/preço/especificação). */
const COMMERCIAL_HINT =
  /\b(quanto|valor|pre[çc]o|or[çc]amento|fazem?|faz|tem\b|t[eê]m\b|cust|produt|servi[çc]o|material|gramatura|acabamento|tamanho|medida|quantidade|un\b|unidades|couch|adesivo|cart[ãa]o|banner|caneca|panfleto|folder|etiqueta|tag|camiseta|copo|caderno|bloco)\b/i;

export async function runSalesCoach(args: RunArgs): Promise<SalesCoachResult> {
  const started = Date.now();

  // ── Base Comercial: consulta ANTES de responder, quando a última mensagem
  //    do lead é sobre produto/preço/especificação. Filtrada por companyId.
  const inbound = lastInbound(args);
  let commercialContext = "";
  let catalogOutcome: SearchOutcome["kind"] | undefined;
  if (inbound && COMMERCIAL_HINT.test(inbound)) {
    try {
      const { contextText, outcome } = await buildCommercialContext({
        companyId: args.companyId,
        message: inbound,
      });
      commercialContext = contextText;
      catalogOutcome = outcome.kind;
    } catch {
      // base comercial indisponível (ex.: migration não aplicada) — segue sem ela
    }
  }

  if (await isAiDemoMode(args.companyId)) {
    const r = demoCoach(args, catalogOutcome);
    await logAiRun({
      companyId: args.companyId,
      agentKind: "sales_coach",
      provider: "demo",
      model: "demo",
      leadId: args.lead.id,
      input: { mode: "demo", msgs: args.messages.length, catalog: catalogOutcome ?? null },
      output: { classification: r.classification },
      usage: null,
      durationMs: Date.now() - started,
      createdBy: args.userId ?? null,
    });
    return r;
  }

  const thread = args.messages
    .map((m) => `${m.direction === "inbound" ? "LEAD" : "NÓS"}: ${m.body ?? ""}`)
    .join("\n");

  const kb = args.knowledge.length
    ? args.knowledge.map((k) => `- ${k.title}: ${k.content}`).join("\n")
    : "vazia";

  const userPrompt = `## Empresa
${args.company.name} — ${args.company.segment ?? ""}

## Lead
${args.lead.name} — ${args.lead.segment ?? ""} — ${args.lead.city ?? ""}

## Base de conhecimento
${kb}
${commercialContext ? `\n${commercialContext}\n` : ""}
## Conversa
${thread}

## Tarefa
As "suggested_replies" devem respeitar a BASE COMERCIAL acima: só cite produto,
preço ou especificação que apareça lá. JSON:
{
  "classification": "interested|not_now|not_interested|question|objection|complaint|other",
  "summary": "1-2 frases",
  "suggested_replies": ["2 a 3 respostas prontas, curtas"],
  "next_step": "o que fazer agora"
}`;

  let out = demoCoach(args, catalogOutcome);
  let usage = null;
  let provider: "anthropic" | "openai" = "anthropic";
  let model = "unknown";
  try {
    const res = await generateText({
      companyId: args.companyId,
      system: commercialContext
        ? `${SALES_COACH_SYSTEM}\n\n${ANTI_INVENTION_RULE}`
        : SALES_COACH_SYSTEM,
      prompt: userPrompt,
      maxTokens: 1500,
    });
    usage = res.usage;
    provider = res.provider;
    model = res.model;
    out = parseJsonFromText<SalesCoachResult>(res.text);
    out.catalog_outcome = catalogOutcome;
  } finally {
    await logAiRun({
      companyId: args.companyId,
      agentKind: "sales_coach",
      provider,
      model,
      leadId: args.lead.id,
      input: { msgs: args.messages.length },
      output: { classification: out.classification },
      usage,
      durationMs: Date.now() - started,
      createdBy: args.userId ?? null,
    });
  }
  return out;
}

function demoCoach(
  args: RunArgs,
  catalogOutcome?: SearchOutcome["kind"],
): SalesCoachResult {
  const last = [...args.messages].reverse().find((m) => m.direction === "inbound");
  const txt = (last?.body ?? "").toLowerCase();
  const isQuestion = txt.includes("?") || txt.includes("quanto") || txt.includes("valor");
  const negative = txt.includes("não") || txt.includes("sem interesse");
  const classification: SalesCoachResult["classification"] = negative
    ? "not_interested"
    : isQuestion
      ? "question"
      : txt
        ? "interested"
        : "other";

  // Quando a Base Comercial já respondeu, o modo demo respeita a regra
  // anti-invenção nas sugestões.
  const catalogAware: string[] | null =
    catalogOutcome === "NOT_FOUND"
      ? [
          "Deixa eu verificar essa opção pra você e já te retorno com os detalhes. 😊",
          "Não tenho essa configuração no catálogo agora — vou confirmar com o time e te aviso.",
        ]
      : catalogOutcome === "PARTIAL"
        ? [
            "Consigo te passar o valor certinho — só me confirma a quantidade e o acabamento, por favor.",
            "Pra fechar a opção ideal, me diz a quantidade que você precisa?",
          ]
        : catalogOutcome === "AMBIGUOUS"
          ? [
              "Temos algumas opções pra isso — quer que eu te mostre as disponíveis com os valores?",
            ]
          : catalogOutcome === "SOURCE_UNAVAILABLE"
            ? [
                "Não consegui consultar essa informação agora. Posso encaminhar para o atendimento verificar o valor?",
              ]
            : null;

  return {
    classification,
    catalog_outcome: catalogOutcome,
    summary: `${args.lead.name} respondeu${last ? `: "${(last.body ?? "").slice(0, 80)}"` : " (sem mensagem do lead ainda)"}. ${catalogOutcome ? `Base comercial: ${catalogOutcome}. ` : ""}(análise em modo demo)`,
    suggested_replies:
      catalogAware ??
      (classification === "not_interested"
        ? [
            "Sem problema! Se precisar no futuro, é só chamar. Posso te mandar o catálogo pra guardar?",
          ]
        : classification === "question"
          ? [
              `Boa pergunta! Me diz a quantidade e o acabamento que você precisa que eu confirmo o valor no catálogo.`,
              `Consigo verificar agora. Qual a quantidade aproximada?`,
            ]
          : [
              `Que bom que fez sentido! Posso te mandar alguns exemplos e uma proposta hoje ainda?`,
              `Perfeito. Me passa a quantidade e a data que você precisa que eu monto o orçamento.`,
            ]),
    next_step:
      catalogOutcome === "NOT_FOUND" || catalogOutcome === "SOURCE_UNAVAILABLE"
        ? "Confirmar a informação antes de responder valor ao cliente."
        : classification === "not_interested"
          ? "Mover para 'Perdido' e manter na base para reativação futura."
          : classification === "question"
            ? "Responder com valores do catálogo e mover para 'Interessado'."
            : "Enviar proposta e mover para 'Orçamento enviado'.",
  };
}
