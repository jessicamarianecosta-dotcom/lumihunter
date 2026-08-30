import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAppContext, canWrite } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DispatchButton } from "@/components/campanhas/dispatch-button";
import { addCampaignTargets, setCampaignStatus } from "./actions";

export const metadata: Metadata = { title: "Campanha" };

export default async function CampanhaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getAppContext();
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*, products(name)")
    .eq("id", id)
    .eq("company_id", ctx.company.id)
    .maybeSingle();
  if (!campaign) notFound();

  const { data: targets } = await supabase
    .from("campaign_targets")
    .select("id, status, last_message_at, leads(id, name, city, score)")
    .eq("campaign_id", id)
    .order("created_at", { ascending: false })
    .limit(300);

  const rows = targets ?? [];
  const byStatus = (s: string) => rows.filter((t) => t.status === s).length;
  const stats = [
    { k: "Alvos", v: rows.length },
    { k: "Pendentes", v: byStatus("pending") },
    { k: "Enviados", v: byStatus("sent") },
    { k: "Responderam", v: byStatus("replied") },
    { k: "Pulados", v: byStatus("skipped") },
  ];

  const writable = canWrite(ctx.role);

  return (
    <div className="space-y-5">
      <Link
        href="/campanhas"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Todas as campanhas
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{campaign.name}</h1>
          <p className="text-sm text-muted-foreground">
            {campaign.channel} ·{" "}
            {(campaign.products as { name: string } | null)?.name ??
              "sem produto"}{" "}
            · {campaign.segment ?? "todos os segmentos"} ·{" "}
            {campaign.city ?? "todas as cidades"}
          </p>
        </div>
        <Badge
          variant={
            campaign.status === "active"
              ? "success"
              : campaign.status === "paused"
                ? "warning"
                : "secondary"
          }
        >
          {campaign.status}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.k}>
            <CardContent className="p-4">
              <p className="text-xl font-semibold tabular-nums">{s.v}</p>
              <p className="text-xs text-muted-foreground">{s.k}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {writable && (
        <Card>
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium">1. Selecionar alvos</p>
              <form action={addCampaignTargets.bind(null, id)}>
                <Button size="sm" variant="secondary">
                  Adicionar leads que batem com o filtro
                </Button>
              </form>
              <p className="text-[11px] text-muted-foreground">
                Puxa leads não arquivados do segmento/cidade da campanha que ainda
                não estão nela.
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">2. Disparar</p>
              {campaign.status === "active" ? (
                <DispatchButton campaignId={id} pending={byStatus("pending")} />
              ) : (
                <form action={setCampaignStatus.bind(null, id, "active")}>
                  <Button size="sm">Ativar campanha para disparar</Button>
                </form>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-3">Lead</th>
                  <th className="p-3">Cidade</th>
                  <th className="p-3 text-right">Score</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Última ação</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => {
                  const l = t.leads as {
                    id: string;
                    name: string;
                    city: string | null;
                    score: number | null;
                  } | null;
                  return (
                    <tr key={t.id} className="border-b last:border-0">
                      <td className="p-3">
                        {l ? (
                          <Link href={`/leads/${l.id}`} className="hover:underline">
                            {l.name}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {l?.city ?? "—"}
                      </td>
                      <td className="p-3 text-right">{l?.score ?? "—"}</td>
                      <td className="p-3">
                        <Badge
                          variant={
                            t.status === "sent"
                              ? "success"
                              : t.status === "replied"
                                ? "default"
                                : t.status === "skipped"
                                  ? "danger"
                                  : "secondary"
                          }
                        >
                          {t.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {t.last_message_at
                          ? new Date(t.last_message_at).toLocaleString("pt-BR")
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">
                      Nenhum alvo ainda. Clique em &ldquo;Adicionar leads&rdquo;.
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
