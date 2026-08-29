/**
 * Modo demo dos agentes de IA — respostas simuladas realistas, sem chamar a
 * Claude API (custo zero). Ativado quando NÃO há ANTHROPIC_API_KEY, ou quando
 * AI_DEMO_MODE=true. Assim dá para testar todo o fluxo antes de contratar a API.
 */
import type { HunterLead } from "./agents/hunter";
import type { QualifierResult } from "./agents/qualifier";
import type { CopyOutput, CopyKind } from "./agents/copywriter";
import type { Insight } from "./agents/analyst";
import type { IcpProfile, Product } from "@/lib/supabase/database.types";

export function isDemoMode(): boolean {
  return (
    process.env.AI_DEMO_MODE === "true" || !process.env.ANTHROPIC_API_KEY
  );
}

/** Hash determinístico simples (para variar saídas sem aleatoriedade real). */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
const pick = <T>(arr: T[], seed: number) => arr[seed % arr.length];

// ── Hunter ────────────────────────────────────────────────────────────────
const DEMO_SUFFIXES = ["Aurora", "Bella", "Central", "do Bairro", "Prime", "Vila", "Nova", "Real"];
const DEMO_STREETS = ["Rua das Flores", "Av. Brasil", "Rua XV", "Av. Paulista", "Rua Direita"];

export function demoHunter(
  icp: IcpProfile,
  _products: Product[],
  limit: number,
): HunterLead[] {
  const segs = icp.segments.length ? icp.segments : ["Comércio", "Serviços"];
  const cities = icp.cities.length ? icp.cities : ["São Paulo"];
  const states = icp.states.length ? icp.states : ["SP"];
  return Array.from({ length: limit }).map((_, i) => {
    const seg = pick(segs, i);
    const city = pick(cities, i + 1);
    const seed = hash(`${seg}${city}${i}`);
    const suffix = pick(DEMO_SUFFIXES, seed);
    const nameBase = seg.charAt(0).toUpperCase() + seg.slice(1);
    const slug = `${seg}-${suffix}`.toLowerCase().replace(/\s+/g, "-");
    return {
      name: `${nameBase} ${suffix}`,
      legal_name: `${nameBase} ${suffix} LTDA`,
      segment: seg,
      description: `${nameBase} em ${city}. Empresa ativa, com presença no Instagram e atendimento por WhatsApp. Perfil compatível com o ICP "${icp.name}".`,
      city,
      state: pick(states, i),
      website: seed % 3 === 0 ? null : `https://${slug}.com.br`,
      instagram: `@${slug.replace(/-/g, "")}`,
      phone: `(11) 9${String(seed).padStart(4, "0").slice(0, 4)}-${String(seed * 7).padStart(4, "0").slice(0, 4)}`,
      whatsapp: `55119${String(seed).padStart(8, "0").slice(0, 8)}`,
      email: seed % 2 === 0 ? `contato@${slug}.com.br` : null,
      products_sold: [seg],
      source_urls: [`https://exemplo.com.br/${slug} (modo demo)`],
    };
  });
}

// ── Qualifier ─────────────────────────────────────────────────────────────
export function demoQualifier(
  lead: { name: string; city: string | null; whatsapp: string | null; email: string | null; website: string | null; instagram: string | null },
  icp: IcpProfile | null,
  products: Product[],
): QualifierResult {
  const factors = [
    { label: "Tem WhatsApp comercial público", weight: 20, present: !!lead.whatsapp },
    { label: "Instagram ativo", weight: 15, present: !!lead.instagram },
    { label: "Possui site próprio", weight: 15, present: !!lead.website },
    { label: "E-mail comercial disponível", weight: 10, present: !!lead.email },
    {
      label: "Cidade dentro da área atendida (ICP)",
      weight: 25,
      present: !!(lead.city && icp?.cities.some((c) => c.toLowerCase() === lead.city!.toLowerCase())),
    },
    { label: "Segmento aderente ao ICP", weight: 15, present: !!icp },
  ];
  const score = Math.min(
    100,
    30 + factors.reduce((s, f) => s + (f.present ? f.weight : 0), 0) - 15,
  );
  const active = products.filter((p) => p.is_active).slice(0, 2);
  return {
    score,
    reason:
      score >= 70
        ? "Contato completo e forte aderência ao perfil de cliente ideal."
        : score >= 45
          ? "Aderência parcial — vale abordar, mas confirmar fit."
          : "Poucos sinais de compra e/ou dados de contato incompletos.",
    factors,
    summary: `${lead.name} tem perfil ${score >= 70 ? "muito promissor" : score >= 45 ? "razoável" : "fraco"} para os produtos do catálogo. ${active.length ? `Melhor encaixe: ${active.map((p) => p.name).join(" e ")}.` : ""} (avaliação em modo demo)`,
    recommended_product_names: active.map((p) => p.name),
  };
}

// ── Copywriter ────────────────────────────────────────────────────────────
export function demoCopywriter(
  company: { name: string },
  lead: { name: string; city: string | null; segment: string | null },
  product: { name: string } | null,
  kind: CopyKind,
): CopyOutput {
  const prod = product?.name ?? "nossos serviços de comunicação visual";
  const cidade = lead.city ? ` aí em ${lead.city}` : "";
  const seed = hash(lead.name + kind);
  const abertura = pick(
    [
      `Oi! Vi o trabalho da ${lead.name}${cidade} e curti bastante.`,
      `Olá! Aqui é da ${company.name}. Acompanhei a ${lead.name}${cidade} e queria trocar uma ideia.`,
      `Bom dia! Passando pra falar rapidinho da ${lead.name}${cidade}.`,
    ],
    seed,
  );
  const ganchoKind =
    kind === "followup"
      ? "Deixei uma mensagem esses dias — só retomando pra não perder o contato."
      : kind === "quote"
        ? "Preparei uma proposta de acordo com o que conversamos."
        : kind === "reply"
          ? "Que bom que respondeu! Sobre o que você perguntou:"
          : `A gente trabalha com ${prod} e acho que faz sentido pra vocês.`;

  return {
    whatsapp: `${abertura}\n${ganchoKind}\nFaz sentido eu te mandar alguns exemplos e valores de ${prod}?`,
    email: {
      subject: `${prod} para a ${lead.name}`,
      preheader: `Uma ideia rápida da ${company.name} para ${lead.segment ?? "o seu negócio"}`,
      body: `${abertura}\n\n${ganchoKind}\n\nSe fizer sentido, respondo com exemplos aplicados ao seu segmento (${lead.segment ?? "—"}) e uma faixa de investimento. Sem compromisso.\n\nAbraço,\nEquipe ${company.name}`,
    },
    instagram_dm: `${abertura} A ${company.name} faz ${prod} — posso te mandar uns exemplos?`,
    call_script: `Apresentar-se (${company.name}), citar que acompanha a ${lead.name}, dizer que trabalha com ${prod}, perguntar se hoje eles resolvem isso com alguém e propor enviar exemplos + orçamento.`,
    cta: `Posso te enviar exemplos e valores de ${prod}?`,
  };
}

// ── Analyst ───────────────────────────────────────────────────────────────
export function demoAnalyst(metrics: Record<string, unknown>): Insight[] {
  const n = (k: string) => Number((metrics as Record<string, number>)[k] ?? 0);
  return [
    {
      title: "Concentre o esforço nos leads qualificados",
      observation: `Há ${n("leads_total")} leads e ${n("leads_qualified")} qualificados. A conversão melhora quando o time prioriza os de score alto.`,
      recommendation: "Ordene o pipeline por score e trabalhe primeiro os acima de 70.",
      priority: "alta",
    },
    {
      title: "Taxa de resposta",
      observation: `${n("replies_total")} respostas para ${n("whatsapp_sent") + n("emails_sent")} mensagens enviadas.`,
      recommendation: "Teste variações de primeira abordagem geradas pelo Copywriter e compare a resposta por segmento.",
      priority: "média",
    },
    {
      title: "Cadência de follow-up",
      observation: "Leads sem resposta tendem a esfriar após 7 dias sem contato.",
      recommendation: "Crie uma sequência de follow-up (dias 1, 3, 7 e 15) que pare automaticamente na resposta.",
      priority: "média",
    },
    {
      title: "Alimente os agentes com dados ricos",
      observation: "Produtos e ICP com poucas palavras-chave reduzem a precisão do Hunter.",
      recommendation: "Adicione aplicações, exemplos de compradores e palavras-chave nos produtos principais.",
      priority: "baixa",
    },
  ];
}
