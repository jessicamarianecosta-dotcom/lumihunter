import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrencyBRL(value: number | null | undefined) {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDatePtBR(value: string | Date | null | undefined) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Normaliza telefone BR para E.164 (+55...). Retorna null se inválido. */
export function normalizePhoneBR(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `+${withCountry}`;
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
}

/**
 * Dado um telefone em qualquer formato (com/sem "+", com/sem DDI 55,
 * com/sem o 9º dígito de celular brasileiro, com máscara), devolve os
 * formatos plausíveis em que ele pode ter sido salvo no banco.
 *
 * Uso principal: casar o número que a Meta manda no webhook do WhatsApp
 * (`messages[].from`, só dígitos, e para o Brasil às vezes SEM o 9) com o
 * `leads.whatsapp` / `leads.phone` do lead, que pode ter sido digitado
 * COM o 9 e COM "+". Sem isso, +55 41 99527-6636 (banco) nunca casa com
 * 554195276636 (Meta).
 */
export function phoneMatchCandidates(
  raw: string | null | undefined,
): string[] {
  if (!raw) return [];
  let d = raw.replace(/\D/g, "");
  if (d.length < 10) return [];
  // número claramente nacional (10 ou 11 dígitos) → adiciona o DDI 55
  if (!d.startsWith("55") && (d.length === 10 || d.length === 11)) d = `55${d}`;

  const out = new Set<string>();
  const push = (n: string) => {
    if (n.length < 12) return; // 55 + DDD + assinante
    out.add(n);
    out.add(`+${n}`);
  };
  push(d);

  // Brasil: 55 + DDD(2) + assinante (8 sem o 9 | 9 com o 9)
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) {
    const ddd = d.slice(2, 4);
    const sub = d.slice(4);
    if (sub.length === 9 && sub[0] === "9") push(`55${ddd}${sub.slice(1)}`); // tira o 9
    if (sub.length === 8) push(`55${ddd}9${sub}`); // põe o 9
  }
  return [...out];
}
