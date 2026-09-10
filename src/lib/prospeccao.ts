/**
 * Camada da tela única de Prospecção (MVP simples).
 *
 * O LumiHunter opera sobre UMA campanha operacional por empresa. A usuária
 * só escolhe segmento, região, quantidade, catálogo e mensagem, e clica em
 * "Pesquisar e abordar". Todos os números da tela saem DAQUI — mesma fonte,
 * sem "10 aprovados / 0 leads".
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Admin = SupabaseClient<Database>;

export const OPERATIONAL_CAMPAIGN_NAME = "Prospecção LumiHunter";

const DEFAULT_PRODUCT_TEXT =
  "Materiais gráficos e personalizados da LumiLife: adesivos, rótulos, " +
  "etiquetas, cartões, tags, banners, placas, embalagens, sacolas, canecas, " +
  "DTF, brindes e comunicação visual para empresas.";

export interface OperationalCampaign {
  id: string;
  audience_text: string | null;
  regions: string[] | null;
  max_opportunities: number | null;
  outreach_base_message: string | null;
  outreach_catalog_pdf_id: string | null;
  outreach_status: string | null;
  current_discovery_run_id: string | null;
  last_discovery_at: string | null;
}

/**
 * Devolve a campanha operacional da empresa, criando-a na primeira vez.
 * É idempotente: se já existe (por nome), reaproveita.
 */
export async function getOrCreateOperationalCampaign(
  admin: Admin,
  companyId: string,
  userId: string,
): Promise<OperationalCampaign> {
  const cols =
    "id, audience_text, regions, max_opportunities, outreach_base_message, " +
    "outreach_catalog_pdf_id, outreach_status, current_discovery_run_id, last_discovery_at";

  const { data: existing } = await admin
    .from("campaigns")
    .select(cols)
    .eq("company_id", companyId)
    .eq("name", OPERATIONAL_CAMPAIGN_NAME)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing) return existing as unknown as OperationalCampaign;

  const { data: created, error } = await admin
    .from("campaigns")
    .insert({
      company_id: companyId,
      name: OPERATIONAL_CAMPAIGN_NAME,
      channel: "whatsapp",
      status: "active",
      product_text: DEFAULT_PRODUCT_TEXT,
      outreach_automatic: true,
      outreach_send_catalog: true,
      outreach_personalize_ai: true,
      outreach_daily_limit: 100,
      outreach_window_start: "09:00",
      outreach_window_end: "18:00",
      outreach_min_interval_seconds: 30,
      max_opportunities: 100,
      created_by: userId,
    })
    .select(cols)
    .single();
  if (error || !created) {
    throw new Error(`não foi possível preparar a prospecção: ${error?.message}`);
  }
  return created as unknown as OperationalCampaign;
}

export interface ProspeccaoSnapshot {
  /** empresas encontradas na última pesquisa */
  found: number;
  /** com WhatsApp comercial confirmado */
  withWhatsapp: number;
  /** contatos novos (ainda não abordados) */
  fresh: number;
  /** abordados hoje (mensagem saiu de verdade) */
  approachedToday: number;
  /** clientes que responderam e precisam de atendimento */
  replies: number;
  running: boolean;
  lastSearchAt: string | null;
}

/** Contadores da tela — todos derivados dos mesmos registros reais. */
export async function getProspeccaoSnapshot(
  admin: Admin,
  companyId: string,
  campaign: OperationalCampaign,
): Promise<ProspeccaoSnapshot> {
  const runId = campaign.current_discovery_run_id;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [discoveries, approachedToday, replies] = await Promise.all([
    runId
      ? admin
          .from("lead_discoveries")
          .select("whatsapp_verified, status")
          .eq("company_id", companyId)
          .eq("discovery_run_id", runId)
      : Promise.resolve({ data: [] as { whatsapp_verified: boolean | null; status: string }[] }),
    admin
      .from("outreach_queue")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("campaign_id", campaign.id)
      .in("status", ["sent", "delivered", "read", "replied"])
      .gte("sent_at", startOfDay.toISOString()),
    admin
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("needs_attention", true),
  ]);

  const rows = discoveries.data ?? [];
  const found = rows.length;
  const withWhatsapp = rows.filter((r) => r.whatsapp_verified).length;
  const fresh = rows.filter((r) => r.status === "qualified").length;

  return {
    found,
    withWhatsapp,
    fresh,
    approachedToday: approachedToday.count ?? 0,
    replies: replies.count ?? 0,
    running: campaign.outreach_status === "running",
    lastSearchAt: campaign.last_discovery_at,
  };
}
