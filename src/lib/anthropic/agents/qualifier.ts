import { anthropic, MODELS, textOf, parseJsonFromText } from "../client";
import { QUALIFIER_SYSTEM } from "../prompts";
import { logAiRun } from "../log";
import { isDemoMode, demoQualifier } from "../demo";
import type { IcpProfile, Lead, Product } from "@/lib/supabase/database.types";

export interface QualifierResult {
  score: number;
  reason: string;
  factors: { label: string; weight: number; present: boolean }[];
  summary: string;
  recommended_product_names: string[];
}

interface RunArgs {
  companyId: string;
  lead: Pick<
    Lead,
    | "id"
    | "name"
    | "segment"
    | "city"
    | "state"
    | "description"
    | "website"
    | "instagram"
    | "whatsapp"
    | "email"
    | "products_sold"
    | "google_rating"
  >;
  icp: IcpProfile | null;
  products: Product[];
  userId?: string | null;
}

export async function runQualifier(args: RunArgs): Promise<QualifierResult> {
  const started = Date.now();
  const model = MODELS.qualifier;

  if (isDemoMode()) {
    const result = demoQualifier(args.lead, args.icp, args.products);
    await logAiRun({
      companyId: args.companyId,
      agentKind: "qualifier",
      model: "demo",
      leadId: args.lead.id,
      input: { mode: "demo", lead: args.lead.name },
      output: { score: result.score },
      usage: null,
      durationMs: Date.now() - started,
      createdBy: args.userId ?? null,
    });
    return result;
  }

  const catalog = args.products
    .filter((p) => p.is_active)
    .map((p) => `- ${p.name}: ${p.description ?? ""}`)
    .join("\n");

  const icpText = args.icp
    ? `Segmentos: ${args.icp.segments.join(", ")}; Cidades: ${args.icp.cities.join(", ")}; Estados: ${args.icp.states.join(", ")}; Palavras-chave: ${args.icp.keywords.join(", ")}`
    : "Não definido";

  const userPrompt = `## Lead
Nome: ${args.lead.name}
Segmento: ${args.lead.segment ?? "—"}
Cidade/UF: ${args.lead.city ?? "—"} / ${args.lead.state ?? "—"}
Descrição: ${args.lead.description ?? "—"}
Site: ${args.lead.website ?? "—"}
Instagram: ${args.lead.instagram ?? "—"}
WhatsApp: ${args.lead.whatsapp ?? "—"}
E-mail: ${args.lead.email ?? "—"}
Avaliação Google: ${args.lead.google_rating ?? "—"}
Produtos que vende: ${args.lead.products_sold.join(", ") || "—"}

## ICP
${icpText}

## Catálogo da empresa usuária
${catalog}

## Tarefa
Atribua um lead score (0-100) e explique. JSON:
{
  "score": 0,
  "reason": "1-2 frases",
  "factors": [{ "label": "string", "weight": 0, "present": true }],
  "summary": "resumo de 2-3 frases sobre a oportunidade",
  "recommended_product_names": ["nomes exatos do catálogo"]
}`;

  let result: QualifierResult = {
    score: 0,
    reason: "",
    factors: [],
    summary: "",
    recommended_product_names: [],
  };
  let usage = null;
  try {
    const msg = await anthropic().messages.create({
      model,
      max_tokens: 2000,
      system: QUALIFIER_SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
    });
    usage = msg.usage;
    result = parseJsonFromText<QualifierResult>(textOf(msg));
    result.score = Math.max(0, Math.min(100, Math.round(result.score)));
  } finally {
    await logAiRun({
      companyId: args.companyId,
      agentKind: "qualifier",
      model,
      leadId: args.lead.id,
      input: { lead: args.lead.name },
      output: { score: result.score },
      usage,
      durationMs: Date.now() - started,
      createdBy: args.userId ?? null,
    });
  }
  return result;
}
