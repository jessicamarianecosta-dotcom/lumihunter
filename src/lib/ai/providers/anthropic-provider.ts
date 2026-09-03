import Anthropic from "@anthropic-ai/sdk";
import type { AiProvider, AiGenerateArgs, AiGenerateResult } from "../types";

/**
 * Implementação do provedor Anthropic para a camada de abstração de IA.
 * Cria um cliente próprio a partir da chave resolvida (banco de dados da
 * empresa ou variável de ambiente) — não depende do singleton em
 * src/lib/anthropic/client.ts, que continua existindo e funcionando como antes.
 */
export const anthropicProvider: AiProvider = {
  id: "anthropic",
  async generateText(
    apiKey: string,
    model: string,
    args: AiGenerateArgs,
  ): Promise<AiGenerateResult> {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model,
      max_tokens: args.maxTokens,
      system: args.system,
      messages: [{ role: "user", content: args.prompt }],
    });
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return {
      text,
      usage: {
        input_tokens: msg.usage.input_tokens,
        output_tokens: msg.usage.output_tokens,
      },
    };
  },
};
