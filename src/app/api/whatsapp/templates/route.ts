import { NextResponse } from "next/server";
import { tryGetContext, isAdmin } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listWhatsAppTemplates,
  createProspeccaoTemplate,
} from "@/lib/integrations/whatsapp";
import { OPERATIONAL_CAMPAIGN_NAME } from "@/lib/prospeccao";

export const maxDuration = 20;

const TEMPLATE_NAME = "lumihunter_prospeccao";

async function creds(companyId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("integrations")
    .select("config")
    .eq("company_id", companyId)
    .eq("provider", "whatsapp")
    .maybeSingle();
  const cfg = (data?.config ?? {}) as {
    access_token?: string;
    business_account_id?: string;
  };
  return {
    admin,
    accessToken: cfg.access_token,
    businessAccountId: cfg.business_account_id,
  };
}

/** Lista os templates da WABA e vincula o de prospecção à campanha se aprovado. */
export async function GET() {
  const ctx = await tryGetContext();
  if (!ctx || !isAdmin(ctx.role))
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const { admin, accessToken, businessAccountId } = await creds(ctx.company.id);
  const res = await listWhatsAppTemplates({ accessToken, businessAccountId });
  if (!res.ok) return NextResponse.json(res, { status: 502 });

  const prospeccao = res.templates.find((t) => t.name === TEMPLATE_NAME);
  // vincula automaticamente quando estiver APROVADO; desvincula se sumir/reprovar
  await admin
    .from("campaigns")
    .update({
      outreach_template_name:
        prospeccao?.status === "APPROVED" ? TEMPLATE_NAME : null,
      outreach_template_lang: prospeccao?.language || "pt_BR",
    })
    .eq("company_id", ctx.company.id)
    .eq("name", OPERATIONAL_CAMPAIGN_NAME);

  return NextResponse.json({
    ok: true,
    templates: res.templates,
    prospeccao: prospeccao ?? null,
    linked: prospeccao?.status === "APPROVED",
  });
}

/** Cria (ou reenvia) o template padrão de prospecção da LumiLife. */
export async function POST() {
  const ctx = await tryGetContext();
  if (!ctx || !isAdmin(ctx.role))
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const { accessToken, businessAccountId } = await creds(ctx.company.id);
  const res = await createProspeccaoTemplate({
    accessToken,
    businessAccountId,
    name: TEMPLATE_NAME,
  });
  if (!res.ok) return NextResponse.json(res, { status: 502 });
  return NextResponse.json(res);
}
