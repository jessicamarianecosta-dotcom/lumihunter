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

// ── Gestão de templates da WABA ────────────────────────────────────────

export interface WhatsAppTemplateInfo {
  name: string;
  status: string; // APPROVED | PENDING | REJECTED | ...
  category: string;
  language: string;
}

interface WabaCreds {
  token?: string;
  wabaId?: string;
  error?: string;
}

function resolveWabaCreds(args: {
  accessToken?: string;
  businessAccountId?: string;
}): WabaCreds {
  const token = args.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
  const wabaId =
    args.businessAccountId || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  if (!token || !wabaId)
    return { error: "Falta access_token ou business_account_id da WABA." };
  return { token, wabaId };
}

export async function listWhatsAppTemplates(args: {
  accessToken?: string;
  businessAccountId?: string;
}): Promise<
  { ok: true; templates: WhatsAppTemplateInfo[] } | { ok: false; error: string }
> {
  const c = resolveWabaCreds(args);
  if (c.error) return { ok: false, error: c.error };
  try {
    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${c.wabaId}/message_templates?fields=name,status,category,language&limit=100`,
      { headers: { Authorization: `Bearer ${c.token}` } },
    );
    const data = (await res.json()) as {
      data?: { name: string; status: string; category: string; language: string }[];
      error?: { message: string };
    };
    if (!res.ok || data.error)
      return { ok: false, error: data.error?.message || `HTTP ${res.status}` };
    return {
      ok: true,
      templates: (data.data ?? []).map((t) => ({
        name: t.name,
        status: t.status,
        category: t.category,
        language: t.language,
      })),
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Cria (ou reenvia para revisão) o template padrão de prospecção da LumiLife.
 * Header = documento (catálogo), corpo com copy fixa, rodapé com opt-out.
 * Entra como PENDING até a Meta aprovar.
 */
export async function createProspeccaoTemplate(args: {
  accessToken?: string;
  businessAccountId?: string;
  name?: string;
  language?: string;
  bodyText?: string;
}): Promise<
  { ok: true; id: string; status: string } | { ok: false; error: string }
> {
  const c = resolveWabaCreds(args);
  if (c.error) return { ok: false, error: c.error };

  const body =
    args.bodyText?.trim() ||
    "Olá! Tudo bem? Somos da LumiLife, gráfica e comunicação visual. " +
      "Trabalhamos com materiais gráficos e personalizados — adesivos, rótulos, " +
      "cartões, tags, banners, embalagens, canecas e brindes para empresas. " +
      "Enviamos nosso catálogo para você conhecer nosso trabalho. " +
      "Se precisar de algum material, é só responder por aqui.";

  try {
    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${c.wabaId}/message_templates`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${c.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: args.name || "lumihunter_prospeccao",
          language: args.language || "pt_BR",
          category: "MARKETING",
          components: [
            { type: "BODY", text: body },
            { type: "FOOTER", text: "Responda SAIR para não receber mais mensagens." },
          ],
        }),
      },
    );
    const data = (await res.json()) as {
      id?: string;
      status?: string;
      error?: { message: string; error_user_msg?: string };
    };
    if (!res.ok || data.error)
      return {
        ok: false,
        error:
          data.error?.error_user_msg || data.error?.message || `HTTP ${res.status}`,
      };
    return { ok: true, id: data.id ?? "", status: data.status ?? "PENDING" };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

interface SendTemplateArgs {
  to: string;
  /** nome do template aprovado na WABA */
  templateName: string;
  /** ex.: "pt_BR" */
  languageCode: string;
  /** variáveis do corpo ({{1}}, {{2}}…), na ordem */
  bodyParams?: string[];
  /** PDF de header (catálogo), opcional */
  documentLink?: string;
  documentFilename?: string;
  phoneNumberId?: string;
  accessToken?: string;
}

/**
 * Envia uma mensagem de TEMPLATE (obrigatória para abordagem fria fora da
 * janela de 24h). O template precisa estar APROVADO na WABA.
 */
export async function sendWhatsAppTemplate(
  args: SendTemplateArgs,
): Promise<WhatsAppSendResult> {
  const to = args.to.replace(/\D/g, "");
  const creds = resolveCreds(args);
  if (creds.error) return { ok: false, error: creds.error };
  if (creds.simulate)
    return { ok: true, simulated: true, providerMessageId: `sim_wa_tpl_${Date.now()}` };
  const { phoneNumberId, token } = creds;

  const components: unknown[] = [];
  if (args.documentLink) {
    components.push({
      type: "header",
      parameters: [
        {
          type: "document",
          document: {
            link: args.documentLink,
            filename: args.documentFilename || "catalogo.pdf",
          },
        },
      ],
    });
  }
  if (args.bodyParams && args.bodyParams.length) {
    components.push({
      type: "body",
      parameters: args.bodyParams.map((t) => ({ type: "text", text: t })),
    });
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
          type: "template",
          template: {
            name: args.templateName,
            language: { code: args.languageCode },
            ...(components.length ? { components } : {}),
          },
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

interface SendImageArgs {
  to: string;
  /** URL pública HTTPS da imagem (jpeg/png — a Meta Cloud API não aceita webp como "image"). */
  link: string;
  caption?: string;
  phoneNumberId?: string;
  accessToken?: string;
}

/** Envia uma imagem pelo WhatsApp Cloud API. */
export async function sendWhatsAppImage(
  args: SendImageArgs,
): Promise<WhatsAppSendResult> {
  const to = args.to.replace(/\D/g, "");
  const creds = resolveCreds(args);
  if (creds.error) return { ok: false, error: creds.error };
  if (creds.simulate)
    return { ok: true, simulated: true, providerMessageId: `sim_wa_img_${Date.now()}` };
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
          type: "image",
          image: {
            link: args.link,
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
  error?: { code?: number; title?: string; message?: string };
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
        const st = s as {
          id: string;
          status: string;
          timestamp: string;
          errors?: { code?: number; title?: string; message?: string; error_data?: { details?: string } }[];
        };
        const mapped = STATUS_MAP[st.status];
        if (!mapped) continue; // status desconhecido — ignora sem quebrar
        const err = st.errors?.[0];
        out.push({
          waMessageId: st.id,
          status: mapped,
          timestamp: st.timestamp,
          error: err
            ? {
                code: err.code,
                title: err.title,
                message: err.error_data?.details || err.message || err.title,
              }
            : undefined,
        });
      }
    }
  }
  return out;
}
