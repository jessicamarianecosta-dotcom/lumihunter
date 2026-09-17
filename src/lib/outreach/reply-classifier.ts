/**
 * Classifica uma mensagem recebida no WhatsApp: resposta automática (bot,
 * ausência, menu) ou humana — e, se humana, se demonstra interesse ou não.
 * Heurística de padrões, pura e sem chamada de IA (a tela Conversas não pode
 * depender de uma chave configurada para funcionar). Usada pelo webhook para
 * decidir se a conversa "precisa de você" ou só está aguardando.
 */

export type ReplyKind = "auto" | "human";
export type ReplyInterest = "interested" | "not_interested" | "neutral";

export interface ReplyClassification {
  kind: ReplyKind;
  interest: ReplyInterest;
}

const AUTO_REPLY_PATTERNS: RegExp[] = [
  /n[ãa]o\s+estamos\s+dispon[íi]ve(l|is)/i,
  /estamos\s+fora\s+do\s+hor[áa]rio/i,
  /fora\s+do\s+hor[áa]rio\s+de\s+atendimento/i,
  /hor[áa]rio\s+de\s+atendimento[:\s]/i,
  /nosso\s+hor[áa]rio\s+de\s+funcionamento/i,
  /retornaremos\s+(assim\s+que\s+poss[íi]vel|em\s+breve|o\s+quanto\s+antes)/i,
  /respondere?mos\s+(assim\s+que\s+poss[íi]vel|em\s+breve)/i,
  /agradecemos\s+(o\s+seu\s+contato|a\s+sua\s+mensagem|seu\s+contato|sua\s+mensagem)/i,
  /em\s+breve\s+(um\s+d[eo]\s+nossos?|nossa\s+equipe|algu[ée]m)/i,
  /nossa\s+equipe\s+(vai\s+)?retornar[áa]?/i,
  /mensagem\s+autom[áa]tica/i,
  /atendimento\s+autom[áa]tico/i,
  /esta\s+[ée]\s+uma\s+resposta\s+autom[áa]tica/i,
  /\bbem[- ]vindo(a)?\b/i,
  /digite\s+(o\s+)?n[úu]mero\s+da\s+op[çc][ãa]o/i,
  /responda\s+com\s+(o\s+)?n[úu]mero/i,
  /escolha\s+uma\s+das\s+op[çc][õo]es/i,
  /para\s+falar\s+com\s+(um\s+)?(atendente|consultor|vendedor)/i,
];

const NOT_INTERESTED_PATTERNS: RegExp[] = [
  /n[ãa]o\s+(temos|tenho)\s+interesse/i,
  /sem\s+interesse/i,
  /j[áa]\s+temos\s+(fornecedor|parceiro)/i,
  /n[ãa]o\s+precis(amos|o)(\s+(no\s+momento|por\s+enquanto|disso))?/i,
  /obrigad[oa],?\s+n[ãa]o/i,
  /n[ãa]o\s+ser[áa]\s+(necess[áa]rio|dessa\s+vez)/i,
  /talvez\s+(outra\s+vez|no\s+futuro)/i,
  /n[ãa]o\s+([ée]\s+)?pra\s+(mim|n[óo]s)/i,
];

const INTERESTED_PATTERNS: RegExp[] = [
  /\?\s*$/,
  /quanto\s+custa|qual\s+(o\s+)?valor|pre[çc]o/i,
  /gostaria\s+de\s+saber/i,
  /voc[eê]s?\s+(trabalham|fazem|t[eê]m|tem|vendem|fornecem)/i,
  /\bquero\b|preciso\s+de|me\s+interessei/i,
  /pode(m)?\s+me\s+(mandar|enviar|passar)/i,
  /como\s+(funciona|fa[çc]o)/i,
];

/** Classifica o texto de uma mensagem recebida. Pura, sem IA. */
export function classifyReply(rawText: string | null | undefined): ReplyClassification {
  const text = (rawText ?? "").trim();
  if (!text) return { kind: "human", interest: "neutral" };

  if (AUTO_REPLY_PATTERNS.some((re) => re.test(text))) {
    return { kind: "auto", interest: "neutral" };
  }
  if (NOT_INTERESTED_PATTERNS.some((re) => re.test(text))) {
    return { kind: "human", interest: "not_interested" };
  }
  if (INTERESTED_PATTERNS.some((re) => re.test(text))) {
    return { kind: "human", interest: "interested" };
  }
  return { kind: "human", interest: "neutral" };
}
