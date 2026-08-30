import { anthropic, MODELS, textOf, parseJsonFromText } from "../client";
import { SALES_COACH_SYSTEM } from "../prompts";
import { logAiRun } from "../log";
import { isDemoMode } from "../demo";
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

export async function runSalesCoach(args: RunArgs): Promise<SalesCoachResult> {
  const started = Date.now();
  const model = MODELS.copywriter;

  if (isDemoMode()) {
    const r = demoCoach(args);
    await logAiRun({
      companyId: args.companyId,
      agentKind: "sales_coach",
      model: "demo",
      leadId: args.lead.id,
      input: { mode: "demo", msgs: args.messages.length },
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

## Conversa
${thread}

## Tarefa
JSON:
{
  "classification": "interested|not_now|not_interested|question|objection|complaint|other",
  "summary": "1-2 frases",
  "suggested_replies": ["2 a 3 respostas prontas, curtas"],
  "next_step": "o que fazer agora"
}`;

  let out = demoCoach(args);
  let usage = null;
  try {
    const msg = await anthropic().messages.create({
      model,
      max_tokens: 1500,
      system: SALES_COACH_SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
    });
    usage = msg.usage;
    out = parseJsonFromText<SalesCoachResult>(textOf(msg));
  } finally {
    await logAiRun({
      companyId: args.companyId,
      agentKind: "sales_coach",
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

function demoCoach(args: RunArgs): SalesCoachResult {
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
  return {
    classification,
    summary: `${args.lead.name} respondeu${last ? `: "${(last.body ?? "").slice(0, 80)}"` : " (sem mensagem do lead ainda)"}. (análise em modo demo)`,
    suggested_replies:
      classification === "not_interested"
        ? [
            "Sem problema! Se precisar no futuro, é só chamar. Posso te mandar o catálogo pra guardar?",
          ]
        : classification === "question"
          ? [
              `Boa pergunta! Depende da quantidade e do acabamento — me diz o que você precisa que eu já te passo um valor certinho.`,
              `Consigo te enviar uma tabela rápida agora. Qual a quantidade aproximada?`,
            ]
          : [
              `Que bom que fez sentido! Posso te mandar alguns exemplos e uma proposta hoje ainda?`,
              `Perfeito. Me passa a quantidade e a data que você precisa que eu monto o orçamento.`,
            ],
    next_step:
      classification === "not_interested"
        ? "Mover para 'Perdido' e manter na base para reativação futura."
        : classification === "question"
          ? "Responder com valores e mover para 'Interessado'."
          : "Enviar proposta e mover para 'Orçamento enviado'.",
  };
}
