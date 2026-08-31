import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CsvImportButton, CsvExportButton } from "@/components/shared/csv-tools";
import type { Lead } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Empresas" };

export default async function EmpresasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const ctx = await getAppContext();
  const supabase = await createClient();

  let query = supabase
    .from("leads")
    .select(
      "id, name, segment, city, state, whatsapp, email, website, instagram, score, source, discovered_at",
    )
    .eq("company_id", ctx.company.id)
    .order("discovered_at", { ascending: false })
    .limit(500);
  if (q) query = query.ilike("name", `%${q}%`);
  const { data } = await query;
  const empresas = (data ?? []) as Partial<Lead>[];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Empresas</h1>
        <p className="text-sm text-muted-foreground">
          Base única de todas as empresas encontradas pelo Hunter ou cadastradas
          manualmente ({empresas.length}).
        </p>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <form className="max-w-sm flex-1">
          <Input name="q" placeholder="Buscar por nome…" defaultValue={q ?? ""} />
        </form>
        <div className="flex flex-wrap items-start gap-2">
          <CsvImportButton
            endpoint="/api/leads/import"
            hint="Colunas: nome, cnpj, segmento, cidade, uf, telefone, email…"
          />
          <CsvExportButton href="/api/leads/export" />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-3">Empresa</th>
                  <th className="p-3">Segmento</th>
                  <th className="p-3">Cidade</th>
                  <th className="p-3">Contato</th>
                  <th className="p-3">Origem</th>
                  <th className="p-3 text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {empresas.map((e) => (
                  <tr key={e.id} className="border-b last:border-0 hover:bg-secondary/40">
                    <td className="p-3">
                      <Link href={`/leads/${e.id}`} className="font-medium hover:underline">
                        {e.name}
                      </Link>
                    </td>
                    <td className="p-3 text-muted-foreground">{e.segment ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">
                      {e.city ?? "—"}
                      {e.state ? `/${e.state}` : ""}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {[e.whatsapp, e.email].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline">{e.source}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      {e.score != null ? (
                        <Badge
                          variant={
                            e.score >= 70 ? "success" : e.score >= 40 ? "warning" : "secondary"
                          }
                        >
                          {e.score}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
                {empresas.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      Nenhuma empresa ainda. Rode o Agente Hunter em Leads &amp; CRM.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
