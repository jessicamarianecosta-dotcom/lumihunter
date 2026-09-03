import { NextResponse } from "next/server";
import { tryGetContext, isAdmin } from "@/lib/auth/context";
import { generateText, resolveActiveAi } from "@/lib/ai";

export const maxDuration = 30;

/** Testa a conexão com o provedor de IA atualmente ativo da empresa. */
export async function POST() {
  const ctx = await tryGetContext();
  if (!ctx)
    return NextResponse.json({ ok: false, error: "não autenticado" }, { status: 401 });
  if (!isAdmin(ctx.role))
    return NextResponse.json({ ok: false, error: "sem permissão" }, { status: 403 });

  const { provider, model, apiKey } = await resolveActiveAi(ctx.company.id);
  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      provider,
      model,
      error:
        provider === "openai"
          ? "OpenAI não configurada. Adicione uma chave da API OpenAI nas configurações."
          : "Anthropic não configurada. Adicione uma chave da API Anthropic nas configurações.",
    });
  }

  try {
    const res = await generateText({
      companyId: ctx.company.id,
      system: "Responda apenas com a palavra: ok",
      prompt: "ok",
      maxTokens: 16,
    });
    return NextResponse.json({ ok: true, provider: res.provider, model: res.model });
  } catch {
    return NextResponse.json({
      ok: false,
      provider,
      model,
      error:
        "Falha ao consultar o provedor de IA. Verifique a chave e tente novamente.",
    });
  }
}
