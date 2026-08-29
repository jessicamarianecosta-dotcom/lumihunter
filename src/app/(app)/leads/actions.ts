"use server";

import { revalidatePath } from "next/cache";
import { getAppContext, canWrite } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import type { LeadStatus } from "@/lib/supabase/database.types";

export async function moveLeadToStage(leadId: string, stageId: string) {
  const ctx = await getAppContext();
  if (!canWrite(ctx.role)) throw new Error("sem permissão");
  const supabase = await createClient();

  const { data: stage } = await supabase
    .from("pipeline_stages")
    .select("slug, is_won, is_lost")
    .eq("id", stageId)
    .eq("company_id", ctx.company.id)
    .maybeSingle();

  const status: LeadStatus | undefined = stage?.is_won
    ? "won"
    : stage?.is_lost
      ? "lost"
      : (stage?.slug as LeadStatus | undefined);

  await supabase
    .from("leads")
    .update({ stage_id: stageId, ...(status ? { status } : {}) })
    .eq("id", leadId)
    .eq("company_id", ctx.company.id);

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
}

export async function addLeadNote(leadId: string, body: string) {
  const ctx = await getAppContext();
  if (!canWrite(ctx.role)) throw new Error("sem permissão");
  if (!body.trim()) return;
  const supabase = await createClient();

  await supabase.from("notes").insert({
    company_id: ctx.company.id,
    lead_id: leadId,
    author_id: ctx.userId,
    body: body.trim(),
  });
  await supabase.from("activities").insert({
    company_id: ctx.company.id,
    lead_id: leadId,
    actor_id: ctx.userId,
    kind: "note",
    body: body.trim(),
  });
  revalidatePath(`/leads/${leadId}`);
}

export async function archiveLead(leadId: string) {
  const ctx = await getAppContext();
  if (!canWrite(ctx.role)) throw new Error("sem permissão");
  const supabase = await createClient();
  await supabase
    .from("leads")
    .update({ is_archived: true })
    .eq("id", leadId)
    .eq("company_id", ctx.company.id);
  revalidatePath("/leads");
}

export async function createManualLead(formData: FormData) {
  const ctx = await getAppContext();
  if (!canWrite(ctx.role)) throw new Error("sem permissão");
  const supabase = await createClient();

  const { data: stage } = await supabase
    .from("pipeline_stages")
    .select("id")
    .eq("company_id", ctx.company.id)
    .eq("slug", "new")
    .maybeSingle();

  await supabase.from("leads").insert({
    company_id: ctx.company.id,
    stage_id: stage?.id ?? null,
    source: "manual",
    owner_id: ctx.userId,
    name: String(formData.get("name") || "").trim(),
    segment: String(formData.get("segment") || "") || null,
    city: String(formData.get("city") || "") || null,
    state: String(formData.get("state") || "") || null,
    whatsapp: String(formData.get("whatsapp") || "") || null,
    email: String(formData.get("email") || "") || null,
    website: String(formData.get("website") || "") || null,
    instagram: String(formData.get("instagram") || "") || null,
  });
  revalidatePath("/leads");
}
