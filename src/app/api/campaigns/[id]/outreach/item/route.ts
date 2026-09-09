import { NextResponse } from "next/server";
import { z } from "zod";
import { tryGetContext, canWrite } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";
import { sendNextForCampaign } from "@/lib/outreach/worker";
import { prepareMessages, type OutreachLead } from "@/lib/outreach/messages";

const Body = z.object({
  queueId: z.string().uuid(),
  action: z.enum(["edit", "regenerate", "remove", "send_now"]),
  messageBody: z.string().max(2000).optional(),
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

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: "payload inválido" }, { status: 400 });
  const { queueId, action, messageBody } = parsed.data;

  const admin = createAdminClient();
  const { data: item } = await admin
    .from("outreach_queue")
    .select("id, lead_id, status")
    .eq("id", queueId)
    .eq("campaign_id", id)
    .eq("company_id", ctx.company.id)
    .maybeSingle();
  if (!item)
    return NextResponse.json({ error: "item não encontrado" }, { status: 404 });

  if (action === "remove") {
    if (["sent", "delivered", "read", "replied"].includes(item.status))
      return NextResponse.json(
        { error: "Não é possível remover um item já enviado." },
        { status: 400 },
      );
    await admin.from("outreach_queue").update({ status: "cancelled" }).eq("id", queueId);
    return NextResponse.json({ ok: true });
  }

  if (action === "edit") {
    if (!messageBody?.trim())
      return NextResponse.json({ error: "mensagem vazia" }, { status: 400 });
    await admin
      .from("outreach_queue")
      .update({ message_body: messageBody.trim(), personalized_by: "manual" })
      .eq("id", queueId)
      .in("status", ["draft", "ready", "scheduled", "failed"]);
    return NextResponse.json({ ok: true });
  }

  if (action === "regenerate") {
    const limited = await enforceRateLimit("ai", ctx.company.id, LIMITS.ai);
    if (limited) return limited;

    const { data: campaign } = await admin
      .from("campaigns")
      .select("product_id, product_text, outreach_base_message, outreach_personalize_ai")
      .eq("id", id)
      .maybeSingle();
    const { data: lead } = await admin
      .from("leads")
      .select("id, name, city, state, segment, website, instagram")
      .eq("id", item.lead_id)
      .eq("company_id", ctx.company.id)
      .maybeSingle();
    if (!campaign || !lead)
      return NextResponse.json({ error: "dados insuficientes" }, { status: 400 });

    let productName = campaign.product_text?.trim() || "";
    if (!productName && campaign.product_id) {
      const { data: p } = await admin
        .from("products")
        .select("name")
        .eq("id", campaign.product_id)
        .maybeSingle();
      productName = p?.name ?? "";
    }
    const { data: catalogProducts } = await admin
      .from("products")
      .select("name, keywords")
      .eq("company_id", ctx.company.id)
      .eq("is_active", true)
      .limit(40);
    const { data: disc } = await admin
      .from("lead_discoveries")
      .select("buyer_fit_score, product_fit_score, evidence")
      .eq("lead_id", item.lead_id)
      .eq("company_id", ctx.company.id)
      .limit(1)
      .maybeSingle();

    const ol: OutreachLead = {
      leadId: lead.id,
      companyName: lead.name ?? "empresa",
      city: lead.city,
      state: lead.state,
      segment: lead.segment,
      contactName: null,
      website: lead.website,
      instagram: lead.instagram,
      evidence: Array.isArray(disc?.evidence) ? (disc!.evidence as string[]) : [],
      buyerFit: disc?.buyer_fit_score ?? null,
      productFit: disc?.product_fit_score ?? null,
    };
    const [prepared] = await prepareMessages({
      companyId: ctx.company.id,
      campaignId: id,
      productName: productName || "materiais gráficos e personalizados",
      catalogItems: (catalogProducts ?? []).map((p) => p.name),
      catalogKeywords: (catalogProducts ?? []).flatMap((p) => p.keywords ?? []),
      baseMessage: campaign.outreach_base_message,
      personalizeAi: campaign.outreach_personalize_ai,
      leads: [ol],
      userId: ctx.userId,
    });
    await admin
      .from("outreach_queue")
      .update({ message_body: prepared.body, personalized_by: prepared.by })
      .eq("id", queueId)
      .in("status", ["draft", "ready", "scheduled", "failed"]);
    return NextResponse.json({ ok: true, message: prepared.body, by: prepared.by });
  }

  // send_now — envia este item imediatamente, ignorando janela/intervalo, mas
  // mantendo TODOS os checks de elegibilidade/opt-out.
  const limited = await enforceRateLimit("send", ctx.company.id, LIMITS.send);
  if (limited) return limited;
  await admin
    .from("outreach_queue")
    .update({ status: "ready", scheduled_at: new Date().toISOString() })
    .eq("id", queueId)
    .in("status", ["draft", "ready", "scheduled", "failed"]);
  const outcome = await sendNextForCampaign(admin, id, {
    manual: true,
    manualQueueId: queueId,
  });
  return NextResponse.json(outcome);
}
