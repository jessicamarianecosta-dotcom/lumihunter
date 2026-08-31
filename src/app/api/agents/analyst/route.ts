import { NextResponse } from "next/server";
import { tryGetContext } from "@/lib/auth/context";
import { runAnalyst } from "@/lib/anthropic/agents/analyst";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";
import { enforceAiQuota } from "@/lib/limits";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

export async function POST(req: Request) {
  const ctx = await tryGetContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const limited = await enforceRateLimit("ai", ctx.company.id, LIMITS.ai);
  if (limited) return limited;

  const quota = await enforceAiQuota(createAdminClient(), ctx.company.id);
  if (quota) return quota;

  const body = (await req.json().catch(() => ({}))) as {
    metrics?: Record<string, unknown>;
  };

  const insights = await runAnalyst({
    companyId: ctx.company.id,
    metrics: body.metrics ?? {},
    userId: ctx.userId,
  });

  return NextResponse.json({ insights });
}
