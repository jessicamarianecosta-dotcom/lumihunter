import { createAdminClient } from "@/lib/supabase/admin";
import type { AiAgentKind, Json } from "@/lib/supabase/database.types";
import type { AiProviderId, AiUsage } from "./types";

interface LogArgs {
  companyId: string;
  agentKind: AiAgentKind;
  /** "anthropic" | "openai" | "demo" */
  provider: AiProviderId | "demo";
  model: string;
  leadId?: string | null;
  campaignId?: string | null;
  input: unknown;
  output: unknown;
  usage: AiUsage | null;
  durationMs: number;
  status?: string;
  error?: string | null;
  createdBy?: string | null;
}

/** Preço por 1M tokens (USD), para estimar custo — mesmos números exibidos nas configurações. */
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "gpt-5.6-sol": { input: 4, output: 20 },
  "gpt-5.6-terra": { input: 2, output: 12 },
  "gpt-5.6-luna": { input: 0.2, output: 1.2 },
};

function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = PRICING[model] ?? { input: 2, output: 10 };
  return (
    (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output
  );
}

/** Registra uma execução de agente de IA em ai_runs (custo, tokens, duração, provedor). */
export async function logAiRun(args: LogArgs): Promise<void> {
  const inputTokens = args.usage?.input_tokens ?? 0;
  const outputTokens = args.usage?.output_tokens ?? 0;
  const admin = createAdminClient();
  await admin.from("ai_runs").insert({
    company_id: args.companyId,
    agent_kind: args.agentKind,
    model: args.provider === "demo" ? "demo" : `${args.provider}:${args.model}`,
    lead_id: args.leadId ?? null,
    campaign_id: args.campaignId ?? null,
    input: args.input as Json,
    output: args.output as Json,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: estimateCostUsd(args.model, inputTokens, outputTokens),
    duration_ms: args.durationMs,
    status: args.status ?? "success",
    error: args.error ?? null,
    created_by: args.createdBy ?? null,
  });
}
