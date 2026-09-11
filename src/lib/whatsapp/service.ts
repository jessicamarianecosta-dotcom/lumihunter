import { createAdminClient } from "@/lib/supabase/admin";
import { metaCloudApiProvider } from "./providers/meta-cloud-api";
import { ycloudProvider } from "./providers/ycloud";
import type {
  ParsedWebhook,
  SendDocumentArgs,
  SendImageArgs,
  SendMessageResult,
  SendTemplateArgs,
  SendTextMessageArgs,
  WebhookSignatureResult,
  WhatsAppProvider,
  WhatsAppProviderConfig,
  WhatsAppProviderId,
} from "./types";

const PROVIDERS: Record<WhatsAppProviderId, WhatsAppProvider> = {
  meta: metaCloudApiProvider,
  ycloud: ycloudProvider,
};

/**
 * Formato armazenado em `integrations.config` (provider="whatsapp"):
 * os campos "flat" (access_token, phone_number_id, ...) são a config do
 * provider "meta" — preservados exatamente como já existiam, para não
 * quebrar a tela de Configurações atual. `ycloud` é um objeto irmão com a
 * config do YCloud. `active_provider` decide qual dos dois está em uso.
 */
interface StoredWhatsAppConfig {
  active_provider?: WhatsAppProviderId;
  access_token?: string;
  phone_number_id?: string;
  business_account_id?: string;
  api_version?: string;
  ycloud?: { api_key?: string; webhook_secret?: string };
}

async function getStoredConfig(companyId: string): Promise<StoredWhatsAppConfig> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("integrations")
    .select("config")
    .eq("company_id", companyId)
    .eq("provider", "whatsapp")
    .maybeSingle();
  return (data?.config ?? {}) as StoredWhatsAppConfig;
}

function configFor(
  providerId: WhatsAppProviderId,
  stored: StoredWhatsAppConfig,
): WhatsAppProviderConfig {
  if (providerId === "ycloud") {
    return {
      api_key: stored.ycloud?.api_key,
      webhook_secret: stored.ycloud?.webhook_secret,
    };
  }
  return {
    access_token: stored.access_token,
    phone_number_id: stored.phone_number_id,
    business_account_id: stored.business_account_id,
    api_version: stored.api_version,
  };
}

export interface ResolvedWhatsApp {
  providerId: WhatsAppProviderId;
  provider: WhatsAppProvider;
  config: WhatsAppProviderConfig;
}

/** Resolve o provider ativo (banco > variável de ambiente > "meta") e sua config. */
export async function resolveActiveWhatsApp(companyId: string): Promise<ResolvedWhatsApp> {
  const stored = await getStoredConfig(companyId);
  const providerId: WhatsAppProviderId =
    stored.active_provider ??
    (process.env.WHATSAPP_PROVIDER as WhatsAppProviderId | undefined) ??
    "meta";
  return {
    providerId,
    provider: PROVIDERS[providerId],
    config: configFor(providerId, stored),
  };
}

/** Ponto único usado pelo restante do LumiHunter para enviar WhatsApp. */
export async function sendMessage(
  companyId: string,
  args: SendTextMessageArgs,
): Promise<SendMessageResult & { providerId: WhatsAppProviderId }> {
  const { providerId, provider, config } = await resolveActiveWhatsApp(companyId);
  const result = await provider.sendTextMessage(config, args);
  return { ...result, providerId };
}

/** Envia mensagem de template aprovado (abordagem fria fora da janela de 24h). */
export async function sendTemplate(
  companyId: string,
  args: SendTemplateArgs,
): Promise<SendMessageResult & { providerId: WhatsAppProviderId }> {
  const { providerId, provider, config } = await resolveActiveWhatsApp(companyId);
  if (!provider.sendTemplate) {
    return {
      ok: false,
      error: `O provedor "${providerId}" não suporta envio de template.`,
      providerId,
    };
  }
  const result = await provider.sendTemplate(config, args);
  return { ...result, providerId };
}

/** Envia um documento (catálogo PDF). Retorna simulated se o provider não suporta. */
export async function sendDocument(
  companyId: string,
  args: SendDocumentArgs,
): Promise<SendMessageResult & { providerId: WhatsAppProviderId }> {
  const { providerId, provider, config } = await resolveActiveWhatsApp(companyId);
  if (!provider.sendDocument) {
    return {
      ok: false,
      error: `O provedor "${providerId}" não suporta envio de documento.`,
      providerId,
    };
  }
  const result = await provider.sendDocument(config, args);
  return { ...result, providerId };
}

/** Envia uma imagem (jpeg/png). Retorna erro se o provider não suporta. */
export async function sendImage(
  companyId: string,
  args: SendImageArgs,
): Promise<SendMessageResult & { providerId: WhatsAppProviderId }> {
  const { providerId, provider, config } = await resolveActiveWhatsApp(companyId);
  if (!provider.sendImage) {
    return {
      ok: false,
      error: `O provedor "${providerId}" não suporta envio de imagem.`,
      providerId,
    };
  }
  const result = await provider.sendImage(config, args);
  return { ...result, providerId };
}

/** Usado pelo botão "Testar conexão" em Configurações. */
export async function healthCheck(
  companyId: string,
): Promise<{ ok: boolean; message?: string; error?: string; providerId: WhatsAppProviderId }> {
  const { providerId, provider, config } = await resolveActiveWhatsApp(companyId);
  const result = await provider.healthCheck(config);
  return { ...result, providerId };
}

/**
 * Usadas pelas rotas de webhook — uma rota por provider (ex:
 * /api/whatsapp/webhook para Meta, /api/webhooks/whatsapp/ycloud para
 * YCloud). Não recebem `companyId`: assim como hoje, o webhook chega sem
 * contexto de empresa (a Meta/YCloud chamam um único endpoint compartilhado)
 * — a rota resolve a empresa a partir do conteúdo do payload (ex: pelo
 * phone_number_id), exatamente como o webhook da Meta já faz.
 */
export function validateWebhookHandshake(
  providerId: WhatsAppProviderId,
  params: URLSearchParams,
): string | null {
  return PROVIDERS[providerId].validateWebhook({}, params);
}

export function parseIncomingWebhook(
  providerId: WhatsAppProviderId,
  payload: unknown,
): ParsedWebhook {
  return PROVIDERS[providerId].parseWebhook({}, payload);
}

/**
 * Verifica a assinatura de uma chamada POST de webhook. A rota deve chamar
 * isto ANTES de fazer parse ou processar qualquer evento.
 */
export function verifyIncomingWebhookSignature(
  providerId: WhatsAppProviderId,
  rawBody: string,
  headers: Headers,
): WebhookSignatureResult {
  return PROVIDERS[providerId].verifyWebhookSignature(rawBody, headers);
}

export type { WhatsAppProviderId } from "./types";
