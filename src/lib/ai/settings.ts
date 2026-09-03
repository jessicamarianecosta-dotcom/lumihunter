import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import type { AiProviderId } from "./types";

export type { AiProviderId } from "./types";

export interface AiProviderConfig {
  api_key?: string;
  model?: string;
}

export interface AiIntegrationConfig {
  active_provider?: AiProviderId;
  anthropic?: AiProviderConfig;
  openai?: AiProviderConfig;
}

/** Modelo padrão por provedor quando a empresa ainda não configurou um. */
const DEFAULT_MODEL: Record<AiProviderId, string> = {
  anthropic: "claude-haiku-4-5",
  openai: "gpt-5.6-luna",
};

export interface ResolvedAi {
  provider: AiProviderId;
  model: string;
  apiKey: string | null;
}

/** Lê a configuração de IA da empresa (reaproveita a tabela `integrations`, provider="ai"). */
export async function getAiIntegrationConfig(
  companyId: string,
): Promise<{ connected: boolean; config: AiIntegrationConfig } | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("integrations")
    .select("is_connected, config")
    .eq("company_id", companyId)
    .eq("provider", "ai")
    .maybeSingle();
  if (!data) return null;
  return {
    connected: data.is_connected,
    config: (data.config ?? {}) as AiIntegrationConfig,
  };
}

/**
 * Resolve o provedor ativo, modelo e chave de API para uma empresa.
 * Prioridade: configuração salva no banco > variável de ambiente > padrão.
 */
export async function resolveActiveAi(companyId: string): Promise<ResolvedAi> {
  const stored = (await getAiIntegrationConfig(companyId))?.config ?? {};
  const provider: AiProviderId =
    stored.active_provider ??
    (process.env.ANTHROPIC_API_KEY
      ? "anthropic"
      : process.env.OPENAI_API_KEY
        ? "openai"
        : "anthropic");

  const providerCfg = stored[provider] ?? {};
  const apiKey =
    providerCfg.api_key ||
    (provider === "anthropic"
      ? process.env.ANTHROPIC_API_KEY
      : process.env.OPENAI_API_KEY) ||
    null;
  const model =
    providerCfg.model ||
    (provider === "anthropic"
      ? process.env.ANTHROPIC_MODEL
      : process.env.OPENAI_MODEL) ||
    DEFAULT_MODEL[provider];

  return { provider, model, apiKey };
}

/** true quando não há chave utilizável para o provedor ativo (agentes rodam em modo demo). */
export async function isAiDemoMode(companyId: string): Promise<boolean> {
  if (process.env.AI_DEMO_MODE === "true") return true;
  const { apiKey } = await resolveActiveAi(companyId);
  return !apiKey;
}

/** Define o provedor ativo e, opcionalmente, o modelo de cada provedor (não mexe nas chaves). */
export async function saveActiveAiProvider(
  companyId: string,
  activeProvider: AiProviderId,
  models: { anthropic?: string; openai?: string },
): Promise<void> {
  const admin = createAdminClient();
  const current = (await getAiIntegrationConfig(companyId))?.config ?? {};
  const next: AiIntegrationConfig = {
    ...current,
    active_provider: activeProvider,
    anthropic: {
      ...current.anthropic,
      ...(models.anthropic ? { model: models.anthropic } : {}),
    },
    openai: {
      ...current.openai,
      ...(models.openai ? { model: models.openai } : {}),
    },
  };
  const hasAnyKey = !!(next.anthropic?.api_key || next.openai?.api_key);
  await admin.from("integrations").upsert(
    {
      company_id: companyId,
      provider: "ai",
      config: next as unknown as Json,
      is_connected: hasAnyKey,
    },
    { onConflict: "company_id,provider" },
  );
}

/** Salva/atualiza a chave e/ou modelo de um provedor específico, sem apagar o outro. */
export async function saveAiProviderKey(
  companyId: string,
  provider: AiProviderId,
  apiKey: string | null,
  model: string | undefined,
  connectedBy: string | null,
): Promise<void> {
  const admin = createAdminClient();
  const current = (await getAiIntegrationConfig(companyId))?.config ?? {};
  const providerCfg: AiProviderConfig = { ...current[provider] };
  if (apiKey) providerCfg.api_key = apiKey;
  if (model) providerCfg.model = model;
  const next: AiIntegrationConfig = { ...current, [provider]: providerCfg };
  const hasAnyKey = !!(next.anthropic?.api_key || next.openai?.api_key);
  await admin.from("integrations").upsert(
    {
      company_id: companyId,
      provider: "ai",
      config: next as unknown as Json,
      is_connected: hasAnyKey,
      connected_by: connectedBy,
      connected_at: hasAnyKey ? new Date().toISOString() : null,
    },
    { onConflict: "company_id,provider" },
  );
}

/** Mascara uma chave de API para exibição segura (nunca mostra o valor completo). */
export function maskApiKey(key?: string | null): string | null {
  if (!key) return null;
  if (key.length <= 8) return "••••••••";
  return `${key.slice(0, 3)}${"•".repeat(Math.max(4, key.length - 7))}${key.slice(-4)}`;
}
