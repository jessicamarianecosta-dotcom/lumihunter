import { NextResponse } from "next/server";
import { z } from "zod";
import { tryGetContext, canWrite } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";
import { approveDiscoveries, enqueueOutreach } from "@/lib/outreach/promote";

export const maxDuration = 120;

const Body = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  action: z.enum(["approve", "reject"]).default("approve"),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await tryGetContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!canWrite(ctx.role))
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const limited = await enforceRateLimit("dispatch", ctx.company.id, LIMITS.dispatch);
  if (limited) return limited;

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: "payload inválido" }, { status: 400 });
  const { ids, action } = parsed.data;

  const admin = createAdminClient();

  // ── Rejeitar ───────────────────────────────────────────────────────────
  if (action === "reject") {
    const { data } = await admin
      .from("lead_discoveries")
      .update({ status: "rejected", rejected_at: new Date().toISOString() })
      .eq("company_id", ctx.company.id)
      .eq("campaign_id", id)
      .in("id", ids)
      .neq("status", "approved")
      .select("id");
    return NextResponse.json({ rejected: data?.length ?? 0 });
  }

  // ── Aprovar → cria/vincula lead + campaign_target ──────────────────────
  const promo = await approveDiscoveries(admin, {
    companyId: ctx.company.id,
    campaignId: id,
    userId: ctx.userId,
    discoveryIds: ids,
  });
  if (promo.quotaError)
    return NextResponse.json({ error: promo.quotaError, code: "lead_quota" }, { status: 402 });

  // Campanha automática → já enfileira a abordagem (sem outra etapa manual).
  const { data: campaign } = await admin
    .from("campaigns")
    .select(
      "id, name, channel, status, regions, product_id, product_text, outreach_automatic, outreach_status, outreach_base_message, outreach_personalize_ai, outreach_send_catalog, outreach_catalog_pdf_id",
    )
    .eq("id", id)
    .eq("company_id", ctx.company.id)
    .maybeSingle();

  let enqueued = 0;
  if (
    campaign?.outreach_automatic &&
    campaign.channel === "whatsapp" &&
    campaign.status === "active" &&
    campaign.outreach_status !== "paused" &&
    promo.promoted.length > 0
  ) {
    const enq = await enqueueOutreach(admin, {
      companyId: ctx.company.id,
      companyName: ctx.company.name,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        channel: campaign.channel,
        status: campaign.status,
        product_id: campaign.product_id,
        product_text: campaign.product_text,
        outreach_automatic: campaign.outreach_automatic,
        outreach_base_message: campaign.outreach_base_message,
        outreach_personalize_ai: campaign.outreach_personalize_ai,
        outreach_send_catalog: campaign.outreach_send_catalog,
        outreach_catalog_pdf_id: campaign.outreach_catalog_pdf_id,
        regions: campaign.regions,
      },
      userId: ctx.userId,
      promoted: promo.promoted,
      auto: true,
    });
    enqueued = enq.enqueued;
    if (enqueued > 0) {
      await admin
        .from("campaigns")
        .update({
          outreach_status: "running",
          outreach_started_at: new Date().toISOString(),
          outreach_consecutive_errors: 0,
        })
        .eq("id", id)
        .eq("company_id", ctx.company.id);
    }
  }

  return NextResponse.json({
    approved: promo.approved,
    leadsCreated: promo.leadsCreated,
    targetsCreated: promo.targetsCreated,
    enqueued,
  });
}
