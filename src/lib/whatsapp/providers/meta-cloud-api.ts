/**
 * Provider Meta (WhatsApp Cloud API oficial da Meta).
 *
 * Reaproveita a implementação já existente e verificada em
 * src/lib/integrations/whatsapp.ts — este arquivo é só um adaptador para o
 * contrato `WhatsAppProvider`, não reimplementa a lógica de chamada à Meta.
 */
import {
  sendWhatsAppText,
  verifyWebhook,
  parseInbound,
  parseStatuses,
} from "@/lib/integrations/whatsapp";
import type {
  ParsedWebhook,
  SendMessageResult,
  SendTextMessageArgs,
  WhatsAppProvider,
  WhatsAppProviderConfig,
} from "../types";

export const metaCloudApiProvider: WhatsAppProvider = {
  id: "meta",

  async sendTextMessage(
    config: WhatsAppProviderConfig,
    args: SendTextMessageArgs,
  ): Promise<SendMessageResult> {
    return sendWhatsAppText({
      to: args.to,
      body: args.body,
      phoneNumberId: config.phone_number_id,
      accessToken: config.access_token,
    });
  },

  validateWebhook(_config: WhatsAppProviderConfig, params: URLSearchParams): string | null {
    return verifyWebhook(params);
  },

  parseWebhook(_config: WhatsAppProviderConfig, payload: unknown): ParsedWebhook {
    return {
      messages: parseInbound(payload).map((m) => ({
        from: m.from,
        providerMessageId: m.waMessageId,
        text: m.text,
        timestamp: m.timestamp,
        channelIdentifier: m.phoneNumberId,
      })),
      statuses: parseStatuses(payload).map((s) => ({
        providerMessageId: s.waMessageId,
        status: s.status,
        timestamp: s.timestamp,
      })),
    };
  },

  async healthCheck(config: WhatsAppProviderConfig) {
    const phoneNumberId = config.phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID;
    const token = config.access_token || process.env.WHATSAPP_ACCESS_TOKEN;
    const apiVersion = config.api_version || process.env.WHATSAPP_API_VERSION || "v21.0";
    if (!phoneNumberId || !token) {
      return {
        ok: false,
        error:
          "Meta Cloud API não configurada. Adicione o Phone Number ID e o Access Token.",
      };
    }
    try {
      const res = await fetch(
        `https://graph.facebook.com/${apiVersion}/${phoneNumberId}?fields=verified_name,display_phone_number`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = (await res.json()) as {
        verified_name?: string;
        display_phone_number?: string;
        error?: { message?: string };
      };
      if (!res.ok || data.error) {
        return { ok: false, error: data.error?.message || `Meta respondeu HTTP ${res.status}` };
      }
      return {
        ok: true,
        message: `número ${data.display_phone_number ?? phoneNumberId} (${data.verified_name ?? "verificado"})`,
      };
    } catch {
      return { ok: false, error: "Falha ao consultar a Meta Graph API." };
    }
  },
};
