import { NextResponse } from "next/server";
import { tryGetContext, isAdmin } from "@/lib/auth/context";
import { getIntegrationConfig, type WhatsAppConfig } from "@/lib/integrations/config";

export const maxDuration = 15;

/**
 * Testa a conexão real com a WhatsApp Cloud API: busca os dados do número
 * configurado na Graph API da Meta (não envia nenhuma mensagem).
 */
export async function POST() {
  const ctx = await tryGetContext();
  if (!ctx)
    return NextResponse.json({ ok: false, error: "não autenticado" }, { status: 401 });
  if (!isAdmin(ctx.role))
    return NextResponse.json({ ok: false, error: "sem permissão" }, { status: 403 });

  const cfg = (await getIntegrationConfig<WhatsAppConfig>(ctx.company.id, "whatsapp"))
    ?.config;
  const phoneNumberId = cfg?.phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = cfg?.access_token || process.env.WHATSAPP_ACCESS_TOKEN;
  const apiVersion = cfg?.api_version || process.env.WHATSAPP_API_VERSION || "v21.0";

  if (!phoneNumberId || !token) {
    return NextResponse.json({
      ok: false,
      error:
        "WhatsApp não configurado. Adicione o Phone Number ID e o Access Token nas configurações.",
    });
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}?fields=verified_name,display_phone_number`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = (await res.json()) as {
      verified_name?: string;
      display_phone_number?: string;
      error?: { message?: string };
    };
    if (!res.ok || data.error) {
      return NextResponse.json({
        ok: false,
        error: data.error?.message || `Meta respondeu HTTP ${res.status}`,
      });
    }
    return NextResponse.json({
      ok: true,
      message: `número ${data.display_phone_number ?? phoneNumberId} (${data.verified_name ?? "verificado"})`,
    });
  } catch {
    return NextResponse.json({
      ok: false,
      error: "Falha ao consultar a WhatsApp Cloud API. Verifique as credenciais.",
    });
  }
}
