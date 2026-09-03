import OpenAI from "openai";
import type { AiProvider, AiGenerateArgs, AiGenerateResult } from "../types";

/** Implementação do provedor OpenAI para a camada de abstração de IA. */
export const openaiProvider: AiProvider = {
  id: "openai",
  async generateText(
    apiKey: string,
    model: string,
    args: AiGenerateArgs,
  ): Promise<AiGenerateResult> {
    const client = new OpenAI({ apiKey });
    let resp;
    try {
      resp = await client.chat.completions.create({
        model,
        max_completion_tokens: args.maxTokens,
        messages: [
          { role: "system", content: args.system },
          { role: "user", content: args.prompt },
        ],
      });
    } catch (e) {
      // Compatibilidade: alguns modelos/contas ainda esperam `max_tokens` em vez
      // de `max_completion_tokens`. Tenta uma vez com o parâmetro legado.
      if (e instanceof OpenAI.APIError && e.status === 400) {
        resp = await client.chat.completions.create({
          model,
          max_tokens: args.maxTokens,
          messages: [
            { role: "system", content: args.system },
            { role: "user", content: args.prompt },
          ],
        });
      } else {
        throw e;
      }
    }
    const text = resp.choices[0]?.message?.content ?? "";
    return {
      text,
      usage: {
        input_tokens: resp.usage?.prompt_tokens ?? 0,
        output_tokens: resp.usage?.completion_tokens ?? 0,
      },
    };
  },
};
