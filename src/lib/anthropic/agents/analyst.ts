import { parseJsonFromText } from "../client";
import { ANALYST_SYSTEM } from "../prompts";
import { generateText, isAiDemoMode } from "@/lib/ai";
import { logAiRun } from "@/lib/ai/log";
import { demoAnalyst } from "../demo";

export interface Insight {
  title: string;
  observation: string;
  recommendation: string;
  priority: "alta" | "média" | "baixa";
}

interface RunArgs {
  companyId: string;
  metrics: Record<string, unknown>;
  userId?: string | null;
}

export async function runAnalyst(args: RunArgs): Promise<Insight[]> {
  const started = Date.now();

  if (await isAiDemoMode(args.companyId)) {
    const insights = demoAnalyst(args.metrics);
    await logAiRun({
      companyId: args.companyId,
      agentKind: "analyst",
      provider: "demo",
      model: "demo",
      input: { mode: "demo" },
      output: { count: insights.length },
      usage: null,
      durationMs: Date.now() - started,
      createdBy: args.userId ?? null,
    });
    return insights;
  }

  const userPrompt = `## Métricas do período
${JSON.stringify(args.metrics, null, 2)}

## Tarefa
Gere de 3 a 6 insights acionáveis. JSON:
{ "insights": [ { "title": "", "observation": "", "recommendation": "", "priority": "alta|média|baixa" } ] }`;

  let insights: Insight[] = [];
  let usage = null;
  let provider: "anthropic" | "openai" = "anthropic";
  let model = "unknown";
  try {
    const res = await generateText({
      companyId: args.companyId,
      system: ANALYST_SYSTEM,
      prompt: userPrompt,
      maxTokens: 2000,
    });
    usage = res.usage;
    provider = res.provider;
    model = res.model;
    insights = parseJsonFromText<{ insights: Insight[] }>(res.text).insights ?? [];
  } finally {
    await logAiRun({
      companyId: args.companyId,
      agentKind: "analyst",
      provider,
      model,
      input: { keys: Object.keys(args.metrics) },
      output: { count: insights.length },
      usage,
      durationMs: Date.now() - started,
      createdBy: args.userId ?? null,
    });
  }
  return insights;
}
