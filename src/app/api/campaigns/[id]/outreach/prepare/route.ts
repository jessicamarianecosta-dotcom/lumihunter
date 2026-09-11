import { NextResponse } from "next/server";
import { tryGetContext, canWrite } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";
import { enforceAiQuota } from "@/lib/limits";
import { prepareMessages, type OutreachLead } from "@/lib/outreach/messages";
import { resolveCampaignCatalogPdf } from "@/lib/outreach/catalog";

export const maxDuration = 120;

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
      "id, channel, product_id, product_text, outreach_base_message, outreach_personalize_ai, outreach_send_catalog, outreach_catalog_pdf_id",
    )
    .eq("id", id)
    .eq("company_id", ctx.company.id)
    .maybeSingle();
  if (!campaign)
    return NextResponse.json({ error: "campanha não encontrada" }, { status: 404 });
  if (campaign.channel !== "whatsapp")
    return NextResponse.json(
      { error: "A fila de WhatsApp só vale para campanhas com canal WhatsApp." },
      { status: 400 },
    );

  // produto foco
  let productName = campaign.product_text?.trim() || "";
  if (!productName && campaign.product_id) {
    const { data: p } = await admin
      .from("products")
      .select("name")
      .eq("id", campaign.product_id)
      .maybeSingle();
    productName = p?.name ?? "";
  }
  if (!productName) {
    return NextResponse.json(
      {
        error: "Defina o produto ou serviço da campanha antes de gerar a abordagem.",
        code: "no_product",
      },
      { status: 400 },
    );
  }

  // catálogo real (itens que a IA pode citar)
  const { data: catalogProducts } = await admin
    .from("products")
    .select("name, keywords")
    .eq("company_id", ctx.company.id)
    .eq("is_active", true)
    .limit(40);
  const catalogItems = (catalogProducts ?? []).map((p) => p.name);
  const catalogKeywords = (catalogProducts ?? []).flatMap((p) => p.keywords ?? []);

  const catalogPdf = campaign.outreach_send_catalog
    ? await resolveCampaignCatalogPdf(
        admin,
        ctx.company.id,
        { outreach_catalog_pdf_id: campaign.outreach_catalog_pdf_id, product_id: campaign.product_id },
        ctx.company.name,
      )
    : null;
  if (campaign.outreach_send_catalog && !catalogPdf) {
    return NextResponse.json(
      {
        error:
          "Esta campanha está configurada para enviar o catálogo, mas nenhum catálogo PDF está disponível em Produtos & Serviços.",
        code: "no_catalog",
      },
      { status: 400 },
    );
  }

  // alvos aprovados (pending/sent) que ainda não têm item na fila
  const { data: targets } = await admin
    .from("campaign_targets")
    .select(
      "id, lead_id, leads(id, name, city, state, segment, description, whatsapp, phone, website, instagram)",
    )
    .eq("campaign_id", id)
    .eq("company_id", ctx.company.id)
    .in("status", ["pending", "sent", "replied"]);

  const { data: existing } = await admin
    .from("outreach_queue")
    .select("campaign_target_id")
    .eq("campaign_id", id);
  const inQueue = new Set((existing ?? []).map((e) => e.campaign_target_id));

  type LeadRow = {
    id: string;
    name: string | null;
    city: string | null;
    state: string | null;
    segment: string | null;
    description: string | null;
    whatsapp: string | null;
    phone: string | null;
    website: string | null;
    instagram: string | null;
  };
  const fresh = (targets ?? []).filter(
    (t) => !inQueue.has(t.id) && !!(t.leads as LeadRow | null)?.whatsapp,
  );
  if (fresh.length === 0)
    return NextResponse.json({ prepared: 0, message: "Nada novo para preparar." });

  // contexto de qualificação (buyer/product fit + evidências) do lead_discoveries
  const leadIds = fresh.map((t) => t.lead_id);
  const { data: discRows } = await admin
    .from("lead_discoveries")
    .select("lead_id, buyer_fit_score, product_fit_score, evidence")
    .eq("company_id", ctx.company.id)
    .in("lead_id", leadIds);
  const discByLead = new Map((discRows ?? []).map((d) => [d.lead_id, d]));

  const outreachLeads: OutreachLead[] = fresh.map((t) => {
    const l = t.leads as LeadRow;
    const d = discByLead.get(t.lead_id);
    return {
      leadId: t.lead_id,
      companyName: l.name ?? "empresa",
      city: l.city,
      state: l.state,
      segment: l.segment,
      contactName: null,
      website: l.website,
      instagram: l.instagram,
      description: l.description,
      evidence: Array.isArray(d?.evidence) ? (d!.evidence as string[]) : [],
      buyerFit: d?.buyer_fit_score ?? null,
      productFit: d?.product_fit_score ?? null,
    };
  });

  const prepared = await prepareMessages({
    companyId: ctx.company.id,
    campaignId: id,
    productName,
    catalogItems,
    catalogKeywords,
    baseMessage: campaign.outreach_base_message,
    personalizeAi: campaign.outreach_personalize_ai,
    leads: outreachLeads,
    userId: ctx.userId,
  });
  const byLead = new Map(prepared.map((m) => [m.leadId, m]));

  const rows = fresh.map((t) => {
    const m = byLead.get(t.lead_id);
    return {
      company_id: ctx.company.id,
      campaign_id: id,
      campaign_target_id: t.id,
      lead_id: t.lead_id,
      status: "draft",
      message_body: m?.body ?? null,
      personalized_by: m?.by ?? "base",
      catalog_included: !!catalogPdf,
      created_by: ctx.userId,
    };
  });

  const { data: inserted, error } = await admin
    .from("outreach_queue")
    .upsert(rows, { onConflict: "campaign_target_id", ignoreDuplicates: true })
    .select("id");
  if (error) {
    console.error("[outreach/prepare] insert", error);
    return NextResponse.json({ error: "Falha ao salvar as mensagens." }, { status: 500 });
  }

  return NextResponse.json({
    prepared: inserted?.length ?? 0,
    aiUsed: prepared.some((m) => m.by === "ai"),
    catalog: catalogPdf?.filename ?? null,
  });
}
