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
import { DiscoveryPanel } from "@/components/campanhas/discovery-panel";
import {
  DiscoveryResults,
  type DiscoveryRow,
} from "@/components/campanhas/discovery-results";
import {
  OutreachPanel,
  type QueueRow,
} from "@/components/campanhas/outreach-panel";
import { tavilyConfigured } from "@/lib/tavily";
import { resolveCampaignCatalogPdf } from "@/lib/outreach/catalog";
import {
  addCampaignTargets,
  saveOutreachSettings,
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

  // Busca a campanha da empresa ativa. Distingue "erro transitório de consulta"
  // (recarrega) de "campanha realmente não existe aqui" (notFound / outra empresa).
  async function fetchCampaign() {
    return supabase
      .from("campaigns")
      .select("*")
      .eq("id", id)
      .eq("company_id", ctx.company.id)
      .maybeSingle();
  }
  let { data: campaign, error: campErr } = await fetchCampaign();
  if (campErr) {
    await new Promise((r) => setTimeout(r, 300));
    ({ data: campaign, error: campErr } = await fetchCampaign());
  }
  if (campErr) {
    console.error("[campanhas/[id]] erro ao carregar campanha", campErr);
    throw new Error("Falha ao carregar a campanha. Tente novamente.");
  }

  if (!campaign) {
    // A campanha pode existir, mas em OUTRA empresa do usuário (empresa ativa
    // errada no seletor). Nesse caso, mostra uma orientação em vez de 404.
    const otherCompanyIds = ctx.memberships
      .map((m) => m.company_id)
      .filter((cid) => cid !== ctx.company.id);
    const elsewhere =
      otherCompanyIds.length > 0
        ? (
            await supabase
              .from("campaigns")
              .select("id, name, company_id, companies(name)")
              .eq("id", id)
              .in("company_id", otherCompanyIds)
              .maybeSingle()
          ).data
        : null;

    if (!elsewhere) notFound();

    const otherName =
      (elsewhere.companies as { name: string } | null)?.name ?? "outra empresa";
    return (
      <div className="mx-auto max-w-md space-y-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Campanha em outra empresa</h1>
        <p className="text-sm text-muted-foreground">
          A campanha <strong>{elsewhere.name}</strong> pertence a{" "}
          <strong>{otherName}</strong>. Troque a empresa ativa no seletor (canto
          superior) para abri-la.
        </p>
        <Link
          href="/campanhas"
          className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
        >
          <ArrowLeft className="size-4" /> Voltar para Campanhas
        </Link>
      </div>
    );
  }

  const runId = campaign.current_discovery_run_id;

  const [
    { data: targets },
    { data: discoveries },
    { data: products },
    { count: approvedAllTime },
    { data: lastRun },
    { data: queueRaw },
    catalogPdf,
    { data: catalogPdfsRaw },
  ] = await Promise.all([
    supabase
      .from("campaign_targets")
      .select("id, status, last_message_at, leads(id, name, city, score)")
      .eq("campaign_id", id)
      .order("created_at", { ascending: false })
      .limit(300),
    runId
      ? supabase
          .from("lead_discoveries")
          .select(
            "id, company_name, segment, description, city, state, phone, whatsapp, email, website, instagram, source, source_url, discovery_query, score, buyer_fit_score, product_fit_score, business_fit_score, result_type, business_type, competitor, whatsapp_verified, discard_reason, qualification, qualification_reason, qualification_signals, evidence, qualified_by, recommended_approach, status, discovered_at",
          )
          .eq("campaign_id", id)
          .eq("discovery_run_id", runId)
          .order("score", { ascending: false, nullsFirst: false })
          .limit(500)
      : Promise.resolve({ data: [] as never[] }),
    supabase
      .from("products")
      .select("id, name")
      .eq("company_id", ctx.company.id)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("lead_discoveries")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", id)
      .eq("status", "approved"),
    supabase
      .from("discovery_runs")
      .select("completed_at, error, status")
      .eq("campaign_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("outreach_queue")
      .select(
        "id, lead_id, status, message_body, personalized_by, catalog_included, failure_reason, leads(name, whatsapp)",
      )
      .eq("campaign_id", id)
      .not("status", "in", "(cancelled)")
      .order("created_at", { ascending: true })
      .limit(400),
    campaign.channel === "whatsapp" && campaign.outreach_send_catalog
      ? resolveCampaignCatalogPdf(
          supabase,
          ctx.company.id,
          {
            outreach_catalog_pdf_id: campaign.outreach_catalog_pdf_id,
            product_id: campaign.product_id,
          },
          ctx.company.name,
        ).catch(() => null)
      : Promise.resolve(null),
    supabase
      .from("catalog_pdfs")
      .select("id, file_name, is_default, use_for_sending")
      .eq("company_id", ctx.company.id)
      .eq("use_for_sending", true)
      .order("is_default", { ascending: false }),
  ]);

  const rows = targets ?? [];

  const disc = (discoveries ?? []) as unknown as DiscoveryRow[];
  const discFound = disc.length;
  const discProspectable = disc.filter(
    (d) => d.whatsapp_verified && !d.competitor,
  ).length;
  const discQualified = disc.filter(
    (d) => d.status === "qualified" || d.status === "approved",
  ).length;
  const discApproved = approvedAllTime ?? 0;
  const lastRunLabel =
    lastRun?.status === "failed"
      ? "Última pesquisa falhou — mostrando a anterior."
      : lastRun?.completed_at
        ? `Última pesquisa: ${new Date(lastRun.completed_at).toLocaleString("pt-BR")}`
        : null;

  const writable = canWrite(ctx.role);
  const regions: string[] = campaign.regions ?? [];
  const productLabel =
    campaign.product_text ??
    (campaign.product_id
      ? ((products ?? []).find((p) => p.id === campaign.product_id)?.name ?? null)
      : null);
  const audienceLabel = campaign.audience_text ?? campaign.segment ?? null;
  const regionLabel = regions.join(", ") || campaign.city || null;
  const briefReady = !!productLabel && !!audienceLabel && (regions.length > 0 || !!campaign.city);

  const discoveryStats = [
    { k: "Encontrados", v: discFound },
    { k: "Prospectáveis", v: discProspectable },
    { k: "Qualificados", v: discQualified },
    { k: "Aprovados", v: discApproved },
  ];
  // ── Abordagem (fila de WhatsApp) ──────────────────────────────────────
  type QueueRaw = {
    id: string;
    lead_id: string;
    status: string;
    message_body: string | null;
    personalized_by: string | null;
    catalog_included: boolean;
    failure_reason: string | null;
    leads: { name: string | null; whatsapp: string | null } | null;
  };
  const queue = (queueRaw ?? []) as unknown as QueueRaw[];
  const qBy = (s: string) => queue.filter((q) => q.status === s).length;

  const fitByLead = new Map<string, { b: number | null; p: number | null }>();
  if (queue.length) {
    const { data: fits } = await supabase
      .from("lead_discoveries")
      .select("lead_id, buyer_fit_score, product_fit_score")
      .eq("company_id", ctx.company.id)
      .in("lead_id", [...new Set(queue.map((q) => q.lead_id))]);
    for (const f of fits ?? [])
      if (f.lead_id)
        fitByLead.set(f.lead_id, { b: f.buyer_fit_score, p: f.product_fit_score });
  }

  const queueRows: QueueRow[] = queue.map((q) => ({
    id: q.id,
    lead_id: q.lead_id,
    lead_name: q.leads?.name ?? null,
    whatsapp: q.leads?.whatsapp ?? null,
    buyer_fit: fitByLead.get(q.lead_id)?.b ?? null,
    product_fit: fitByLead.get(q.lead_id)?.p ?? null,
    status: q.status,
    message_body: q.message_body,
    personalized_by: q.personalized_by,
    catalog_included: q.catalog_included,
    failure_reason: q.failure_reason,
  }));

  const outreachStats = [
    { k: "Na fila", v: qBy("draft") + qBy("ready") + qBy("scheduled") },
    { k: "Enviados", v: qBy("sent") + qBy("delivered") + qBy("read") + qBy("replied") },
    { k: "Entregues", v: qBy("delivered") + qBy("read") },
    { k: "Lidos", v: qBy("read") },
    { k: "Responderam", v: qBy("replied") },
    { k: "Opt-outs", v: qBy("opted_out") },
    { k: "Falhas", v: qBy("failed") },
  ];

  const approvedTargets = rows.filter((t) =>
    ["pending", "sent", "replied"].includes(t.status),
  ).length;
  const withWhatsapp = queue.filter((q) => q.leads?.whatsapp).length;

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
        <p className="mb-2 flex flex-wrap items-baseline gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Prospecção — pesquisa atual
          {lastRunLabel && (
            <span className="font-normal normal-case tracking-normal">
              · {lastRunLabel}
            </span>
          )}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
          Abordagem — fila de WhatsApp
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {outreachStats.map((s) => (
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
              hasRun={!!runId}
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

      {/* ── 3 + 4. Preparar abordagem & fila de WhatsApp ─────────────── */}
      {writable && campaign.channel === "whatsapp" && (
        <Card>
          <CardContent className="space-y-4 p-4">
            <details className="rounded-lg border">
              <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
                <Pencil className="size-4" /> Configurações de abordagem
              </summary>
              <form
                action={saveOutreachSettings.bind(null, id)}
                className="grid gap-3 border-t p-3 sm:grid-cols-2"
              >
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="base_message">Mensagem de abordagem (base)</Label>
                  <textarea
                    id="base_message"
                    name="base_message"
                    rows={5}
                    defaultValue={campaign.outreach_base_message ?? ""}
                    placeholder={
                      "Olá! Tudo bem? 😊\n\nEncontrei a {{empresa}} durante uma pesquisa sobre {{segmento}} em {{cidade}}.\n\nSomos da LumiLife e trabalhamos com materiais gráficos e personalizados. Posso te enviar nosso catálogo?"
                    }
                    className="w-full rounded-md border border-input bg-background p-2 text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Variáveis: {"{{empresa}} {{cidade}} {{estado}} {{segmento}} {{produto}} {{site}}"}.
                    Variável vazia é removida — nada é inventado.
                  </p>
                </div>
                <F name="daily_limit" label="Limite diário" type="number" defaultValue={campaign.outreach_daily_limit} />
                <F name="min_interval" label="Intervalo mínimo (segundos)" type="number" defaultValue={campaign.outreach_min_interval_seconds} />
                <F name="window_start" label="Horário — início" type="time" defaultValue={campaign.outreach_window_start} />
                <F name="window_end" label="Horário — fim" type="time" defaultValue={campaign.outreach_window_end} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="personalize_ai" defaultChecked={campaign.outreach_personalize_ai} className="size-4" />
                  Personalizar mensagens com IA
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="send_catalog" defaultChecked={campaign.outreach_send_catalog} className="size-4" />
                  Enviar catálogo PDF
                </label>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="catalog_pdf_id">Catálogo PDF a enviar</Label>
                  <select
                    id="catalog_pdf_id"
                    name="catalog_pdf_id"
                    defaultValue={campaign.outreach_catalog_pdf_id ?? ""}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">— usar o catálogo padrão da empresa —</option>
                    {(catalogPdfsRaw ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.file_name}
                        {c.is_default ? " (padrão)" : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-muted-foreground">
                    Gerencie os PDFs em Produtos &amp; Serviços → Catálogos.
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <Button size="sm" type="submit">
                    Salvar configurações
                  </Button>
                </div>
              </form>
            </details>

            <OutreachPanel
              campaignId={id}
              outreachStatus={campaign.outreach_status}
              minIntervalSeconds={campaign.outreach_min_interval_seconds}
              dailyLimit={campaign.outreach_daily_limit}
              windowStart={campaign.outreach_window_start}
              windowEnd={campaign.outreach_window_end}
              catalogEnabled={campaign.outreach_send_catalog}
              catalogFilename={catalogPdf?.filename ?? null}
              approvedTargets={approvedTargets}
              withWhatsapp={withWhatsapp}
              rows={queueRows}
            />

            <form action={addCampaignTargets.bind(null, id)} className="border-t pt-3">
              <Button size="sm" variant="ghost">
                + Adicionar leads existentes que batem com o filtro
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
      {writable && campaign.channel !== "whatsapp" && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            A fila de prospecção da Fase 2 é só para campanhas com canal WhatsApp.
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

function F({
  name,
  label,
  defaultValue,
  ...props
}: {
  name: string;
  label: string;
  defaultValue?: string | number;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={defaultValue} {...props} />
    </div>
  );
}
