/**
 * Checklist eliminatório antes de colocar/enviar um lead na fila. Função pura.
 *
 * GATE OBRIGATÓRIO (e SÓ ele): empresa identificável · região compatível ·
 * não é concorrente · WhatsApp válido/confirmado · campanha ativa · sem
 * opt-out · não duplicado. buyer_fit / product_fit / score / segmento /
 * "evidence textual" NÃO bloqueiam. Catálogo é best-effort (o worker anexa
 * se houver; não impede o texto de sair).
 */

/** Normaliza para comparação de região (sem acento, minúsculo). */
function normRegion(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/**
 * Região compatível a partir de dados ESTRUTURADOS: a cidade/UF do lead bate
 * com alguma região da campanha. Sem exigir frase dentro de `evidence`.
 */
export function regionMatches(
  campaignRegions: string[],
  city: string | null,
  state: string | null,
): boolean {
  const regions = (campaignRegions ?? []).map(normRegion).filter(Boolean);
  if (regions.length === 0) return false;
  const hay = [city, state].filter(Boolean).map((v) => normRegion(v as string));
  if (hay.length === 0) return false;
  return regions.some((r) => {
    const main = r.split(/\s+e\s+|,|\//)[0].trim();
    return hay.some(
      (h) => h.includes(main) || (main.length > 2 && main.includes(h)),
    );
  });
}

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
  // Catálogo NÃO bloqueia: o worker anexa o PDF se existir; sem PDF, o texto sai mesmo assim.
  if (!i.whatsappIntegrationReady)
    return { ok: false, code: "no_integration", reason: "Integração de WhatsApp não configurada." };
  return { ok: true };
}

/**
 * Portão final ANTES de colocar um resultado na fila automática. Puro.
 *
 * GATE OBRIGATÓRIO — e SÓ ele:
 *   1. empresa identificável (resultado é empresa individual)
 *   2. não é claramente concorrente
 *   3. região compatível (dados estruturados: cidade/UF × regiões da campanha)
 *   4. WhatsApp válido/confirmado (número + evidência de WhatsApp, não só telefone)
 *   5. campanha ativa (e automática, no fluxo sem aprovação)
 *   6. não está em opt-out
 *   7. não é duplicado / já abordado / já respondeu
 *
 * NÃO bloqueia por: buyer_fit, product_fit, score, IA, segmento nulo,
 * "evidence textual", catálogo.
 */
export interface AutoOutreachInput {
  individualBusiness: boolean;
  competitor: boolean;
  resultType: string | null;
  regionConfirmed: boolean;
  whatsappVerified: boolean;
  whatsapp: string | null;
  blocked: boolean;
  campaignActive: boolean;
  automaticEnabled: boolean;
  channel: string;
  hasMessage: boolean;
  alreadyInFlightOrDone: boolean;
  alreadyReplied: boolean;
  /** informativos — registrados, nunca bloqueiam. */
  buyerFit?: number | null;
  productFit?: number | null;
  productMatchName?: string | null;
  prospectable?: boolean;
}

export function validateProspectForAutomaticOutreach(
  i: AutoOutreachInput,
): EligibilityResult {
  // 5. canal + campanha ativa + automática
  if (i.channel !== "whatsapp")
    return { ok: false, code: "channel", reason: "Canal da campanha não é WhatsApp." };
  if (!i.automaticEnabled)
    return { ok: false, code: "not_automatic", reason: "Prospecção automática não está ativada." };
  if (!i.campaignActive)
    return { ok: false, code: "campaign_inactive", reason: "Campanha não está ativa." };
  // 1. empresa identificável
  if (i.resultType !== "business" || !i.individualBusiness)
    return { ok: false, code: "not_a_business", reason: "Não é uma empresa individual." };
  // 2. não concorrente
  if (i.competitor)
    return { ok: false, code: "competitor", reason: "Concorrente/fornecedor do mesmo produto." };
  // 3. região compatível
  if (!i.regionConfirmed)
    return { ok: false, code: "out_of_region", reason: "Região da campanha não confirmada." };
  // 4. WhatsApp válido/confirmado
  if (!i.whatsappVerified || !i.whatsapp)
    return { ok: false, code: "no_whatsapp", reason: "WhatsApp comercial não confirmado." };
  // 6. opt-out
  if (i.blocked)
    return { ok: false, code: "opted_out", reason: "Contato optou por não receber mensagens." };
  // 7. duplicidade / já abordado / já respondeu
  if (i.alreadyReplied)
    return { ok: false, code: "already_replied", reason: "O contato já respondeu — atendimento humano." };
  if (i.alreadyInFlightOrDone)
    return { ok: false, code: "already_queued", reason: "Já existe uma abordagem para este contato." };
  // integridade da mensagem (não é gate de qualificação)
  if (!i.hasMessage)
    return { ok: false, code: "no_message", reason: "Nenhuma mensagem preparada." };
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
