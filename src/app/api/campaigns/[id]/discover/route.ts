import { NextResponse } from "next/server";
import { tryGetContext, canWrite } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";
import { enforceAiQuota } from "@/lib/limits";
import {
  runDiscovery,
  discoverySourcesConfigured,
  getCampaignProductContext,
  deriveBuyerProfile,
  TavilyError,
  tavilyErrorMessage,
  type CampaignBrief,
} from "@/lib/discovery";

export const maxDuration = 300;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await tryGetContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!canWrite(ctx.role))
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const limited = await enforceRateLimit("ai", ctx.company.id, LIMITS.ai);
  if (limited) return limited;

  const admin = createAdminClient();
  const quota = await enforceAiQuota(admin, ctx.company.id);
  if (quota) return quota;

  const { data: campaign } = await admin
    .from("campaigns")
    .select(
      "id, name, channel, product_id, product_text, audience_text, regions, segment, city, goal",
    )
    .eq("id", id)
    .eq("company_id", ctx.company.id)
    .maybeSingle();
  if (!campaign)
    return NextResponse.json({ error: "campanha não encontrada" }, { status: 404 });

  // ── Produto real da campanha = regra de negócio da busca ───────────────
  const productContext = await getCampaignProductContext(admin, ctx.company.id, campaign);
  if (!productContext) {
    return NextResponse.json(
      {
        error:
          "Defina o produto ou serviço que deseja prospectar (no catálogo ou no campo de texto) antes de procurar leads.",
        code: "no_product",
      },
      { status: 400 },
    );
  }

  const audience = campaign.audience_text?.trim() || campaign.segment?.trim() || "";
  const regions = (
    campaign.regions && campaign.regions.length
      ? campaign.regions
      : campaign.city
        ? [campaign.city]
        : []
  )
    .map((r) => r.trim())
    .filter(Boolean);

  const missing: string[] = [];
  if (!audience) missing.push("público-alvo");
  if (regions.length === 0) missing.push("região");
  if (missing.length) {
    return NextResponse.json(
      {
        error: `Antes de buscar, defina ${missing.join(" e ")} nesta campanha.`,
        code: "campaign_incomplete",
      },
      { status: 400 },
    );
  }

  if (!discoverySourcesConfigured()) {
    return NextResponse.json(
      {
        error:
          "A busca de leads não está disponível: a integração do Tavily não está configurada no servidor (TAVILY_API_KEY).",
        code: "not_configured",
      },
      { status: 503 },
    );
  }

  const buyerProfile = await deriveBuyerProfile(
    ctx.company.id,
    productContext,
    audience,
  );

  const channelRequirement: "whatsapp" | "email" | "none" =
    campaign.channel === "whatsapp"
      ? "whatsapp"
      : campaign.channel === "email"
        ? "email"
        : "none";

  const brief: CampaignBrief = {
    id: campaign.id,
    companyId: ctx.company.id,
    name: campaign.name,
    product: productContext.name,
    productContext,
    buyerProfile,
    audience,
    regions,
    channel: campaign.channel,
    channelRequirement,
  };

  const { data: existing } = await admin
    .from("lead_discoveries")
    .select("dedupe_key")
    .eq("campaign_id", id);
  const existingKeys = new Set((existing ?? []).map((e) => e.dedupe_key));

  let result;
  try {
    result = await runDiscovery({ brief, userId: ctx.userId, existingKeys });
  } catch (e) {
    if (e instanceof TavilyError) {
      console.error("[campaigns/discover] tavily", e.code, e.message);
      return NextResponse.json(
        { error: tavilyErrorMessage(e.code), code: e.code },
        { status: 502 },
      );
    }
    console.error("[campaigns/discover] erro", e);
    return NextResponse.json(
      { error: "Não foi possível concluir a busca. Tente novamente." },
      { status: 500 },
    );
  }

  // ── Persistência ──────────────────────────────────────────────────────
  const rows = result.candidates.map((c) => {
    const qualified = c.qualification === "high" || c.qualification === "medium";
    const status = c.competitor ? "rejected" : qualified ? "qualified" : "discovered";
    return {
      company_id: ctx.company.id,
      campaign_id: id,
      company_name: c.companyName,
      legal_name: c.legalName,
      segment: c.segment,
      description: c.description,
      city: c.city,
      state: c.state,
      country: c.country,
      address: c.address,
      phone: c.phone,
      whatsapp: c.whatsapp,
      email: c.email,
      website: c.website,
      instagram: c.instagram,
      source: c.source,
      source_url: c.sourceUrl,
      discovery_query: c.discoveryQuery,
      raw: c.raw as unknown as Json,
      dedupe_key: c.dedupeKey,
      result_type: c.resultType,
      business_type: c.businessType,
      source_quality: c.sourceQuality,
      competitor: c.competitor,
      whatsapp_verified: c.whatsappVerified,
      channel_requirement: channelRequirement,
      score: c.score,
      buyer_fit_score: c.buyerFitScore,
      product_fit_score: c.productFitScore,
      business_fit_score: c.businessFitScore,
      qualification: c.qualification,
      qualification_reason: c.qualificationReason,
      qualification_signals: c.qualificationSignals as unknown as Json,
      evidence: c.evidence as unknown as Json,
      discard_reason: c.discardReason,
      qualified_by: c.qualifiedBy,
      recommended_approach: c.recommendedApproach,
      status,
    };
  });

  let inserted = 0;
  if (rows.length) {
    const { data, error } = await admin
      .from("lead_discoveries")
      .upsert(rows, { onConflict: "campaign_id,dedupe_key", ignoreDuplicates: true })
      .select("id");
    if (error) {
      console.error("[campaigns/discover] insert", error);
      return NextResponse.json(
        { error: "A busca funcionou, mas houve falha ao salvar os resultados." },
        { status: 500 },
      );
    }
    inserted = data?.length ?? 0;
  }

  await admin
    .from("campaigns")
    .update({ last_discovery_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", ctx.company.id);

  return NextResponse.json({
    found: result.candidates.length,
    inserted,
    qualified: rows.filter((r) => r.status === "qualified").length,
    prospectable: result.candidates.filter(
      (c) => !c.competitor && c.whatsappVerified,
    ).length,
    competitors: result.candidates.filter((c) => c.competitor).length,
    noWhatsapp: result.candidates.filter(
      (c) => !c.competitor && !c.whatsappVerified,
    ).length,
    discarded: result.discardedCount,
    discardReasons: result.discardReasons,
    rawResults: result.rawCount,
    queries: result.queries.length,
    aiUsed: result.aiUsed,
    buyerProfileSource: buyerProfile.source,
    buyerSegments: buyerProfile.buyerSegments.slice(0, 8),
  });
}
