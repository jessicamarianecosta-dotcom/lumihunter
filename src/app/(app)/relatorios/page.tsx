import type { Metadata } from "next";
import { getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { AnalystPanel } from "@/components/app/analyst-panel";

export const metadata: Metadata = { title: "Relatórios" };

export default async function RelatoriosPage() {
  const ctx = await getAppContext();
  const supabase = await createClient();

  const { data: metrics } = await supabase
    .from("dashboard_metrics")
    .select("*")
    .eq("company_id", ctx.company.id)
    .maybeSingle();

  const { data: bySegment } = await supabase
    .from("leads")
    .select("segment, status")
    .eq("company_id", ctx.company.id)
    .eq("is_archived", false)
    .limit(2000);

  const segAgg: Record<string, { total: number; won: number }> = {};
  for (const l of bySegment ?? []) {
    const k = l.segment ?? "—";
    segAgg[k] ??= { total: 0, won: 0 };
    segAgg[k].total++;
    if (l.status === "won") segAgg[k].won++;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Relatórios</h1>
        <p className="text-sm text-muted-foreground">
          Exportação para PDF/Excel/CSV entra numa próxima etapa. Use o Analyst
          para insights automáticos.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {Object.entries(metrics ?? {})
          .filter(([k]) => k !== "company_id")
          .map(([k, v]) => (
            <Card key={k}>
              <CardContent className="p-4">
                <p className="text-lg font-semibold tabular-nums">
                  {String(v)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {k.replace(/_/g, " ")}
                </p>
              </CardContent>
            </Card>
          ))}
      </div>

      <Card>
        <CardContent className="p-5">
          <p className="text-sm font-medium">Desempenho por segmento</p>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="pb-2">Segmento</th>
                <th className="pb-2">Leads</th>
                <th className="pb-2">Ganhos</th>
                <th className="pb-2">Conversão</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(segAgg).map(([seg, a]) => (
                <tr key={seg} className="border-t">
                  <td className="py-2">{seg}</td>
                  <td className="py-2">{a.total}</td>
                  <td className="py-2">{a.won}</td>
                  <td className="py-2">
                    {a.total ? Math.round((a.won / a.total) * 100) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <AnalystPanel metrics={{ ...metrics, segmentos: segAgg }} />
    </div>
  );
}
