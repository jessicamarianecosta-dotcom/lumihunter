/**
 * WhatsApp Cloud API (oficial da Meta). Somente API oficial — nunca WhatsApp Web.
 * Habilite com WHATSAPP_ENABLED=true e preencha as credenciais no .env
 * (ou em integrations.config por empresa, em produção).
 */

const API_VERSION = process.env.WHATSAPP_API_VERSION || "v21.0";
const ENABLED = process.env.WHATSAPP_ENABLED === "true";

export interface WhatsAppSendResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
  simulated?: boolean;
}

interface SendTextArgs {
  to: string; // E.164 sem "+", ex: 5511999999999
  body: string;
  phoneNumberId?: string;
  accessToken?: string;
}

export async function sendWhatsAppText(
  args: SendTextArgs,
): Promise<WhatsAppSendResult> {
  const phoneNumberId = args.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = args.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
  const to = args.to.replace(/\D/g, "");

  if (!ENABLED || !phoneNumberId || !token) {
    // Modo simulação: não envia, apenas retorna sucesso sintético.
    return {
      ok: true,
      simulated: true,
      providerMessageId: `sim_wa_${Date.now()}`,
    };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "text",
          text: { preview_url: true, body: args.body },
        }),
      },
    );
    const data = (await res.json()) as {
      messages?: { id: string }[];
      error?: { message: string };
    };
    if (!res.ok || data.error) {
      return { ok: false, error: data.error?.message || `HTTP ${res.status}` };
    }
    return { ok: true, providerMessageId: data.messages?.[0]?.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Valida o handshake GET do webhook da Meta. */
export function verifyWebhook(params: URLSearchParams): string | null {
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  if (
    mode === "subscribe" &&
    token === (process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "lumihunter-verify")
  ) {
    return challenge;
  }
  return null;
}

export interface InboundWhatsApp {
  from: string;
  waMessageId: string;
  text: string;
  timestamp: string;
  phoneNumberId: string;
}

/** Extrai mensagens recebidas do payload do webhook. */
export function parseInbound(payload: unknown): InboundWhatsApp[] {
  const out: InboundWhatsApp[] = [];
  const entries = (payload as { entry?: unknown[] })?.entry ?? [];
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes ?? [];
    for (const change of changes) {
      const value = (change as { value?: Record<string, unknown> })?.value ?? {};
      const phoneNumberId =
        ((value.metadata as { phone_number_id?: string }) ?? {}).phone_number_id ?? "";
      const messages = (value.messages as unknown[]) ?? [];
      for (const m of messages) {
        const msg = m as {
          from: string;
          id: string;
          timestamp: string;
          text?: { body: string };
          type: string;
        };
        out.push({
          from: msg.from,
          waMessageId: msg.id,
          text: msg.text?.body ?? `[${msg.type}]`,
          timestamp: msg.timestamp,
          phoneNumberId,
        });
      }
    }
  }
  return out;
}
