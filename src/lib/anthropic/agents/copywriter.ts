import { parseJsonFromText } from "../client";
import { COPYWRITER_SYSTEM } from "../prompts";
import { generateText, isAiDemoMode } from "@/lib/ai";
import { logAiRun } from "@/lib/ai/log";
import { demoCopywriter } from "../demo";
import type { Company, Lead, Product } from "@/lib/supabase/database.types";

export type CopyKind = "first_touch" | "followup" | "reply" | "quote";

export interface CopyOutput {
  whatsapp: string;
  email: { subject: string; preheader: string; body: string };
  instagram_dm: string;
  call_script: string;
  cta: string;
}

interface RunArgs {
  companyId: string;
  company: Pick<Company, "name" | "segment" | "description" | "commercial_whatsapp">;
  lead: Pick<Lead, "id" | "name" | "segment" | "city" | "state" | "instagram" | "website" | "description">;
  product: Pick<Product, "name" | "description" | "price_avg" | "applications"> | null;
  kind: CopyKind;
  context?: string;
  userId?: string | null;
}

const KIND_LABEL: Record<CopyKind, string> = {
  first_touch: "primeira abordagem (cold)",
  followup: "follow-up (sem resposta ainda)",
  reply: "resposta a uma mensagem do lead",
  quote: "envio de proposta/orçamento",
};

export async function runCopywriter(args: RunArgs): Promise<CopyOutput> {
  const started = Date.now();

  if (await isAiDemoMode(args.companyId)) {
    const out = demoCopywriter(args.company, args.lead, args.product, args.kind);
    await logAiRun({
      companyId: args.companyId,
      agentKind: "copywriter",
      provider: "demo",
      model: "demo",
      leadId: args.lead.id,
      input: { mode: "demo", kind: args.kind, lead: args.lead.name },
      output: { ok: true },
      usage: null,
      durationMs: Date.now() - started,
      createdBy: args.userId ?? null,
    });
    return out;
  }

  const userPrompt = `## Empresa usuária (quem envia)
${args.company.name} — ${args.company.segment ?? ""}
${args.company.description ?? ""}

## Produto em foco
${
  args.product
    ? `${args.product.name}: ${args.product.description ?? ""}. Aplicações: ${args.product.applications.join(", ")}. Ticket médio aprox.: ${args.product.price_avg ?? "sob consulta"}`
    : "Nenhum produto específico — abordagem institucional."
}

## Lead (destinatário)
${args.lead.name} — ${args.lead.segment ?? ""} — ${args.lead.city ?? ""}/${args.lead.state ?? ""}
Instagram: ${args.lead.instagram ?? "—"} | Site: ${args.lead.website ?? "—"}
Contexto: ${args.lead.description ?? "—"}

## Tipo de mensagem
${KIND_LABEL[args.kind]}
${args.context ? `\n## Contexto adicional\n${args.context}` : ""}

## Tarefa
Gere variações do MESMO approach para cada canal, curtas e específicas. JSON:
{
  "whatsapp": "até 3 linhas, tom de conversa, 1 pergunta ao final",
  "email": { "subject": "curto", "preheader": "curto", "body": "3-5 linhas" },
  "instagram_dm": "2 linhas",
  "call_script": "roteiro de 20s para ligação",
  "cta": "chamada para ação única"
}`;

  let out: CopyOutput = {
    whatsapp: "",
    email: { subject: "", preheader: "", body: "" },
    instagram_dm: "",
    call_script: "",
    cta: "",
  };
  let usage = null;
  let provider: "anthropic" | "openai" = "anthropic";
  let model = "unknown";
  try {
    const res = await generateText({
      companyId: args.companyId,
      system: COPYWRITER_SYSTEM,
      prompt: userPrompt,
      maxTokens: 2000,
    });
    usage = res.usage;
    provider = res.provider;
    model = res.model;
    out = parseJsonFromText<CopyOutput>(res.text);
  } finally {
    await logAiRun({
      companyId: args.companyId,
      agentKind: "copywriter",
      provider,
      model,
      leadId: args.lead.id,
      input: { kind: args.kind, lead: args.lead.name },
      output: { ok: true },
      usage,
      durationMs: Date.now() - started,
      createdBy: args.userId ?? null,
    });
  }
  return out;
}
