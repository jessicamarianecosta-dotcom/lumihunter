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

/**
 * Portão final ANTES de colocar um resultado na fila automática. Puro.
 *
 * Confirma tudo o que o produto exige para enviar SEM aprovação manual:
 * empresa real individual · comprador potencial · região · não concorrente ·
 * WhatsApp comercial confirmado · produto REAL do catálogo compatível ·
 * catálogo disponível (se a campanha exige) · campanha ativa e automática ·
 * mensagem pronta e sem o nome da empresa · sem opt-out · sem envio concorrente.
 * Qualquer requisito obrigatório que falhe → NÃO ENVIAR.
 */
export interface AutoOutreachInput {
  prospectable: boolean;
  individualBusiness: boolean;
  competitor: boolean;
  resultType: string | null;
  regionConfirmed: boolean;
  whatsappVerified: boolean;
  whatsapp: string | null;
  productMatchName: string | null;
  buyerFit: number | null;
  productFit: number | null;
  blocked: boolean;
  campaignActive: boolean;
  automaticEnabled: boolean;
  channel: string;
  hasMessage: boolean;
  messageMentionsName: boolean;
  catalogRequired: boolean;
  catalogAvailable: boolean;
  alreadyInFlightOrDone: boolean;
  alreadyReplied: boolean;
}

export function validateProspectForAutomaticOutreach(
  i: AutoOutreachInput,
): EligibilityResult {
  if (i.channel !== "whatsapp")
    return { ok: false, code: "channel", reason: "Canal da campanha não é WhatsApp." };
  if (!i.automaticEnabled)
    return { ok: false, code: "not_automatic", reason: "Prospecção automática não está ativada." };
  if (!i.campaignActive)
    return { ok: false, code: "campaign_inactive", reason: "Campanha não está ativa." };
  if (!i.prospectable || i.resultType !== "business" || !i.individualBusiness)
    return { ok: false, code: "not_a_business", reason: "Não é uma empresa individual compradora." };
  if (i.competitor)
    return { ok: false, code: "competitor", reason: "Concorrente/fornecedor do mesmo produto." };
  if (!i.regionConfirmed)
    return { ok: false, code: "out_of_region", reason: "Região da campanha não confirmada." };
  // buyer_fit / product_fit: informativos (priorização), NÃO bloqueiam o envio.
  if (!i.whatsappVerified || !i.whatsapp)
    return { ok: false, code: "no_whatsapp", reason: "WhatsApp comercial não confirmado." };
  if (i.blocked)
    return { ok: false, code: "opted_out", reason: "Contato optou por não receber mensagens." };
  if (i.alreadyReplied)
    return { ok: false, code: "already_replied", reason: "O contato já respondeu — atendimento humano." };
  if (i.alreadyInFlightOrDone)
    return { ok: false, code: "already_queued", reason: "Já existe uma abordagem para este contato." };
  if (!i.hasMessage)
    return { ok: false, code: "no_message", reason: "Nenhuma mensagem preparada." };
  if (i.messageMentionsName)
    return { ok: false, code: "name_leak", reason: "A mensagem citou o nome da empresa." };
  if (i.catalogRequired && !i.catalogAvailable)
    return { ok: false, code: "no_catalog", reason: "A campanha exige catálogo, mas nenhum PDF está disponível." };
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
