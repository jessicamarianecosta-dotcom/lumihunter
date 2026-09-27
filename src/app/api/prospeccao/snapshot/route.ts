import { NextResponse } from "next/server";
import { tryGetContext } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateOperationalCampaign, getProspeccaoSnapshot } from "@/lib/prospeccao";

/** Snapshot da campanha operacional — usado pelo polling client-side da tela de Prospecção. */
export async function GET() {
  const ctx = await tryGetContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const admin = createAdminClient();
  const campaign = await getOrCreateOperationalCampaign(admin, ctx.company.id, ctx.userId);
  const snapshot = await getProspeccaoSnapshot(admin, ctx.company.id, campaign);

  const regionsLabel = (campaign.regions ?? []).join(", ");
  const campaignName = [campaign.audience_text, regionsLabel].filter(Boolean).join(" — ") || "Prospecção";

  return NextResponse.json({
    campaignId: campaign.id,
    runId: campaign.current_discovery_run_id,
    campaignName,
    ...snapshot,
  });
}
