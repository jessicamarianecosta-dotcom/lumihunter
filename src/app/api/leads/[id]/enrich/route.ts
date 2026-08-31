import { NextResponse } from "next/server";
import { z } from "zod";
import { tryGetContext, canWrite } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchCnpj, isValidCnpj, onlyDigits } from "@/lib/enrichment/cnpj";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";
import { normalizePhoneBR, normalizeEmail } from "@/lib/utils";

export const maxDuration = 30;

const Body = z.object({ cnpj: z.string().optional() });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await tryGetContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!canWrite(ctx.role))
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const limited = await enforceRateLimit("enrich", ctx.company.id, LIMITS.enrich);
  if (limited) return limited;

  const { cnpj: bodyCnpj } = Body.parse(await req.json().catch(() => ({})));

  const admin = createAdminClient();
  const { data: lead } = await admin
    .from("leads")
    .select("*")
    .eq("id", id)
    .eq("company_id", ctx.company.id)
    .maybeSingle();
  if (!lead) return NextResponse.json({ error: "lead não encontrado" }, { status: 404 });

  const cnpj = onlyDigits(bodyCnpj || lead.cnpj || "");
  if (!isValidCnpj(cnpj))
    return NextResponse.json(
      { error: "Informe um CNPJ válido (14 dígitos)." },
      { status: 400 },
    );

  const data = await fetchCnpj(cnpj);
  if (!data)
    return NextResponse.json(
      { error: "Não foi possível consultar este CNPJ agora." },
      { status: 502 },
    );

  // só preenche campos vazios — nunca sobrescreve o que o usuário já tem
  const patch: Partial<typeof lead> = { cnpj };
  const fieldsUpdated: string[] = [];
  const setIfEmpty = <K extends keyof typeof lead>(
    key: K,
    value: (typeof lead)[K] | null,
  ) => {
    if (value && !lead[key]) {
      patch[key] = value as (typeof lead)[K];
      fieldsUpdated.push(String(key));
    }
  };
  setIfEmpty("legal_name", data.legal_name);
  setIfEmpty("segment", data.segment);
  setIfEmpty("city", data.city);
  setIfEmpty("state", data.state);
  setIfEmpty("address", data.address);
  setIfEmpty("zipcode", data.zipcode);
  setIfEmpty("phone", data.phone);
  setIfEmpty("whatsapp", data.phone ? normalizePhoneBR(data.phone) : null);
  setIfEmpty("email", data.email ? normalizeEmail(data.email) : null);

  await admin.from("leads").update(patch).eq("id", lead.id);

  await admin.from("activities").insert({
    company_id: ctx.company.id,
    lead_id: lead.id,
    actor_id: ctx.userId,
    kind: "system",
    title: "Enriquecido por CNPJ",
    body: `Receita: ${data.legal_name ?? "—"} · ${data.status ?? "—"} · ${data.main_activity ?? "—"}`,
  });

  return NextResponse.json({ ok: true, data, fieldsUpdated });
}
