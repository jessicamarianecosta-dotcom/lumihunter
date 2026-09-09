import { NextResponse } from "next/server";
import { tryGetContext, canWrite } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";
import { enforceAiQuota } from "@/lib/limits";
import {
  runDiscovery,
  discoverySourcesConfigured,
  TavilyError,
  tavilyErrorMessage,
  type CampaignBrief,
} from "@/lib/discovery";

export const maxDuration = 300;

const QUALIFIED_BAR = 45;

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

  // ── Campanha (isolada por empresa) ──────────────────────────────────────
  const { data: campaign } = await admin
    .from("campaigns")
    .select(
      "id, name, channel, product_text, audience_text, regions, segment, city, goal, product_id",
    )
    .eq("id", id)
    .eq("company_id", ctx.company.id)
    .maybeSingle();
  if (!campaign)
    return NextResponse.json({ error: "campanha não encontrada" }, { status: 404 });

  // produto: texto livre > produto do catálogo > objetivo
  let product = campaign.product_text?.trim() || "";
  if (!product && campaign.product_id) {
    const { data: p } = await admin
      .from("products")
      .select("name, description")
      .eq("id", campaign.product_id)
      .eq("company_id", ctx.company.id)
      .maybeSingle();
    if (p) product = [p.name, p.description].filter(Boolean).join(" — ");
  }
  if (!product) product = campaign.goal?.trim() || "";

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
  if (!product) missing.push("produto/serviço");
  if (!audience) missing.push("público-alvo");
  if (regions.length === 0) missing.push("região");
  if (missing.length) {
    return NextResponse.json(
      {
        error: `Antes de buscar, defina ${missing.join(", ")} nesta campanha.`,
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

  const brief: CampaignBrief = {
    id: campaign.id,
    companyId: ctx.company.id,
    name: campaign.name,
    product,
    audience,
    regions,
    channel: campaign.channel,
  };

  // ── Chaves de dedupe já existentes nesta campanha ──────────────────────
  const { data: existing } = await admin
    .from("lead_discoveries")
    .select("dedupe_key")
    .eq("campaign_id", id);
  const existingKeys = new Set((existing ?? []).map((e) => e.dedupe_key));

  // ── Descoberta ────────────────────────────────────────────────────────
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

  // ── Persistência em lead_discoveries ───────────────────────────────────
  const rows = result.candidates.map((c) => ({
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
    score: c.score,
    qualification: c.qualification,
    qualification_reason: c.qualificationReason,
    qualification_signals: c.qualificationSignals as unknown as Json,
    qualified_by: c.qualifiedBy,
    recommended_approach: c.recommendedApproach,
    status: c.score >= QUALIFIED_BAR ? "qualified" : "discovered",
  }));

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
    discarded: result.discardedCount,
    rawResults: result.rawCount,
    queries: result.queries.length,
    aiUsed: result.aiUsed,
  });
}
