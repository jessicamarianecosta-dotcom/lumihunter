import { NextResponse } from "next/server";
import { z } from "zod";
import { tryGetContext, canWrite } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";
import { checkLeadQuota } from "@/lib/limits";
import { hostOf } from "@/lib/discovery/extract";

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

  const { data: discoveries } = await admin
    .from("lead_discoveries")
    .select("*")
    .eq("company_id", ctx.company.id)
    .eq("campaign_id", id)
    .in("id", ids);

  const list = discoveries ?? [];
  if (list.length === 0)
    return NextResponse.json({ error: "nenhuma descoberta encontrada" }, { status: 404 });

  // ── Rejeitar ───────────────────────────────────────────────────────────
  if (action === "reject") {
    const targetIds = list
      .filter((d) => d.status !== "approved")
      .map((d) => d.id);
    if (targetIds.length) {
      await admin
        .from("lead_discoveries")
        .update({ status: "rejected", rejected_at: new Date().toISOString() })
        .in("id", targetIds);
    }
    return NextResponse.json({ rejected: targetIds.length });
  }

  // ── Aprovar → cria/vincula lead + campaign_target ──────────────────────
  const pending = list.filter((d) => d.status !== "approved");
  if (pending.length === 0)
    return NextResponse.json({ approved: 0, leadsCreated: 0, alreadyApproved: list.length });

  // leads existentes da empresa para deduplicar
  const { data: existingLeads } = await admin
    .from("leads")
    .select("id, name, website, phone, whatsapp, city")
    .eq("company_id", ctx.company.id);

  const byDomain = new Map<string, string>();
  const byPhone = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const l of existingLeads ?? []) {
    if (l.website) byDomain.set(hostOf(l.website), l.id);
    for (const p of [l.phone, l.whatsapp]) {
      const digits = (p ?? "").replace(/\D/g, "");
      if (digits.length >= 10) byPhone.set(digits, l.id);
    }
    byName.set(
      `${l.name.trim().toLowerCase()}|${(l.city ?? "").trim().toLowerCase()}`,
      l.id,
    );
  }

  function findExistingLead(d: (typeof pending)[number]): string | null {
    if (d.website) {
      const hit = byDomain.get(hostOf(d.website));
      if (hit) return hit;
    }
    for (const p of [d.whatsapp, d.phone]) {
      const digits = (p ?? "").replace(/\D/g, "");
      if (digits.length >= 10 && byPhone.has(digits)) return byPhone.get(digits)!;
    }
    const nameKey = `${d.company_name.trim().toLowerCase()}|${(d.city ?? "").trim().toLowerCase()}`;
    return byName.get(nameKey) ?? null;
  }

  const willCreate = pending.filter((d) => !findExistingLead(d)).length;
  if (willCreate > 0) {
    const q = await checkLeadQuota(admin, ctx.company.id, willCreate);
    if (!q.ok)
      return NextResponse.json({ error: q.message, code: "lead_quota" }, { status: 402 });
  }

  const { data: stage } = await admin
    .from("pipeline_stages")
    .select("id")
    .eq("company_id", ctx.company.id)
    .eq("slug", "new")
    .maybeSingle();

  let approved = 0;
  let leadsCreated = 0;
  let targetsCreated = 0;

  for (const d of pending) {
    let leadId = findExistingLead(d);

    if (!leadId) {
      const { data: created, error } = await admin
        .from("leads")
        .insert({
          company_id: ctx.company.id,
          stage_id: stage?.id ?? null,
          status: "new",
          source: "discovery",
          name: d.company_name,
          legal_name: d.legal_name,
          segment: d.segment,
          description: d.description,
          city: d.city,
          state: d.state,
          address: d.address,
          phone: d.phone,
          whatsapp: d.whatsapp,
          email: d.email,
          website: d.website,
          instagram: d.instagram,
          notes: d.source_url ? `Descoberto via ${d.source}: ${d.source_url}` : null,
          score: d.score,
          score_reason: d.qualification_reason,
          score_factors: d.qualification_signals,
          ai_summary: d.qualification_reason,
        })
        .select("id")
        .single();
      if (error || !created) {
        console.error("[discoveries/approve] lead insert", error);
        continue;
      }
      leadId = created.id;
      leadsCreated++;
      // registra na dedupe local para as próximas iterações do lote
      if (d.website) byDomain.set(hostOf(d.website), leadId);
      byName.set(
        `${d.company_name.trim().toLowerCase()}|${(d.city ?? "").trim().toLowerCase()}`,
        leadId,
      );
    }

    // campaign_target (idempotente pelo unique campaign_id+lead_id)
    const { data: existingTarget } = await admin
      .from("campaign_targets")
      .select("id")
      .eq("campaign_id", id)
      .eq("lead_id", leadId)
      .maybeSingle();
    if (!existingTarget) {
      const { error: tErr } = await admin.from("campaign_targets").insert({
        company_id: ctx.company.id,
        campaign_id: id,
        lead_id: leadId,
        status: "pending",
      });
      if (!tErr) targetsCreated++;
    }

    await admin
      .from("lead_discoveries")
      .update({
        status: "approved",
        lead_id: leadId,
        approved_at: new Date().toISOString(),
        approved_by: ctx.userId,
      })
      .eq("id", d.id);
    approved++;
  }

  return NextResponse.json({
    approved,
    leadsCreated,
    targetsCreated,
    alreadyApproved: list.length - pending.length,
  });
}
