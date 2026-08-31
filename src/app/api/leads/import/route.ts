import { NextResponse } from "next/server";
import { z } from "zod";
import { tryGetContext, canWrite } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkLeadQuota } from "@/lib/limits";
import { normalizePhoneBR, normalizeEmail } from "@/lib/utils";

export const maxDuration = 60;

const Body = z.object({
  rows: z.array(z.record(z.string())).max(2000),
});

const ALIASES: Record<string, string> = {
  nome: "name",
  empresa: "name",
  razao_social: "legal_name",
  "razão_social": "legal_name",
  segmento: "segment",
  ramo: "segment",
  cidade: "city",
  uf: "state",
  estado: "state",
  telefone: "phone",
  fone: "phone",
  "e-mail": "email",
  site: "website",
  observacoes: "notes",
  "observações": "notes",
};

function pick(row: Record<string, string>, key: string): string {
  for (const [k, v] of Object.entries(row)) {
    const norm = ALIASES[k] ?? k;
    if (norm === key && v?.trim()) return v.trim();
  }
  return "";
}

export async function POST(req: Request) {
  const ctx = await tryGetContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!canWrite(ctx.role))
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: "payload inválido" }, { status: 400 });

  const admin = createAdminClient();

  const candidates = parsed.data.rows
    .map((row) => ({
      name: pick(row, "name"),
      legal_name: pick(row, "legal_name") || null,
      cnpj: pick(row, "cnpj").replace(/\D/g, "") || null,
      segment: pick(row, "segment") || null,
      city: pick(row, "city") || null,
      state: (pick(row, "state") || null)?.slice(0, 2)?.toUpperCase() ?? null,
      phone: pick(row, "phone") || null,
      whatsapp: normalizePhoneBR(pick(row, "whatsapp") || pick(row, "phone")),
      email: normalizeEmail(pick(row, "email")),
      website: pick(row, "website") || null,
      instagram: pick(row, "instagram") || null,
      notes: pick(row, "notes") || null,
    }))
    .filter((r) => r.name);

  if (candidates.length === 0)
    return NextResponse.json(
      { error: "Nenhuma linha com a coluna 'nome' preenchida." },
      { status: 400 },
    );

  const quota = await checkLeadQuota(admin, ctx.company.id, candidates.length);
  if (!quota.ok)
    return NextResponse.json({ error: quota.message }, { status: 402 });

  // dedupe contra o que já existe (por nome)
  const { data: existing } = await admin
    .from("leads")
    .select("name")
    .eq("company_id", ctx.company.id);
  const seen = new Set((existing ?? []).map((e) => e.name.trim().toLowerCase()));

  const { data: stage } = await admin
    .from("pipeline_stages")
    .select("id")
    .eq("company_id", ctx.company.id)
    .eq("slug", "new")
    .maybeSingle();

  const rows = candidates
    .filter((r) => !seen.has(r.name.trim().toLowerCase()))
    .map((r) => ({
      ...r,
      company_id: ctx.company.id,
      stage_id: stage?.id ?? null,
      status: "new" as const,
      source: "import",
    }));

  let inserted = 0;
  if (rows.length) {
    const { data, error } = await admin.from("leads").insert(rows).select("id");
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    inserted = data?.length ?? 0;
  }

  return NextResponse.json({
    inserted,
    skipped: candidates.length - inserted,
    total: candidates.length,
  });
}
