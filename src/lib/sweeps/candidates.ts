/**
 * Módulo 2 — geração de candidatos sequenciais de WhatsApp (DDD + número
 * inicial de celular BR de 9 dígitos, começando em 9). Função pura.
 */

/** Normaliza um "número inicial" digitado (com/sem 9, com máscara) para bigint de 9 dígitos. */
export function parseStartNumber(raw: string): bigint | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const nineDigit = digits.length === 8 ? `9${digits}` : digits;
  if (nineDigit.length !== 9 || !nineDigit.startsWith("9")) return null;
  return BigInt(nineDigit);
}

export function parseDdd(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 2) return null;
  return digits;
}

const MAX_CANDIDATE = 999_999_999n;

/** `+55${ddd}${9 dígitos zero-padded}` — formato aceito por normalizePhoneBR. */
export function candidateToPhone(ddd: string, candidate: bigint): string | null {
  if (candidate < 900_000_000n || candidate > MAX_CANDIDATE) return null;
  return `+55${ddd}${candidate.toString().padStart(9, "0")}`;
}

/** Próximo candidato após o atual; null quando a faixa de números celulares se esgotou. */
export function nextCandidate(current: bigint): bigint | null {
  const next = current + 1n;
  return next > MAX_CANDIDATE ? null : next;
}
