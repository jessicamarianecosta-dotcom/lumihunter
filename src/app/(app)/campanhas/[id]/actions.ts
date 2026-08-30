"use server";

import { revalidatePath } from "next/cache";
import { getAppContext, canWrite } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

export async function addCampaignTargets(campaignId: string) {
  const ctx = await getAppContext();
  if (!canWrite(ctx.role)) throw new Error("sem permissão");
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, segment, city, target_count")
    .eq("id", campaignId)
    .eq("company_id", ctx.company.id)
    .maybeSingle();
  if (!campaign) throw new Error("campanha não encontrada");

  let q = supabase
    .from("leads")
    .select("id")
    .eq("company_id", ctx.company.id)
    .eq("is_archived", false)
    .not("status", "in", "(won,lost)");
  if (campaign.segment) q = q.ilike("segment", `%${campaign.segment}%`);
  if (campaign.city) q = q.ilike("city", `%${campaign.city}%`);
  const { data: leads } = await q.limit(Math.max(campaign.target_count || 50, 50));

  const { data: existing } = await supabase
    .from("campaign_targets")
    .select("lead_id")
    .eq("campaign_id", campaignId);
  const have = new Set((existing ?? []).map((e) => e.lead_id));

  const rows = (leads ?? [])
    .filter((l) => !have.has(l.id))
    .map((l) => ({
      company_id: ctx.company.id,
      campaign_id: campaignId,
      lead_id: l.id,
      status: "pending",
    }));
  if (rows.length) await supabase.from("campaign_targets").insert(rows);

  revalidatePath(`/campanhas/${campaignId}`);
}

export async function setCampaignStatus(campaignId: string, status: string) {
  const ctx = await getAppContext();
  if (!canWrite(ctx.role)) throw new Error("sem permissão");
  const supabase = await createClient();
  await supabase
    .from("campaigns")
    .update({
      status: status as never,
      ...(status === "active" ? { started_at: new Date().toISOString() } : {}),
    })
    .eq("id", campaignId)
    .eq("company_id", ctx.company.id);
  revalidatePath(`/campanhas/${campaignId}`);
}
