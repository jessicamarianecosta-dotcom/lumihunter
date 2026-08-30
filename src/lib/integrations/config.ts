import { createAdminClient } from "@/lib/supabase/admin";

export interface WhatsAppConfig {
  access_token?: string;
  phone_number_id?: string;
  business_account_id?: string;
  api_version?: string;
  webhook_verify_token?: string;
}

export interface ResendConfig {
  api_key?: string;
  from_email?: string;
  domain?: string;
}

/** Lê a config de integração da empresa (fallback: undefined -> usa env vars). */
export async function getIntegrationConfig<T>(
  companyId: string,
  provider: "whatsapp" | "resend",
): Promise<{ connected: boolean; config: T } | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("integrations")
    .select("is_connected, config")
    .eq("company_id", companyId)
    .eq("provider", provider)
    .maybeSingle();
  if (!data) return null;
  return { connected: data.is_connected, config: (data.config ?? {}) as T };
}
