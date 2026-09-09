/**
 * Detecção de WhatsApp comercial CONFIRMADO. Funções puras.
 *
 * Regra: telefone ≠ WhatsApp. Só conta como confirmado quando há evidência
 * explícita — link wa.me / api.whatsapp.com, ou um número claramente rotulado
 * como WhatsApp.
 */
import { normalizePhoneBR } from "@/lib/utils";

const WA_LINK_RE =
  /(?:https?:\/\/)?(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=|whatsapp\.com\/send\?phone=)(\+?\d[\d\s-]{7,})/i;

const WA_LABEL_RE =
  /(?:whats\s?app|whatsapp comercial|chame no (?:whats|zap)|fale no (?:whats|zap)|atendimento (?:pelo|via) whats)[^\d]{0,40}(\+?55?\s?\(?\d{2}\)?\s?9?\d{4}[\s-]?\d{4})/i;

const HAS_WA_MENTION_RE =
  /wa\.me\/|api\.whatsapp\.com|whats\s?app|chame no zap|fale no zap/i;

export interface WhatsAppEvidence {
  /** Número E.164, quando extraído. */
  number: string | null;
  /** true se há evidência suficiente de que É WhatsApp comercial. */
  verified: boolean;
}

/** Procura um WhatsApp confirmado no texto (título + conteúdo + html cru). */
export function findVerifiedWhatsApp(text: string): WhatsAppEvidence {
  if (!text) return { number: null, verified: false };

  const link = text.match(WA_LINK_RE);
  if (link) {
    return { number: normalizePhoneBR(link[1]), verified: true };
  }

  const labeled = text.match(WA_LABEL_RE);
  if (labeled) {
    return { number: normalizePhoneBR(labeled[1]), verified: true };
  }

  // menção clara a WhatsApp mas sem número extraível → ainda conta como
  // canal existente (o vendedor localiza o número), mas sem o número.
  if (HAS_WA_MENTION_RE.test(text)) {
    return { number: null, verified: true };
  }

  return { number: null, verified: false };
}
