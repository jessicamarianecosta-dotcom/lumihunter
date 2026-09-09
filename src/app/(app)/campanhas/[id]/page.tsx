import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { getAppContext, canWrite } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DispatchButton } from "@/components/campanhas/dispatch-button";
import { DiscoveryPanel } from "@/components/campanhas/discovery-panel";
import {
  DiscoveryResults,
  type DiscoveryRow,
} from "@/components/campanhas/discovery-results";
import { tavilyConfigured } from "@/lib/tavily";
import {
  addCampaignTargets,
  setCampaignStatus,
  updateCampaign,
} from "./actions";

export const metadata: Metadata = { title: "Campanha" };

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativa",
  paused: "Pausada",
  completed: "Concluída",
  archived: "Arquivada",
};

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

  const [{ data: targets }, { data: discoveries }, { data: products }] =
    await Promise.all([
      supabase
        .from("campaign_targets")
        .select("id, status, last_message_at, leads(id, name, city, score)")
        .eq("campaign_id", id)
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("lead_discoveries")
        .select(
          "id, company_name, segment, description, city, state, phone, whatsapp, email, website, instagram, source, source_url, discovery_query, score, product_fit_score, business_fit_score, result_type, business_type, qualification, qualification_reason, qualification_signals, evidence, qualified_by, recommended_approach, status, discovered_at",
        )
        .eq("campaign_id", id)
        .order("product_fit_score", { ascending: false, nullsFirst: false })
        .limit(500),
      supabase
        .from("products")
        .select("id, name")
        .eq("company_id", ctx.company.id)
        .eq("is_active", true)
        .order("name"),
    ]);

  const rows = targets ?? [];
  const byStatus = (s: string) => rows.filter((t) => t.status === s).length;

  const disc = (discoveries ?? []) as unknown as DiscoveryRow[];
  const discFound = disc.length;
  const discQualified = disc.filter(
    (d) => d.status === "qualified" || d.status === "approved",
  ).length;
  const discApproved = disc.filter((d) => d.status === "approved").length;

  const writable = canWrite(ctx.role);
  const regions: string[] = campaign.regions ?? [];
  const productLabel =
    campaign.product_text ??
    (campaign.products as { name: string } | null)?.name ??
    null;
  const audienceLabel = campaign.audience_text ?? campaign.segment ?? null;
  const regionLabel = regions.join(", ") || campaign.city || null;
  const briefReady = !!productLabel && !!audienceLabel && (regions.length > 0 || !!campaign.city);

  const discoveryStats = [
    { k: "Encontrados", v: discFound },
    { k: "Qualificados", v: discQualified },
    { k: "Aprovados", v: discApproved },
  ];
  const targetStats = [
    { k: "Alvos", v: rows.length },
    { k: "Pendentes", v: byStatus("pending") },
    { k: "Enviados", v: byStatus("sent") },
    { k: "Responderam", v: byStatus("replied") },
    { k: "Pulados", v: byStatus("skipped") },
  ];

  return (
    <div className="space-y-5">
      <Link
        href="/campanhas"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Todas as campanhas
      </Link>

      {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{campaign.name}</h1>
          <div className="text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Produto:</span>{" "}
              {productLabel ?? "Não definido"}
            </p>
            <p>
              <span className="font-medium text-foreground">Público:</span>{" "}
              {audienceLabel ?? "Não definido"}
            </p>
            <p>
              <span className="font-medium text-foreground">Região:</span>{" "}
              {regionLabel ?? "Não definida"}
            </p>
            <p>
              <span className="font-medium text-foreground">Canal:</span>{" "}
              {campaign.channel}
            </p>
          </div>
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
          {STATUS_LABEL[campaign.status] ?? campaign.status}
        </Badge>
      </div>

      {/* ── Editar campanha ───────────────────────────────────────────── */}
      {writable && (
        <details className="rounded-xl border bg-card">
          <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
            <Pencil className="size-4" /> Editar campanha
          </summary>
          <div className="border-t p-4">
            <form
              action={updateCampaign.bind(null, id)}
              className="grid gap-3 sm:grid-cols-2"
            >
              <input
                type="hidden"
                name="was_active"
                value={campaign.status === "active" ? "1" : ""}
              />
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="name">Nome da campanha</Label>
                <Input id="name" name="name" defaultValue={campaign.name} required />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="product_id">Produto do catálogo (opcional)</Label>
                <select
                  id="product_id"
                  name="product_id"
                  defaultValue={campaign.product_id ?? ""}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">— nenhum —</option>
                  {(products ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="channel">Canal</Label>
                <select
                  id="channel"
                  name="channel"
                  defaultValue={campaign.channel}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">E-mail</option>
                </select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="product_text">Produto / serviço (texto)</Label>
                <Input
                  id="product_text"
                  name="product_text"
                  defaultValue={campaign.product_text ?? ""}
                  placeholder="Ex.: Adesivos e rótulos personalizados"
                />
                <p className="text-[11px] text-muted-foreground">
                  Se preencher, é isto que a busca usa. Se deixar vazio e escolher
                  um produto do catálogo acima, a busca usa o nome + descrição dele.
                </p>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="audience_text">Público-alvo</Label>
                <Input
                  id="audience_text"
                  name="audience_text"
                  defaultValue={campaign.audience_text ?? campaign.segment ?? ""}
                  placeholder="Ex.: Pequenas empresas, lojas, artesãos, confeiteiros e empreendedores"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="regions">Região (separe por vírgula)</Label>
                <Input
                  id="regions"
                  name="regions"
                  defaultValue={regions.join(", ")}
                  placeholder="Ex.: Curitiba, São José dos Pinhais"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  name="status"
                  defaultValue={campaign.status}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {Object.entries(STATUS_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 sm:col-span-2">
                <Button size="sm" type="submit">
                  Salvar alterações
                </Button>
              </div>
            </form>
          </div>
        </details>
      )}

      {/* ── Dashboard da campanha ─────────────────────────────────────── */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Prospecção
        </p>
        <div className="grid grid-cols-3 gap-3">
          {discoveryStats.map((s) => (
            <Card key={s.k}>
              <CardContent className="p-4">
                <p className="text-xl font-semibold tabular-nums">{s.v}</p>
                <p className="text-xs text-muted-foreground">{s.k}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mb-2 mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Abordagem
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {targetStats.map((s) => (
            <Card key={s.k}>
              <CardContent className="p-4">
                <p className="text-xl font-semibold tabular-nums">{s.v}</p>
                <p className="text-xs text-muted-foreground">{s.k}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* ── 1. Encontrar ──────────────────────────────────────────────── */}
      {writable && (
        <Card>
          <CardContent className="p-4">
            <DiscoveryPanel
              campaignId={id}
              regions={regions.length ? regions : campaign.city ? [campaign.city] : []}
              ready={briefReady}
              configured={tavilyConfigured()}
            />
          </CardContent>
        </Card>
      )}

      {/* ── 2. Revisar e aprovar ─────────────────────────────────────── */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="text-sm font-medium">2. Revisar e aprovar</p>
          <DiscoveryResults campaignId={id} rows={disc} />
        </CardContent>
      </Card>

      {/* ── 3. Prospecção (abordagem) ────────────────────────────────── */}
      {writable && (
        <Card>
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium">3. Prospecção</p>
              <p className="text-[11px] text-muted-foreground">
                Os leads aprovados acima já entram aqui. Você também pode puxar
                leads existentes do segmento/cidade da campanha.
              </p>
              <form action={addCampaignTargets.bind(null, id)}>
                <Button size="sm" variant="outline">
                  Adicionar leads existentes que batem com o filtro
                </Button>
              </form>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Disparar</p>
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

      {/* ── Alvos ────────────────────────────────────────────────────── */}
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
                      Nenhum alvo ainda. Aprove leads descobertos acima.
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
