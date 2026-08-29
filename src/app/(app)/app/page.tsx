import type { Metadata } from "next";
import Link from "next/link";
import {
  Users,
  CheckCircle2,
  Send,
  Mail,
  MessageCircle,
  Trophy,
  DollarSign,
  FileText,
} from "lucide-react";
import { getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrencyBRL } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const ctx = await getAppContext();
  const supabase = await createClient();

  const [{ data: metrics }, { data: pipeline }, { data: cities }] =
    await Promise.all([
      supabase
        .from("dashboard_metrics")
        .select("*")
        .eq("company_id", ctx.company.id)
        .maybeSingle(),
      supabase
        .from("pipeline_summary")
        .select("*")
        .eq("company_id", ctx.company.id)
        .order("position"),
      supabase
        .from("leads_by_city")
        .select("*")
        .eq("company_id", ctx.company.id)
        .order("total", { ascending: false })
        .limit(6),
    ]);

  const m = metrics ?? {
    leads_total: 0,
    leads_qualified: 0,
    whatsapp_sent: 0,
    emails_sent: 0,
    replies_total: 0,
    interested_total: 0,
    quotes_total: 0,
    won_total: 0,
    revenue_estimate: 0,
  };

  const cards = [
    { label: "Leads encontrados", value: m.leads_total, icon: Users },
    { label: "Qualificados", value: m.leads_qualified, icon: CheckCircle2 },
    { label: "WhatsApp enviados", value: m.whatsapp_sent, icon: Send },
    { label: "E-mails enviados", value: m.emails_sent, icon: Mail },
    { label: "Respostas", value: m.replies_total, icon: MessageCircle },
    { label: "Interessados", value: m.interested_total, icon: MessageCircle },
    { label: "Orçamentos", value: m.quotes_total, icon: FileText },
    { label: "Vendas", value: m.won_total, icon: Trophy },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Visão executiva de {ctx.company.name}
          </p>
        </div>
        <Button asChild>
          <Link href="/leads?hunter=1">Rodar Agente Hunter</Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <span className="grid size-9 place-items-center rounded-lg bg-secondary">
                <c.icon className="size-4 text-accent" />
              </span>
              <div>
                <p className="text-xl font-semibold tabular-nums">{c.value}</p>
                <p className="text-xs text-muted-foreground">{c.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <h2 className="text-sm font-medium">Funil de vendas</h2>
            <div className="mt-4 space-y-2">
              {(pipeline ?? []).map((s) => {
                const max = Math.max(
                  1,
                  ...(pipeline ?? []).map((x) => x.lead_count),
                );
                return (
                  <div key={s.stage_id} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 text-xs text-muted-foreground">
                      {s.stage_name}
                    </span>
                    <div className="h-6 flex-1 overflow-hidden rounded bg-secondary">
                      <div
                        className="h-full rounded bg-primary/70"
                        style={{ width: `${(s.lead_count / max) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-xs tabular-nums">
                      {s.lead_count}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h2 className="text-sm font-medium">Receita estimada (ganhos)</h2>
            <p className="mt-2 text-2xl font-semibold text-emerald-600">
              {formatCurrencyBRL(m.revenue_estimate)}
            </p>
            <h3 className="mt-6 text-sm font-medium">Top cidades</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {(cities ?? []).map((c) => (
                <li
                  key={`${c.city}-${c.state}`}
                  className="flex justify-between text-muted-foreground"
                >
                  <span>
                    {c.city}
                    {c.state ? `/${c.state}` : ""}
                  </span>
                  <span className="tabular-nums">{c.total}</span>
                </li>
              ))}
              {(!cities || cities.length === 0) && (
                <li className="text-muted-foreground">Sem dados ainda.</li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <DollarSign className="size-3.5" />
        Receita estimada usa o preço médio dos produtos recomendados nos leads
        ganhos. Ajuste os valores em Produtos.
      </p>
    </div>
  );
}
