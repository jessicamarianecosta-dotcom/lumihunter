import type { Metadata } from "next";
import { getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { HunterPanel } from "@/components/leads/hunter-panel";
import { LeadsWorkspace } from "@/components/leads/leads-workspace";
import { HelpTip } from "@/components/help/help-tip";
import {
  parseLeadsFilters,
  parseLeadsView,
  type LeadsView,
} from "@/lib/leads/filters";
import type { Lead, PipelineStage } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Leads & CRM" };

export type LeadRow = Pick<
  Lead,
  | "id"
  | "name"
  | "segment"
  | "city"
  | "state"
  | "score"
  | "stage_id"
  | "status"
  | "whatsapp"
  | "email"
  | "website"
  | "phone"
  | "source"
  | "discovered_at"
>;

function unique(values: (string | null)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => !!v && v.trim() !== ""))).sort(
    (a, b) => a.localeCompare(b, "pt-BR"),
  );
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await getAppContext();
  const supabase = await createClient();
  const filters = parseLeadsFilters(sp);

  const [{ data: stages }, { count: icpCount }, { data: profile }, { data: optionRows }] =
    await Promise.all([
      supabase
        .from("pipeline_stages")
        .select("*")
        .eq("company_id", ctx.company.id)
        .order("position"),
      supabase
        .from("icp_profiles")
        .select("id", { count: "exact", head: true })
        .eq("company_id", ctx.company.id)
        .eq("is_active", true),
      supabase
        .from("profiles")
        .select("leads_view_preference")
        .eq("id", ctx.userId)
        .maybeSingle(),
      supabase
        .from("leads")
        .select("segment, city, state, source")
        .eq("company_id", ctx.company.id)
        .eq("is_archived", false)
        .limit(2000),
    ]);

  const view: LeadsView = parseLeadsView(
    sp,
    (profile?.leads_view_preference as LeadsView) ?? "kanban",
  );

  let query = supabase
    .from("leads")
    .select(
      "id, name, segment, city, state, score, stage_id, status, whatsapp, email, website, phone, source, discovered_at",
      { count: "exact" },
    )
    .eq("company_id", ctx.company.id)
    .eq("is_archived", false);

  const term = filters.q.replace(/[(),]/g, " ").trim();
  if (term) {
    const like = `%${term}%`;
    query = query.or(
      [
        `name.ilike.${like}`,
        `segment.ilike.${like}`,
        `city.ilike.${like}`,
        `phone.ilike.${like}`,
        `whatsapp.ilike.${like}`,
        `email.ilike.${like}`,
        `website.ilike.${like}`,
      ].join(","),
    );
  }
  if (filters.stageId) query = query.eq("stage_id", filters.stageId);
  if (filters.scoreMin > 0) query = query.gte("score", filters.scoreMin);
  if (filters.scoreMax < 100) query = query.lte("score", filters.scoreMax);
  if (filters.segment) query = query.eq("segment", filters.segment);
  if (filters.city) query = query.eq("city", filters.city);
  if (filters.state) query = query.eq("state", filters.state);
  if (filters.source) query = query.eq("source", filters.source);
  if (filters.discoveredFrom) query = query.gte("discovered_at", filters.discoveredFrom);
  if (filters.discoveredTo)
    query = query.lte("discovered_at", `${filters.discoveredTo}T23:59:59`);
  if (filters.hasWhatsapp) query = query.not("whatsapp", "is", null);
  if (filters.hasEmail) query = query.not("email", "is", null);

  switch (filters.sort) {
    case "score_asc":
      query = query.order("score", { ascending: true, nullsFirst: false });
      break;
    case "recent":
      query = query.order("discovered_at", { ascending: false });
      break;
    case "oldest":
      query = query.order("discovered_at", { ascending: true });
      break;
    case "name_asc":
      query = query.order("name", { ascending: true });
      break;
    case "name_desc":
      query = query.order("name", { ascending: false });
      break;
    default:
      query = query.order("score", { ascending: false, nullsFirst: false });
  }

  const { data: leads, count } = await query.limit(500);

  const options = {
    segments: unique((optionRows ?? []).map((r) => r.segment)),
    cities: unique((optionRows ?? []).map((r) => r.city)),
    states: unique((optionRows ?? []).map((r) => r.state)),
    sources: unique((optionRows ?? []).map((r) => r.source)),
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-1.5 text-2xl font-semibold">
          Leads &amp; CRM
          <HelpTip
            title="Leads & CRM"
            text="Rode o Agente Hunter para encontrar empresas e acompanhe cada uma delas em Kanban ou em Lista, com busca, filtros e ordenação."
            articleSlug="o-que-e-o-pipeline-kanban"
          />
        </h1>
        <p className="text-sm text-muted-foreground">
          Pipeline de {ctx.company.name} — escolha entre Kanban e Lista.
        </p>
      </div>

      <HunterPanel hasIcp={(icpCount ?? 0) > 0} />

      <LeadsWorkspace
        view={view}
        stages={(stages ?? []) as PipelineStage[]}
        leads={(leads ?? []) as LeadRow[]}
        totalCount={count ?? leads?.length ?? 0}
        filters={filters}
        options={options}
      />
    </div>
  );
}
