import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Globe,
  Instagram,
  Phone,
  Mail,
  MapPin,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { LeadAiActions } from "@/components/leads/lead-ai-actions";
import { StageSelect } from "@/components/leads/stage-select";
import { NoteForm } from "@/components/leads/note-form";
import { LeadTags } from "@/components/leads/lead-tags";
import { LeadTasks } from "@/components/leads/lead-tasks";
import { formatDatePtBR } from "@/lib/utils";

export const metadata: Metadata = { title: "Lead" };

export default async function LeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getAppContext();
  const supabase = await createClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .eq("company_id", ctx.company.id)
    .maybeSingle();
  if (!lead) notFound();

  const [
    { data: stages },
    { data: activities },
    { data: products },
    { data: tags },
    { data: tasks },
  ] = await Promise.all([
    supabase
      .from("pipeline_stages")
      .select("id, name")
      .eq("company_id", ctx.company.id)
      .order("position"),
    supabase
      .from("activities")
      .select("*")
      .eq("lead_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("products")
      .select("id, name")
      .eq("company_id", ctx.company.id)
      .in("id", lead.recommended_product_ids ?? []),
    supabase
      .from("lead_tags")
      .select("id, tag")
      .eq("lead_id", id)
      .order("created_at"),
    supabase
      .from("tasks")
      .select("id, title, status, due_at")
      .eq("lead_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const contacts = [
    { icon: Phone, value: lead.whatsapp ?? lead.phone, href: lead.whatsapp ? `https://wa.me/${lead.whatsapp.replace(/\D/g, "")}` : undefined },
    { icon: Mail, value: lead.email, href: lead.email ? `mailto:${lead.email}` : undefined },
    { icon: Globe, value: lead.website, href: lead.website ?? undefined },
    { icon: Instagram, value: lead.instagram, href: lead.instagram?.startsWith("http") ? lead.instagram : undefined },
  ].filter((c) => c.value);

  return (
    <div className="space-y-5">
      <Link
        href="/leads"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Voltar ao pipeline
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold sm:text-2xl">{lead.name}</h1>
          <p className="text-sm text-muted-foreground">
            {lead.segment ?? "—"}
            {(lead.city || lead.state) && (
              <>
                {" · "}
                <MapPin className="inline size-3.5" /> {lead.city}
                {lead.state ? `/${lead.state}` : ""}
              </>
            )}
            {" · descoberto em "}
            {formatDatePtBR(lead.discovered_at)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lead.score != null && (
            <Badge
              variant={
                lead.score >= 70
                  ? "success"
                  : lead.score >= 40
                    ? "warning"
                    : "secondary"
              }
            >
              <Sparkles className="mr-1 size-3" /> Score {lead.score}
            </Badge>
          )}
          <div className="flex-1 sm:flex-none">
            <StageSelect
              leadId={lead.id}
              currentStageId={lead.stage_id}
              stages={stages ?? []}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {lead.ai_summary && (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium">Resumo da IA</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {lead.ai_summary}
                </p>
                {lead.score_reason && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    <strong>Score:</strong> {lead.score_reason}
                  </p>
                )}
                {!!products?.length && (
                  <p className="mt-2 text-xs">
                    <strong>Produtos recomendados:</strong>{" "}
                    {products.map((p) => p.name).join(", ")}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <LeadAiActions leadId={lead.id} />

          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-medium">Histórico</p>
              <ul className="mt-3 space-y-3">
                {(activities ?? []).map((a) => (
                  <li key={a.id} className="text-sm">
                    <p className="text-xs text-muted-foreground">
                      {formatDatePtBR(a.created_at)} · {a.kind}
                    </p>
                    <p>{a.title ?? a.body}</p>
                  </li>
                ))}
                {(!activities || activities.length === 0) && (
                  <li className="text-sm text-muted-foreground">
                    Nenhuma atividade ainda.
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>

          <NoteForm leadId={lead.id} />
        </div>

        <div className="space-y-5">
          <LeadTags leadId={lead.id} tags={tags ?? []} />
          <LeadTasks leadId={lead.id} tasks={tasks ?? []} />

          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-medium">Contato</p>
              <ul className="mt-3 space-y-2 text-sm">
                {contacts.map((c, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <c.icon className="size-4 text-muted-foreground" />
                    {c.href ? (
                      <a
                        href={c.href}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-accent hover:underline"
                      >
                        {c.value}
                      </a>
                    ) : (
                      <span className="truncate">{c.value}</span>
                    )}
                  </li>
                ))}
                {contacts.length === 0 && (
                  <li className="text-muted-foreground">
                    Sem dados de contato públicos.
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>

          {lead.description && (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium">Sobre a empresa</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {lead.description}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
