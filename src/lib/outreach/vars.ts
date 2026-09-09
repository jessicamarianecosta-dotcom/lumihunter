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
  empresa: string;
  cidade: string | null;
  estado: string | null;
  segmento: string | null;
  /** Só quando REALMENTE confirmado — senão null. */
  nome_contato: string | null;
  produto: string;
  site: string | null;
}

export const DEFAULT_BASE_MESSAGE = `Olá! Tudo bem? 😊

Encontrei a {{empresa}} durante uma pesquisa sobre negócios de {{segmento}} em {{cidade}}.

Somos da LumiLife Comunicação Visual e trabalhamos com materiais gráficos e personalizados.

Queria saber se vocês estão precisando de algum material para a empresa. Posso te enviar nosso catálogo?`;

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
