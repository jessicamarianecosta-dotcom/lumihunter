/**
 * Tipos da camada de abstração de IA (multi-provedor).
 * Os agentes do LumiHunter dependem apenas destes tipos — nunca de um SDK
 * específico (Anthropic ou OpenAI) diretamente.
 */

export type AiProviderId = "anthropic" | "openai";

export interface AiUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface AiGenerateArgs {
  system: string;
  prompt: string;
  maxTokens: number;
}

export interface AiGenerateResult {
  text: string;
  usage: AiUsage;
}

export interface AiProvider {
  id: AiProviderId;
  generateText(
    apiKey: string,
    model: string,
    args: AiGenerateArgs,
  ): Promise<AiGenerateResult>;
}
