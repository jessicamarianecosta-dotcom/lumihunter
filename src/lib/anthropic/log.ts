import { createAdminClient } from "@/lib/supabase/admin";
import { estimateCostUsd } from "./client";
import type { AiAgentKind } from "@/lib/supabase/database.types";
import type Anthropic from "@anthropic-ai/sdk";

interface LogArgs {
  companyId: string;
  agentKind: AiAgentKind;
  model: string;
  leadId?: string | null;
  campaignId?: string | null;
  input: unknown;
  output: unknown;
  usage: Anthropic.Usage | null;
  durationMs: number;
  status?: string;
  error?: string | null;
  createdBy?: string | null;
}

/** Registra uma execução de IA em ai_runs (custo, tokens, duração). */
export async function logAiRun(args: LogArgs): Promise<void> {
  const inputTokens = args.usage?.input_tokens ?? 0;
  const outputTokens = args.usage?.output_tokens ?? 0;
  const admin = createAdminClient();
  await admin.from("ai_runs").insert({
    company_id: args.companyId,
    agent_kind: args.agentKind,
    model: args.model,
    lead_id: args.leadId ?? null,
    campaign_id: args.campaignId ?? null,
    input: args.input,
    output: args.output,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: estimateCostUsd(args.model, inputTokens, outputTokens),
    duration_ms: args.durationMs,
    status: args.status ?? "success",
    error: args.error ?? null,
    created_by: args.createdBy ?? null,
  });
}
