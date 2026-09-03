import { anthropicProvider } from "./providers/anthropic-provider";
import { openaiProvider } from "./providers/openai-provider";
import { resolveActiveAi } from "./settings";
import type { AiGenerateArgs, AiProvider, AiProviderId } from "./types";

const PROVIDERS: Record<AiProviderId, AiProvider> = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
};

export interface GenerateTextArgs extends AiGenerateArgs {
  companyId: string;
}

export interface GenerateTextResult {
  text: string;
  usage: { input_tokens: number; output_tokens: number };
  provider: AiProviderId;
  model: string;
}

/**
 * Ponto único de entrada usado por todos os agentes do LumiHunter para gerar
 * texto com IA. Resolve o provedor ativo da empresa (OpenAI ou Anthropic) e
 * delega para a implementação correspondente — o agente nunca sabe qual SDK
 * foi usado.
 */
export async function generateText(
  args: GenerateTextArgs,
): Promise<GenerateTextResult> {
  const { provider, model, apiKey } = await resolveActiveAi(args.companyId);
  if (!apiKey) {
    throw new Error(
      provider === "openai"
        ? "OpenAI não configurada. Adicione uma chave da API OpenAI nas configurações."
        : "Anthropic não configurada. Adicione uma chave da API Anthropic nas configurações.",
    );
  }

  const impl = PROVIDERS[provider];
  try {
    const res = await impl.generateText(apiKey, model, {
      system: args.system,
      prompt: args.prompt,
      maxTokens: args.maxTokens,
    });
    return { ...res, provider, model };
  } catch (e) {
    console.error(`[ai] erro ao consultar ${provider}:${model}`, e);
    throw new Error(
      "Falha ao consultar o provedor de IA. Verifique a chave e tente novamente.",
    );
  }
}

export { resolveActiveAi, isAiDemoMode } from "./settings";
export type { AiProviderId } from "./types";
