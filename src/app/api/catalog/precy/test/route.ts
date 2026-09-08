import { NextResponse } from "next/server";
import { z } from "zod";
import { tryGetContext } from "@/lib/auth/context";
import { providerForTest } from "@/lib/catalog/providers";
import { logCatalogEvent } from "@/lib/catalog/sources";

const Body = z.object({ url: z.string().url() });

export async function POST(req: Request) {
  const ctx = await tryGetContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: "URL inválida" }, { status: 400 });

  const provider = providerForTest("precy");
  if (!provider) {
    return NextResponse.json({ ok: false, message: "provedor indisponível" });
  }

  const result = await provider.testConnection({ url: parsed.data.url });
  await logCatalogEvent(ctx.company.id, "precy_test", {
    ok: result.ok,
    host: new URL(parsed.data.url).host,
  });
  return NextResponse.json(result);
}
