/**
 * Contexto do produto REAL da campanha — a "regra de negócio" da descoberta.
 *
 * O catálogo é a FONTE DA VERDADE. A busca e a qualificação partem daqui, não
 * do público. A IA só pode falar dos produtos que aparecem neste contexto.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { generateText, isAiDemoMode } from "@/lib/ai";
import { parseJsonFromText } from "@/lib/anthropic/client";
import { GENERIC_AUDIENCE } from "./queries";
import type { BuyerProfile, ProductContext } from "./types";

type Admin = SupabaseClient<Database>;

interface CampaignRow {
  product_id: string | null;
  product_text: string | null;
  goal: string | null;
  audience_text: string | null;
  segment: string | null;
}

/**
 * Retorna o contexto do produto da campanha, ou `null` se a campanha não tem
 * produto nem texto de produto definido (nesse caso a descoberta é bloqueada).
 */
async function loadCatalogProducts(admin: Admin, companyId: string) {
  const { data } = await admin
    .from("products")
    .select("name, keywords, applications")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .limit(60);
  return (data ?? []).map((p) => ({
    name: p.name,
    keywords: p.keywords ?? [],
    applications: p.applications ?? [],
  }));
}

export async function getCampaignProductContext(
  admin: Admin,
  companyId: string,
  campaign: CampaignRow,
): Promise<ProductContext | null> {
  const audience = campaign.audience_text ?? campaign.segment ?? null;
  const catalogProducts = await loadCatalogProducts(admin, companyId);

  if (campaign.product_id) {
    const { data: p } = await admin
      .from("products")
      .select(
        "name, description, keywords, applications, use_cases, example_buyers, ideal_audience, category_id",
      )
      .eq("id", campaign.product_id)
      .eq("company_id", companyId)
      .maybeSingle();

    if (p) {
      let category: string | null = null;
      if (p.category_id) {
        const { data: c } = await admin
          .from("product_categories")
          .select("name")
          .eq("id", p.category_id)
          .maybeSingle();
        category = c?.name ?? null;
      }

      // nomes de variações (Base Comercial), quando existirem
      let variantNames: string[] = [];
      const { data: groups } = await admin
        .from("product_variation_groups")
        .select("id")
        .eq("product_id", campaign.product_id);
      if (groups?.length) {
        const { data: opts } = await admin
          .from("product_variation_options")
          .select("value")
          .in(
            "group_id",
            groups.map((g) => g.id),
          );
        variantNames = [
          ...new Set((opts ?? []).map((o) => o.value).filter(Boolean)),
        ].slice(0, 20);
      }

      return {
        name: p.name,
        description: p.description ?? campaign.product_text ?? null,
        category,
        keywords: p.keywords ?? [],
        applications: p.applications ?? [],
        useCases: p.use_cases ?? [],
        exampleBuyers: p.example_buyers ?? [],
        idealAudience: p.ideal_audience ?? audience,
        variantNames,
        catalogProducts,
        source: "catalog",
      };
    }
  }

  const text = (campaign.product_text ?? campaign.goal ?? "").trim();
  if (!text) return null;

  return {
    name: text,
    description: campaign.product_text ?? null,
    category: null,
    keywords: [],
    applications: [],
    useCases: [],
    exampleBuyers: [],
    idealAudience: audience,
    variantNames: [],
    catalogProducts,
    source: "text",
  };
}

// ── Perfil de comprador: quem COMPRA o produto (não quem o fabrica) ────────
const SUPPLIER_WORDS = [
  "gráfica", "grafica", "impressão", "impressao", "gráfico", "grafico",
  "comunicação visual", "comunicacao visual", "serigrafia", "serralheria",
  "sublimação", "sublimacao", "plotagem", "confecção de", "confeccao de",
];

/** Heurística: transforma o produto num perfil de comprador e num de exclusão. */
export function heuristicBuyerProfile(
  ctx: ProductContext,
  audience: string,
): BuyerProfile {
  const buyerSegments = [
    ...ctx.exampleBuyers,
    ...ctx.useCases,
    ...audience
      .split(/[,;/\n]| e | ou /i)
      .map((s) => s.trim().toLowerCase())
      .filter(
        (s) =>
          s.length > 2 &&
          !s.split(/\s+/).every((w) => GENERIC_AUDIENCE.has(w)),
      ),
  ]
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .filter((s, i, a) => a.indexOf(s) === i)
    .slice(0, 10);

  const nameWords = ctx.name
    .toLowerCase()
    .split(/[\s,/]+/)
    .filter((w) => w.length > 3);

  const excludedProfiles = [
    ...SUPPLIER_WORDS,
    ...nameWords.map((w) => `fabricante de ${w}`),
    ...nameWords.map((w) => `fornecedor de ${w}`),
    ...nameWords.map((w) => `${w} sob encomenda`),
    ...nameWords.map((w) => `empresa de ${w}`),
  ].filter((s, i, a) => a.indexOf(s) === i);

  return { buyerSegments, excludedProfiles, source: "heuristic" };
}

const BUYER_SYSTEM = `Você ajuda um sistema de prospecção B2B. Dado um PRODUTO que
uma empresa VENDE, você lista QUEM COMPRA esse produto (segmentos de empresas
clientes) e QUEM NÃO É CLIENTE (fornecedores/concorrentes que fazem o mesmo
produto). Nunca confunda "usa/vende o produto" com "compra o produto de um
fornecedor". Responda SOMENTE JSON.`;

/** Deriva o perfil de comprador. IA quando disponível; senão heurística. */
export async function deriveBuyerProfile(
  companyId: string,
  ctx: ProductContext,
  audience: string,
): Promise<BuyerProfile> {
  const fallback = heuristicBuyerProfile(ctx, audience);
  if (await isAiDemoMode(companyId)) return fallback;

  const prompt = `## Produto vendido
Nome: ${ctx.name}
${ctx.description ? `Descrição: ${ctx.description}` : ""}
${ctx.category ? `Categoria: ${ctx.category}` : ""}
${ctx.applications.length ? `Aplicações: ${ctx.applications.join(", ")}` : ""}

## Público informado pelo usuário
${audience || "—"}

## Tarefa
{
  "buyer_segments": ["segmentos de EMPRESAS que compram este produto de um fornecedor"],
  "excluded_profiles": ["perfis a excluir: quem FABRICA/VENDE o mesmo produto (concorrentes e fornecedores)"]
}`;

  try {
    const res = await generateText({
      companyId,
      system: BUYER_SYSTEM,
      prompt,
      maxTokens: 1200,
    });
    const parsed = parseJsonFromText<{
      buyer_segments?: string[];
      excluded_profiles?: string[];
    }>(res.text);
    const buyerSegments = (parsed.buyer_segments ?? [])
      .filter((s) => typeof s === "string" && s.trim())
      .map((s) => s.trim().toLowerCase())
      .slice(0, 12);
    const excludedProfiles = [
      ...(parsed.excluded_profiles ?? [])
        .filter((s) => typeof s === "string" && s.trim())
        .map((s) => s.trim().toLowerCase()),
      ...SUPPLIER_WORDS,
    ]
      .filter((s, i, a) => a.indexOf(s) === i)
      .slice(0, 20);
    if (buyerSegments.length === 0) return fallback;
    return { buyerSegments, excludedProfiles, source: "ai" };
  } catch {
    return fallback;
  }
}

/** Lista plana de termos que só podem sair do catálogo (produto + variações). */
export function catalogTerms(ctx: ProductContext): string[] {
  return [
    ctx.name,
    ...ctx.keywords,
    ...ctx.applications,
    ...ctx.variantNames,
  ]
    .flatMap((s) => s.toLowerCase().split(/[\s,/]+/))
    .map((w) => w.trim())
    .filter((w) => w.length > 2)
    .filter((w, i, a) => a.indexOf(w) === i);
}
