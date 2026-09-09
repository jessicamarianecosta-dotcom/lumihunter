/**
 * Camada de abstração de WhatsApp — contrato comum entre provedores (BSPs).
 * Nenhum outro módulo do LumiHunter deve importar um provider diretamente
 * (ex: providers/ycloud.ts) — sempre via `WhatsAppService` (./service.ts).
 */

export type WhatsAppProviderId = "meta" | "ycloud";

/** Estados padronizados do LumiHunter — o mesmo enum já usado em `messages.status`. */
export type WhatsAppMessageStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "read"
  | "failed";

export interface SendTextMessageArgs {
  /** Telefone em E.164 sem "+", ex: 5541999999999 */
  to: string;
  body: string;
}

export interface SendDocumentArgs {
  to: string;
  /** URL pública HTTPS do arquivo. */
  link: string;
  filename: string;
  caption?: string;
}

export interface SendMessageResult {
  ok: boolean;
  /** Id da mensagem no provedor — vai para `messages.provider_message_id`. */
  providerMessageId?: string;
  error?: string;
  /** true quando não há credencial configurada e nada foi enviado de verdade. */
  simulated?: boolean;
}

export interface InboundMessage {
  /** Telefone do lead em E.164 sem "+". */
  from: string;
  providerMessageId: string;
  text: string;
  /** epoch em segundos ou ISO — normalizado para ISO antes de persistir. */
  timestamp: string;
  /** Identificador da linha/número que recebeu (ex: phone_number_id da Meta). */
  channelIdentifier: string;
}

export interface InboundStatus {
  providerMessageId: string;
  status: WhatsAppMessageStatus;
  timestamp: string;
}

export interface ParsedWebhook {
  messages: InboundMessage[];
  statuses: InboundStatus[];
}

/**
 * Resultado da verificação de assinatura de um webhook:
 *  - "valid"        → assinatura confere, pode processar;
 *  - "invalid"      → assinatura ausente ou incorreta, recusar (401);
 *  - "unconfigured" → o segredo de verificação não está no ambiente do
 *                     servidor, então não há como validar — recusar (503).
 */
export type WebhookSignatureResult = "valid" | "invalid" | "unconfigured";

/** Config resolvida (chave/segredo do provedor ativo) — nunca serializada para o cliente. */
export interface WhatsAppProviderConfig {
  [key: string]: string | undefined;
}

/**
 * Contrato que todo provedor de WhatsApp implementa. `WhatsAppService` é o
 * único consumidor direto — o resto do LumiHunter não sabe qual provider
 * está ativo.
 */
export interface WhatsAppProvider {
  readonly id: WhatsAppProviderId;

  /** Envia uma mensagem de texto livre. */
  sendTextMessage(
    config: WhatsAppProviderConfig,
    args: SendTextMessageArgs,
  ): Promise<SendMessageResult>;

  /** Envia um documento (ex.: catálogo PDF) por URL pública. Opcional por provider. */
  sendDocument?(
    config: WhatsAppProviderConfig,
    args: SendDocumentArgs,
  ): Promise<SendMessageResult>;

  /** Valida o handshake GET de verificação do webhook (quando o provedor exigir). */
  validateWebhook(
    config: WhatsAppProviderConfig,
    params: URLSearchParams,
  ): string | null;

  /**
   * Verifica a assinatura de uma chamada POST de webhook a partir do corpo
   * bruto e dos headers da requisição. Deve ser chamada ANTES de qualquer
   * parsing/processamento do payload.
   */
  verifyWebhookSignature(
    rawBody: string,
    headers: Headers,
  ): WebhookSignatureResult;

  /** Normaliza o payload de webhook do provedor para o formato interno. */
  parseWebhook(config: WhatsAppProviderConfig, payload: unknown): ParsedWebhook;

  /** Checagem real de conectividade (usada pelo botão "Testar conexão"). */
  healthCheck(
    config: WhatsAppProviderConfig,
  ): Promise<{ ok: boolean; message?: string; error?: string }>;
}
