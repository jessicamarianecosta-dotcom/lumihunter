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

const CAMPAIGN_STATUSES = new Set([
  "draft",
  "active",
  "paused",
  "completed",
  "archived",
]);

/** Edição completa da campanha (nome, produto, público, região, canal, status). */
export async function updateCampaign(campaignId: string, formData: FormData) {
  const ctx = await getAppContext();
  if (!canWrite(ctx.role)) throw new Error("sem permissão");
  const supabase = await createClient();

  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("nome obrigatório");

  const regions = String(formData.get("regions") || "")
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const productId = String(formData.get("product_id") || "").trim();
  const channel =
    (String(formData.get("channel")) as "whatsapp" | "email") || "whatsapp";
  const statusRaw = String(formData.get("status") || "").trim();
  const status = CAMPAIGN_STATUSES.has(statusRaw) ? statusRaw : "draft";

  await supabase
    .from("campaigns")
    .update({
      name,
      product_id: productId || null,
      product_text: String(formData.get("product_text") || "").trim() || null,
      audience_text: String(formData.get("audience_text") || "").trim() || null,
      regions,
      city: regions[0] ?? null,
      channel,
      status: status as never,
      outreach_automatic: formData.get("outreach_automatic") === "on",
      max_opportunities: (() => {
        const n = Number(formData.get("max_opportunities"));
        return Number.isFinite(n) && n >= 10 && n <= 5000 ? Math.round(n) : 250;
      })(),
      ...(status === "active" && !formData.get("was_active")
        ? { started_at: new Date().toISOString() }
        : {}),
    })
    .eq("id", campaignId)
    .eq("company_id", ctx.company.id);

  revalidatePath(`/campanhas/${campaignId}`);
}

export async function saveOutreachSettings(campaignId: string, formData: FormData) {
  const ctx = await getAppContext();
  if (!canWrite(ctx.role)) throw new Error("sem permissão");
  const supabase = await createClient();

  const num = (k: string, min: number, max: number, def: number) => {
    const n = Number(formData.get(k));
    return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : def;
  };
  const time = (k: string, def: string) => {
    const v = String(formData.get(k) || "");
    return /^\d{2}:\d{2}$/.test(v) ? v : def;
  };

  await supabase
    .from("campaigns")
    .update({
      outreach_base_message:
        String(formData.get("base_message") || "").trim() || null,
      outreach_daily_limit: num("daily_limit", 1, 500, 20),
      outreach_window_start: time("window_start", "09:00"),
      outreach_window_end: time("window_end", "18:00"),
      outreach_min_interval_seconds: num("min_interval", 5, 3600, 30),
      outreach_personalize_ai: formData.get("personalize_ai") === "on",
      outreach_send_catalog: formData.get("send_catalog") === "on",
      outreach_catalog_pdf_id:
        String(formData.get("catalog_pdf_id") || "").trim() || null,
    })
    .eq("id", campaignId)
    .eq("company_id", ctx.company.id);

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
