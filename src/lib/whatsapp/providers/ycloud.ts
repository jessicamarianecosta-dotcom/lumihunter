/**
 * Provider YCloud (WhatsApp Business via Coexistência).
 *
 * ⚠️ AINDA NÃO IMPLEMENTADO DE VERDADE — e propositalmente assim.
 *
 * Este ambiente não tem acesso de rede a docs.ycloud.com nem a api.ycloud.com
 * (bloqueado pela política de rede do sandbox), e a regra explícita deste
 * projeto é: NUNCA inventar endpoint, header, payload ou nome de campo de uma
 * API externa sem confirmar na documentação oficial atual.
 *
 * Para ativar de verdade, é preciso confirmar (na documentação/dashboard do
 * YCloud, ou em um payload de webhook real recebido):
 *   1. Endpoint + verbo HTTP para enviar mensagem de texto (provavelmente
 *      algo como POST https://api.ycloud.com/v2/whatsapp/messages).
 *   2. Header/mecanismo de autenticação (ex: "X-API-Key").
 *   3. Formato exato do corpo da requisição de envio.
 *   4. Formato exato do payload de webhook (mensagem recebida e status).
 *   5. Como o webhook é assinado/validado (assinatura HMAC? header secreto?).
 *
 * Assim que esses 5 itens forem confirmados, implemente aqui — a interface
 * `WhatsAppProvider` e o restante do LumiHunter não precisam mudar nada.
 */
import type {
  ParsedWebhook,
  SendMessageResult,
  SendTextMessageArgs,
  WhatsAppProvider,
  WhatsAppProviderConfig,
} from "../types";

const NOT_IMPLEMENTED =
  "Provider YCloud ainda não implementado neste ambiente — faltam os detalhes " +
  "oficiais da API (endpoint, autenticação e formato do payload) confirmados " +
  "na documentação do YCloud. Veja o comentário no topo de providers/ycloud.ts.";

export const ycloudProvider: WhatsAppProvider = {
  id: "ycloud",

  async sendTextMessage(
    _config: WhatsAppProviderConfig,
    _args: SendTextMessageArgs,
  ): Promise<SendMessageResult> {
    return { ok: false, error: NOT_IMPLEMENTED };
  },

  validateWebhook(_config: WhatsAppProviderConfig, _params: URLSearchParams): string | null {
    return null;
  },

  parseWebhook(_config: WhatsAppProviderConfig, _payload: unknown): ParsedWebhook {
    return { messages: [], statuses: [] };
  },

  async healthCheck(_config: WhatsAppProviderConfig) {
    return { ok: false, error: NOT_IMPLEMENTED };
  },
};
