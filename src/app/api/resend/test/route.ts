import { NextResponse } from "next/server";
import { tryGetContext, isAdmin } from "@/lib/auth/context";
import { getIntegrationConfig, type ResendConfig } from "@/lib/integrations/config";

export const maxDuration = 15;

/**
 * Testa a conexão real com a Resend: lista os domínios da conta (não envia
 * nenhum e-mail). Confirma também se o remetente configurado está em um
 * domínio verificado.
 */
export async function POST() {
  const ctx = await tryGetContext();
  if (!ctx)
    return NextResponse.json({ ok: false, error: "não autenticado" }, { status: 401 });
  if (!isAdmin(ctx.role))
    return NextResponse.json({ ok: false, error: "sem permissão" }, { status: 403 });

  const cfg = (await getIntegrationConfig<ResendConfig>(ctx.company.id, "resend"))
    ?.config;
  const apiKey = cfg?.api_key || process.env.RESEND_API_KEY;
  const fromEmail = cfg?.from_email || process.env.RESEND_FROM_EMAIL;

  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      error: "Resend não configurada. Adicione a chave da API nas configurações.",
    });
  }

  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = (await res.json()) as {
      data?: { name: string; status: string }[];
      message?: string;
    };
    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        error: data.message || `Resend respondeu HTTP ${res.status}`,
      });
    }
    const domains = data.data ?? [];
    const fromDomain = fromEmail?.split("@")[1];
    const verified = domains.find(
      (d) => d.name === fromDomain && d.status === "verified",
    );
    if (fromEmail && !verified) {
      return NextResponse.json({
        ok: false,
        error: `Chave válida, mas o domínio de "${fromEmail}" ainda não está verificado no Resend.`,
      });
    }
    return NextResponse.json({
      ok: true,
      message: fromEmail
        ? `remetente ${fromEmail} verificado`
        : `chave válida (${domains.length} domínio(s) na conta)`,
    });
  } catch {
    return NextResponse.json({
      ok: false,
      error: "Falha ao consultar a API da Resend. Verifique a chave.",
    });
  }
}
