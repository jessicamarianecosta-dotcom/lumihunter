import { NextResponse } from "next/server";
import { z } from "zod";
import { tryGetContext, canWrite } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 30;

const Body = z.object({
  rows: z.array(z.record(z.string())).max(1000),
});

const ALIASES: Record<string, string> = {
  nome: "name",
  produto: "name",
  tipo: "kind",
  "descrição": "description",
  descricao: "description",
  "preço_inicial": "price_start",
  preco_inicial: "price_start",
  "preço_médio": "price_avg",
  preco_medio: "price_avg",
  "público_ideal": "ideal_audience",
  publico_ideal: "ideal_audience",
  "palavras-chave": "keywords",
  palavras_chave: "keywords",
  "aplicações": "applications",
  aplicacoes: "applications",
};

function pick(row: Record<string, string>, key: string): string {
  for (const [k, v] of Object.entries(row)) {
    const norm = ALIASES[k] ?? k;
    if (norm === key && v?.trim()) return v.trim();
  }
  return "";
}

function num(v: string): number | null {
  const n = Number(v.replace(/[R$\s.]/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function list(v: string): string[] {
  return v
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
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
    .map((row) => {
      const kind = pick(row, "kind").toLowerCase();
      return {
        name: pick(row, "name"),
        kind: kind.startsWith("serv") ? "service" : "product",
        description: pick(row, "description") || null,
        price_start: num(pick(row, "price_start")),
        price_avg: num(pick(row, "price_avg")),
        ideal_audience: pick(row, "ideal_audience") || null,
        keywords: list(pick(row, "keywords")),
        applications: list(pick(row, "applications")),
      };
    })
    .filter((r) => r.name);

  if (candidates.length === 0)
    return NextResponse.json(
      { error: "Nenhuma linha com a coluna 'nome' preenchida." },
      { status: 400 },
    );

  const { data: existing } = await admin
    .from("products")
    .select("name")
    .eq("company_id", ctx.company.id);
  const seen = new Set((existing ?? []).map((e) => e.name.trim().toLowerCase()));

  const rows = candidates
    .filter((r) => !seen.has(r.name.trim().toLowerCase()))
    .map((r) => ({ ...r, company_id: ctx.company.id }));

  let inserted = 0;
  if (rows.length) {
    const { data, error } = await admin.from("products").insert(rows).select("id");
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
