import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface RateLimitResult {
  allowed: boolean;
  /** Segundos até a janela reabrir (aproximado). */
  retryAfter: number;
}

/**
 * Rate limit por janela deslizante, persistido no Postgres (função
 * `rate_limit_hit`). Em caso de falha de infra, libera a requisição
 * (fail-open) para não derrubar o produto.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("rate_limit_hit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) return { allowed: true, retryAfter: 0 };
    return { allowed: data === true, retryAfter: data === true ? 0 : windowSeconds };
  } catch {
    return { allowed: true, retryAfter: 0 };
  }
}

interface Preset {
  limit: number;
  window: number;
}

/**
 * Aplica o rate limit numa rota. Retorna um `NextResponse` 429 se estourou,
 * ou `null` se pode seguir.
 */
export async function enforceRateLimit(
  scope: string,
  companyId: string,
  preset: Preset,
): Promise<NextResponse | null> {
  const r = await rateLimit(`${scope}:${companyId}`, preset.limit, preset.window);
  if (r.allowed) return null;
  return NextResponse.json(
    { error: "Muitas requisições em pouco tempo. Aguarde alguns instantes." },
    { status: 429, headers: { "Retry-After": String(r.retryAfter) } },
  );
}

/** Presets usados nas rotas. */
export const LIMITS = {
  /** Agentes de IA: 20 execuções / 5 min por empresa. */
  ai: { limit: 20, window: 300 },
  /** Envio de mensagens avulsas: 30 / min por empresa. */
  send: { limit: 30, window: 60 },
  /** Disparo de campanha: 6 lotes / min por empresa. */
  dispatch: { limit: 6, window: 60 },
  /** Enriquecimento CNPJ: 30 / min por empresa. */
  enrich: { limit: 30, window: 60 },
} as const;
