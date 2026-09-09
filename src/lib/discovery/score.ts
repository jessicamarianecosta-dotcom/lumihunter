/**
 * Qualificação heurística de uma empresa candidata. Função pura.
 *
 * Score 0–100 a partir SÓ de sinais reais (dados encontrados). Nunca assume o
 * que não foi visto. A IA (quando disponível) refina isto depois — ver
 * `./ai.ts`. Sem IA, esta é a qualificação final.
 */
import { parseAudienceSegments, parseProductKeywords } from "./queries";
import type {
  CampaignBrief,
  Qualification,
  QualificationSignal,
} from "./types";

export interface HeuristicInput {
  companyName: string;
  segment: string | null;
  description: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  discoveryQuery: string | null;
}

export interface QualificationResult {
  score: number;
  qualification: Qualification;
  reason: string;
  signals: QualificationSignal[];
}

export function qualificationBand(score: number): Qualification {
  if (score >= 61) return "high";
  if (score >= 31) return "medium";
  return "low";
}

function overlaps(haystack: string, needles: string[]): string[] {
  const h = haystack.toLowerCase();
  return needles.filter((n) => n.length > 2 && h.includes(n.toLowerCase()));
}

export function qualifyHeuristic(
  c: HeuristicInput,
  brief: CampaignBrief,
): QualificationResult {
  const signals: QualificationSignal[] = [];
  let score = 20;

  const text = [
    c.companyName,
    c.segment ?? "",
    c.description ?? "",
    c.discoveryQuery ?? "",
  ].join(" ");

  // 1. É uma empresa real identificada
  if (c.website || c.instagram) {
    score += 12;
    signals.push({ label: "Empresa identificada com presença online" });
  }

  // 2. Região compatível
  const regionHit = brief.regions.some((r) => {
    const main = r.split(/\s+e\s+|,|\//)[0].trim().toLowerCase();
    return (
      (c.city && c.city.toLowerCase().includes(main)) ||
      (main.length > 2 && text.toLowerCase().includes(main))
    );
  });
  if (regionHit || c.city) {
    score += 18;
    signals.push({
      label: "Região compatível com a campanha",
      detail: c.city ?? undefined,
    });
  }

  // 3. Canais de contato
  if (c.whatsapp) {
    score += 15;
    signals.push({ label: "WhatsApp comercial encontrado" });
  } else if (c.phone) {
    score += 10;
    signals.push({ label: "Telefone comercial encontrado" });
  }
  if (c.website) {
    score += 8;
    signals.push({ label: "Site próprio" });
  }
  if (c.instagram) {
    score += 7;
    signals.push({ label: "Instagram comercial" });
  }
  if (c.email) score += 3;

  // 4. Aderência ao público-alvo
  const segments = parseAudienceSegments(brief.audience);
  const audHits = overlaps(text, segments.flatMap((s) => s.split(/\s+/)));
  if (audHits.length > 0) {
    score += 15;
    signals.push({
      label: "Segmento compatível com o público-alvo",
      detail: audHits.slice(0, 3).join(", "),
    });
  }

  // 5. Relevância do produto (pode usar o que a campanha vende)
  const productKw = parseProductKeywords(brief.product);
  const prodHits = overlaps(text, productKw);
  if (prodHits.length > 0) {
    score += 10;
    signals.push({
      label: "Produto potencialmente relevante para o negócio",
      detail: prodHits.slice(0, 3).join(", "),
    });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const qualification = qualificationBand(score);

  const reason = buildReason(c, brief, { regionHit: regionHit || !!c.city, audHits, prodHits, qualification });

  return { score, qualification, reason, signals };
}

function buildReason(
  c: HeuristicInput,
  brief: CampaignBrief,
  ctx: {
    regionHit: boolean;
    audHits: string[];
    prodHits: string[];
    qualification: Qualification;
  },
): string {
  const parts: string[] = [];
  const kind =
    c.segment ?? (ctx.audHits.length ? ctx.audHits[0] : "empresa");
  parts.push(
    `${c.companyName}${c.city ? `, em ${c.city}` : ""}${
      c.state ? `/${c.state}` : ""
    }`,
  );
  if (ctx.regionHit) parts.push("está dentro da região desta campanha");
  if (c.website || c.instagram) parts.push("tem presença comercial online");
  if (ctx.audHits.length)
    parts.push(`o segmento tem relação com o público-alvo (${kind})`);
  if (ctx.prodHits.length)
    parts.push(
      `pode usar ${brief.product.toLowerCase()} no dia a dia do negócio`,
    );
  if (c.whatsapp || c.phone) parts.push("há um contato comercial disponível");

  if (parts.length <= 1) {
    return `${c.companyName} apareceu na busca, mas com poucos sinais confirmados. Vale revisar antes de aprovar.`;
  }
  const first = parts.shift()!;
  return `${first} — ${parts.join("; ")}.`;
}
