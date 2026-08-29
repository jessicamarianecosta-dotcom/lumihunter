import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY ausente");
    }
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

/** Preço por 1M tokens (USD) — usado para estimar custo dos agentes. */
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = PRICING[model] ?? PRICING["claude-sonnet-5"];
  return (
    (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output
  );
}

export const MODELS = {
  hunter: process.env.ANTHROPIC_MODEL_HUNTER || "claude-sonnet-5",
  copywriter: process.env.ANTHROPIC_MODEL_COPYWRITER || "claude-sonnet-5",
  analyst: process.env.ANTHROPIC_MODEL_ANALYST || "claude-sonnet-5",
  qualifier: process.env.ANTHROPIC_MODEL_HUNTER || "claude-sonnet-5",
} as const;

/** Extrai o primeiro bloco de texto de uma resposta Messages. */
export function textOf(msg: Anthropic.Message): string {
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/** Extrai e faz parse de um JSON contido no texto (tolerante a cercas ```). */
export function parseJsonFromText<T>(text: string): T {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = cleaned.search(/[[{]/);
  const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  const slice = start >= 0 && end >= 0 ? cleaned.slice(start, end + 1) : cleaned;
  return JSON.parse(slice) as T;
}
