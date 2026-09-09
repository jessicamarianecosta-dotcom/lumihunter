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
  /** Trecho/motivo que comprova o WhatsApp (para auditoria). */
  evidence: string | null;
}

function snippet(text: string, at: number, len: number): string {
  const start = Math.max(0, at - 20);
  return text.slice(start, at + len + 40).replace(/\s+/g, " ").trim();
}

/** Procura um WhatsApp confirmado no texto (título + conteúdo + html cru). */
export function findVerifiedWhatsApp(text: string): WhatsAppEvidence {
  if (!text) return { number: null, verified: false, evidence: null };

  const link = text.match(WA_LINK_RE);
  if (link) {
    return {
      number: normalizePhoneBR(link[1]),
      verified: true,
      evidence: `Link WhatsApp: ${link[0].slice(0, 80)}`,
    };
  }

  const labeled = text.match(WA_LABEL_RE);
  if (labeled) {
    return {
      number: normalizePhoneBR(labeled[1]),
      verified: true,
      evidence: `Número rotulado como WhatsApp: "${snippet(text, labeled.index ?? 0, labeled[0].length)}"`,
    };
  }

  // menção clara a WhatsApp mas sem número extraível → ainda conta como
  // canal existente (o vendedor localiza o número), mas sem o número.
  const mention = text.match(HAS_WA_MENTION_RE);
  if (mention) {
    return {
      number: null,
      verified: true,
      evidence: `Menção a WhatsApp: "${snippet(text, mention.index ?? 0, mention[0].length)}"`,
    };
  }

  return { number: null, verified: false, evidence: null };
}
