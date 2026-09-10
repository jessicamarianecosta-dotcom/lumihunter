import { NextResponse } from "next/server";
import { tryGetContext, canWrite } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateOperationalCampaign } from "@/lib/prospeccao";

/**
 * Salva os campos da tela única de Prospecção na campanha operacional.
 * A pesquisa em si continua em POST /api/campaigns/[id]/discover.
 */
export async function POST(req: Request) {
  const ctx = await tryGetContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!canWrite(ctx.role))
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    segment?: string;
    regions?: string;
    quantity?: number;
    catalogPdfId?: string | null;
    message?: string;
  };

  const admin = createAdminClient();
  const campaign = await getOrCreateOperationalCampaign(admin, ctx.company.id, ctx.userId);

  const regions = String(body.regions ?? "")
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const quantity = Number(body.quantity);
  const maxOpportunities =
    Number.isFinite(quantity) && quantity >= 10 && quantity <= 2000
      ? Math.round(quantity)
      : 100;

  const { error } = await admin
    .from("campaigns")
    .update({
      audience_text: String(body.segment ?? "").trim() || null,
      segment: String(body.segment ?? "").trim() || null,
      regions,
      city: regions[0] ?? null,
      max_opportunities: maxOpportunities,
      outreach_daily_limit: maxOpportunities,
      outreach_base_message: String(body.message ?? "").trim() || null,
      outreach_catalog_pdf_id:
        String(body.catalogPdfId ?? "").trim() || null,
      status: "active",
      outreach_automatic: true,
    })
    .eq("id", campaign.id)
    .eq("company_id", ctx.company.id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, campaignId: campaign.id });
}
