/**
 * WhatsApp Cloud API (oficial da Meta). Somente API oficial — nunca WhatsApp Web.
 *
 * A credencial vem de `integrations.config` por empresa (produção) ou das
 * variáveis `WHATSAPP_*` do servidor. NÃO há fallback silencioso para
 * "enviado (simulação)": se a credencial faltar ou for inválida, o envio
 * FALHA com o erro real. Simulação só quando `WHATSAPP_SIMULATE=true`
 * (uso local/testes) — nunca ative isso em produção.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const API_VERSION = process.env.WHATSAPP_API_VERSION || "v21.0";
/** Simulação é OPT-IN explícito. Sem isso, credencial ausente → falha real. */
const simulationAllowed = () => process.env.WHATSAPP_SIMULATE === "true";

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

/**
 * Resolve credenciais (por empresa > env). Retorna `{ error }` quando algo
 * essencial falta — o caller devolve isso como falha de envio, sem simular.
 */
function resolveCreds(args: { phoneNumberId?: string; accessToken?: string }): {
  phoneNumberId?: string;
  token?: string;
  error?: string;
  simulate?: boolean;
} {
  const phoneNumberId = args.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = args.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
  const enabled =
    process.env.WHATSAPP_ENABLED === "true" || !!args.accessToken || !!args.phoneNumberId;

  const missing: string[] = [];
  if (!phoneNumberId) missing.push("phone_number_id");
  if (!token) missing.push("access_token");
  if (!enabled && missing.length === 0) missing.push("WHATSAPP_ENABLED=true");

  if (missing.length) {
    if (simulationAllowed()) return { phoneNumberId, token, simulate: true };
    return {
      error: `WhatsApp não configurado no servidor (falta: ${missing.join(", ")}). Configure a integração oficial da Meta em /config.`,
    };
  }
  return { phoneNumberId, token };
}

export async function sendWhatsAppText(
  args: SendTextArgs,
): Promise<WhatsAppSendResult> {
  const to = args.to.replace(/\D/g, "");
  const creds = resolveCreds(args);
  if (creds.error) return { ok: false, error: creds.error };
  if (creds.simulate)
    return { ok: true, simulated: true, providerMessageId: `sim_wa_${Date.now()}` };
  const { phoneNumberId, token } = creds;

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

interface SendDocumentArgs {
  to: string;
  /** URL pública HTTPS do PDF. */
  link: string;
  filename: string;
  /** legenda opcional. */
  caption?: string;
  phoneNumberId?: string;
  accessToken?: string;
}

/** Envia um documento (ex.: catálogo PDF) pelo WhatsApp Cloud API. */
export async function sendWhatsAppDocument(
  args: SendDocumentArgs,
): Promise<WhatsAppSendResult> {
  const to = args.to.replace(/\D/g, "");
  const creds = resolveCreds(args);
  if (creds.error) return { ok: false, error: creds.error };
  if (creds.simulate)
    return { ok: true, simulated: true, providerMessageId: `sim_wa_doc_${Date.now()}` };
  const { phoneNumberId, token } = creds;

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
          type: "document",
          document: {
            link: args.link,
            filename: args.filename,
            ...(args.caption ? { caption: args.caption } : {}),
          },
        }),
      },
    );
    const data = (await res.json()) as {
      messages?: { id: string }[];
      error?: { message: string; code?: number };
    };
    if (!res.ok || data.error) {
      return { ok: false, error: data.error?.message || `HTTP ${res.status}` };
    }
    return { ok: true, providerMessageId: data.messages?.[0]?.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export type WebhookSignatureResult = "valid" | "invalid" | "unconfigured";

/**
 * Valida a assinatura `X-Hub-Signature-256` dos webhooks da Meta.
 *
 * A Meta assina o corpo BRUTO da requisição com HMAC-SHA256 usando o
 * App Secret do app (WHATSAPP_APP_SECRET) e envia o resultado no header
 * `X-Hub-Signature-256: sha256=<hex>`.
 *
 * Retorna:
 *  - "unconfigured" → WHATSAPP_APP_SECRET não está no ambiente do servidor
 *                     (não dá para validar — o caller deve recusar a requisição);
 *  - "invalid"      → header ausente/malformado, ou a assinatura não confere;
 *  - "valid"        → assinatura confere.
 *
 * A comparação é feita com `crypto.timingSafeEqual` (resistente a timing attack).
 * O App Secret só é lido de `process.env` no servidor — nunca chega ao cliente.
 */
export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
): WebhookSignatureResult {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) return "unconfigured";

  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return "invalid";
  }
  const provided = signatureHeader.slice("sha256=".length).trim();
  if (!/^[0-9a-f]+$/i.test(provided) || provided.length % 2 !== 0) {
    return "invalid";
  }

  const expected = createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");

  const a = Buffer.from(provided, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return "invalid";
  return timingSafeEqual(a, b) ? "valid" : "invalid";
}

/** Valida o handshake GET do webhook da Meta. */
export function verifyWebhook(params: URLSearchParams): string | null {
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  const expected =
    process.env.WHATSAPP_VERIFY_TOKEN ||
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ||
    "lumihunter-verify";
  if (mode === "subscribe" && token === expected) {
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

export type WhatsAppMessageStatus = "sent" | "delivered" | "read" | "failed";

export interface InboundWhatsAppStatus {
  waMessageId: string;
  status: WhatsAppMessageStatus;
  timestamp: string;
}

const STATUS_MAP: Record<string, WhatsAppMessageStatus> = {
  sent: "sent",
  delivered: "delivered",
  read: "read",
  failed: "failed",
};

/** Extrai atualizações de status (entregue/lido/falhou) do payload do webhook. */
export function parseStatuses(payload: unknown): InboundWhatsAppStatus[] {
  const out: InboundWhatsAppStatus[] = [];
  const entries = (payload as { entry?: unknown[] })?.entry ?? [];
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes ?? [];
    for (const change of changes) {
      const value = (change as { value?: Record<string, unknown> })?.value ?? {};
      const statuses = (value.statuses as unknown[]) ?? [];
      for (const s of statuses) {
        const st = s as { id: string; status: string; timestamp: string };
        const mapped = STATUS_MAP[st.status];
        if (!mapped) continue; // status desconhecido — ignora sem quebrar
        out.push({ waMessageId: st.id, status: mapped, timestamp: st.timestamp });
      }
    }
  }
  return out;
}
