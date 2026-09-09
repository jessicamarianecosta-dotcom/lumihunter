/**
 * Renderização de variáveis da mensagem de abordagem. Função pura.
 *
 * Regras:
 * - só substitui variáveis com valor real;
 * - variável vazia → o token é removido e a frase é limpa (nada de "em ." ou
 *   "Olá {{nome_contato}}");
 * - NUNCA inventa nome de contato, Instagram, etc.
 */

export interface LeadVars {
  /** null em modo anônimo — a mensagem nunca cita o nome da empresa. */
  empresa: string | null;
  cidade: string | null;
  estado: string | null;
  segmento: string | null;
  /** Só quando REALMENTE confirmado — senão null. */
  nome_contato: string | null;
  produto: string;
  site: string | null;
}

/**
 * Mensagem base padrão — NUNCA cita o nome da empresa prospectada.
 * Soa como uma abordagem comercial natural. {{produto}} é opcional: se vazio,
 * o trecho é removido sem deixar frase quebrada.
 */
export const DEFAULT_BASE_MESSAGE = `Olá! Tudo bem? 😊

Trabalhamos com produtos personalizados para empresas e temos opções de {{produto}} que podem ser interessantes para o seu negócio.

Preparamos nosso catálogo com as opções disponíveis 💛

Se tiver interesse em algum produto, é só nos chamar por aqui!`;

// palavras genéricas que, sozinhas, não identificam a empresa (não contam como
// "nome vazado" se aparecerem na mensagem)
const GENERIC_NAME_WORDS = new Set([
  "comercio", "comercial", "loja", "lojas", "empresa", "empresas", "servicos",
  "servico", "ltda", "epp", "eireli", "mei", "me", "sa", "cia", "grupo",
  "confeitaria", "padaria", "doceria", "cafe", "cafeteria", "restaurante",
  "lanchonete", "bar", "salao", "barbearia", "clinica", "estudio", "atelie",
  "hortifruti", "mercado", "mercearia", "boutique", "petshop", "pet", "shop",
  "the", "do", "da", "de", "e", "and",
]);

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A mensagem cita o nome da empresa prospectada? Puro.
 * Regra do produto: a abordagem NUNCA pode mencionar o nome da empresa
 * encontrada. Considera vazamento se o nome inteiro (normalizado) aparece OU
 * se um token distintivo do nome (≥4 letras, não genérico) aparece.
 */
export function mentionsCompanyName(
  message: string,
  companyName: string | null | undefined,
): boolean {
  if (!companyName) return false;
  const m = ` ${norm(message)} `;
  const full = norm(companyName);
  if (full.length >= 4 && m.includes(` ${full} `)) return true;

  const tokens = full
    .split(" ")
    .filter((w) => w.length >= 4 && !GENERIC_NAME_WORDS.has(w) && !/^\d+$/.test(w));
  return tokens.some((t) => m.includes(` ${t} `) || m.includes(` ${t}s `));
}

const KNOWN_VARS = [
  "empresa",
  "cidade",
  "estado",
  "segmento",
  "nome_contato",
  "produto",
  "site",
] as const;

export function renderTemplate(
  template: string,
  vars: LeadVars,
): { text: string; usedFallback: boolean } {
  let usedFallback = false;
  let text = template;

  const dict: Record<(typeof KNOWN_VARS)[number], string | null> = {
    empresa: vars.empresa,
    cidade: vars.cidade,
    estado: vars.estado,
    segmento: vars.segmento,
    nome_contato: vars.nome_contato,
    produto: vars.produto,
    site: vars.site,
  };

  for (const key of KNOWN_VARS) {
    const value = dict[key];
    const token = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
    if (value && value.trim()) {
      text = text.replace(token, value.trim());
    } else {
      // remove o token e conectivos órfãos ao redor ("em {{cidade}}" → "")
      text = text.replace(
        new RegExp(`\\s*(?:em|de|da|do|na|no|,)?\\s*\\{\\{\\s*${key}\\s*\\}\\}`, "gi"),
        "",
      );
      if (key !== "nome_contato" && key !== "site") usedFallback = true;
    }
  }

  // qualquer variável desconhecida que sobrou → remove
  text = text.replace(/\{\{[^}]+\}\}/g, "");

  text = text
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .replace(/\(\s*\)/g, "")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();

  return { text, usedFallback };
}
