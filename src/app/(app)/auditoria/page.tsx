import type { Metadata } from "next";
import { getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Auditoria" };

function fmt(ts: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(ts));
}

export default async function AuditoriaPage() {
  const ctx = await getAppContext();
  const supabase = await createClient();

  const [{ data: activities }, { data: aiRuns }, { data: autoRuns }, { data: msgs }] =
    await Promise.all([
      supabase
        .from("activities")
        .select("id, kind, title, body, created_at, lead_id")
        .eq("company_id", ctx.company.id)
        .order("created_at", { ascending: false })
        .limit(80),
      supabase
        .from("ai_runs")
        .select("id, agent_kind, model, status, cost_usd, duration_ms, created_at, lead_id, error")
        .eq("company_id", ctx.company.id)
        .order("created_at", { ascending: false })
        .limit(80),
      supabase
        .from("automation_runs")
        .select("id, status, detail, created_at, automation_id, lead_id")
        .eq("company_id", ctx.company.id)
        .order("created_at", { ascending: false })
        .limit(40),
      supabase
        .from("messages")
        .select("id, channel, direction, status, error, created_at, lead_id")
        .eq("company_id", ctx.company.id)
        .order("created_at", { ascending: false })
        .limit(80),
    ]);

  type Row = {
    ts: string;
    tipo: string;
    detalhe: string;
    status?: string | null;
  };
  const rows: Row[] = [
    ...(activities ?? []).map((a) => ({
      ts: a.created_at,
      tipo: `atividade · ${a.kind}`,
      detalhe: a.title ?? a.body ?? "",
    })),
    ...(aiRuns ?? []).map((r) => ({
      ts: r.created_at,
      tipo: `IA · ${r.agent_kind}`,
      detalhe: `${r.model} · ${r.duration_ms ?? 0}ms · US$ ${Number(r.cost_usd).toFixed(4)}${r.error ? ` · ${r.error}` : ""}`,
      status: r.status,
    })),
    ...(autoRuns ?? []).map((r) => ({
      ts: r.created_at,
      tipo: "automação",
      detalhe: JSON.stringify(r.detail),
      status: r.status,
    })),
    ...(msgs ?? []).map((m) => ({
      ts: m.created_at,
      tipo: `mensagem · ${m.channel} ${m.direction}`,
      detalhe: m.error ?? "",
      status: m.status,
    })),
  ].sort((a, b) => (a.ts < b.ts ? 1 : -1));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Auditoria</h1>
        <p className="text-sm text-muted-foreground">
          Linha do tempo unificada: atividades, execuções de agentes, automações e
          mensagens — quem fez o quê e quando.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-3">Quando</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Detalhe</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="whitespace-nowrap p-3 text-muted-foreground">
                      {fmt(r.ts)}
                    </td>
                    <td className="whitespace-nowrap p-3">{r.tipo}</td>
                    <td className="p-3 text-muted-foreground">
                      <span className="line-clamp-2">{r.detalhe || "—"}</span>
                    </td>
                    <td className="p-3">
                      {r.status && (
                        <Badge
                          variant={
                            r.status === "success" || r.status === "sent" || r.status === "delivered"
                              ? "success"
                              : r.status === "error" || r.status === "failed"
                                ? "danger"
                                : "secondary"
                          }
                        >
                          {r.status}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-muted-foreground">
                      Nada registrado ainda.
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
