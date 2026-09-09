/**
 * Checklist eliminatório antes de colocar/enviar um lead na fila. Função pura.
 *
 * Qualquer requisito crítico que falhe → não envia.
 */

export interface EligibilityInput {
  whatsappVerified: boolean;
  whatsapp: string | null;
  /** telefone/whatsapp está numa lista de bloqueio (opt-out). */
  blocked: boolean;
  /** a API marcou o número como inválido/inexistente. */
  invalidNumber: boolean;
  campaignStatus: string;
  channel: string;
  hasMessage: boolean;
  catalogRequired: boolean;
  catalogAvailable: boolean;
  /** o lead já respondeu — não iniciar novo contato automático. */
  alreadyReplied: boolean;
  whatsappIntegrationReady: boolean;
}

export interface EligibilityResult {
  ok: boolean;
  reason?: string;
  code?: string;
}

export function checkEligibility(i: EligibilityInput): EligibilityResult {
  if (i.channel !== "whatsapp")
    return { ok: false, code: "channel", reason: "Canal da campanha não é WhatsApp." };
  if (i.campaignStatus !== "active")
    return { ok: false, code: "campaign_inactive", reason: "Campanha não está ativa." };
  if (!i.whatsappVerified || !i.whatsapp)
    return { ok: false, code: "no_whatsapp", reason: "WhatsApp comercial não confirmado." };
  if (i.invalidNumber)
    return { ok: false, code: "invalid_number", reason: "Número de WhatsApp inválido." };
  if (i.blocked)
    return { ok: false, code: "opted_out", reason: "Contato optou por não receber mensagens." };
  if (i.alreadyReplied)
    return { ok: false, code: "already_replied", reason: "O lead já respondeu — não iniciar novo contato." };
  if (!i.hasMessage)
    return { ok: false, code: "no_message", reason: "Nenhuma mensagem preparada." };
  if (i.catalogRequired && !i.catalogAvailable)
    return {
      ok: false,
      code: "no_catalog",
      reason: "A campanha exige catálogo, mas nenhum PDF está disponível.",
    };
  if (!i.whatsappIntegrationReady)
    return { ok: false, code: "no_integration", reason: "Integração de WhatsApp não configurada." };
  return { ok: true };
}

/** Classifica um erro da API de WhatsApp: transitório (retry) ou permanente. */
export function classifyWhatsAppError(error: string | undefined): {
  code: string;
  transient: boolean;
  invalidNumber: boolean;
} {
  const e = (error ?? "").toLowerCase();
  if (/401|403|unauthor|permission|token/.test(e))
    return { code: "auth", transient: false, invalidNumber: false };
  if (/invalid|not.*(exist|registered|whatsapp)|recipient|no.*number/.test(e))
    return { code: "invalid_recipient", transient: false, invalidNumber: true };
  if (/429|rate|limit|too many/.test(e))
    return { code: "rate_limited", transient: true, invalidNumber: false };
  if (/timeout|timed out|econn|network|fetch failed|5\d\d/.test(e))
    return { code: "transient", transient: true, invalidNumber: false };
  return { code: "unknown", transient: false, invalidNumber: false };
}
