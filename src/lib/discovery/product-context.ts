/**
 * Contexto do produto REAL da campanha — a "regra de negócio" da descoberta.
 *
 * O catálogo é a FONTE DA VERDADE. A busca e a qualificação partem daqui, não
 * do público. A IA só pode falar dos produtos que aparecem neste contexto.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ProductContext } from "./types";

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
export async function getCampaignProductContext(
  admin: Admin,
  companyId: string,
  campaign: CampaignRow,
): Promise<ProductContext | null> {
  const audience = campaign.audience_text ?? campaign.segment ?? null;

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
    source: "text",
  };
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
