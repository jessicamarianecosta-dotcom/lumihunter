import { anthropic, MODELS, textOf, parseJsonFromText } from "../client";
import { ANALYST_SYSTEM } from "../prompts";
import { logAiRun } from "../log";
import { isDemoMode, demoAnalyst } from "../demo";

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
  const model = MODELS.analyst;

  if (isDemoMode()) {
    const insights = demoAnalyst(args.metrics);
    await logAiRun({
      companyId: args.companyId,
      agentKind: "analyst",
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
  try {
    const msg = await anthropic().messages.create({
      model,
      max_tokens: 2000,
      system: ANALYST_SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
    });
    usage = msg.usage;
    insights = parseJsonFromText<{ insights: Insight[] }>(textOf(msg)).insights ?? [];
  } finally {
    await logAiRun({
      companyId: args.companyId,
      agentKind: "analyst",
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
