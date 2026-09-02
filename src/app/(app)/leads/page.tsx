import type { Metadata } from "next";
import { getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { Kanban } from "@/components/leads/kanban";
import { HunterPanel } from "@/components/leads/hunter-panel";
import { HelpTip } from "@/components/help/help-tip";
import type { PipelineStage } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Leads & CRM" };

export default async function LeadsPage() {
  const ctx = await getAppContext();
  const supabase = await createClient();

  const [{ data: stages }, { data: leads }, { count: icpCount }] =
    await Promise.all([
      supabase
        .from("pipeline_stages")
        .select("*")
        .eq("company_id", ctx.company.id)
        .order("position"),
      supabase
        .from("leads")
        .select("id, name, segment, city, state, score, stage_id")
        .eq("company_id", ctx.company.id)
        .eq("is_archived", false)
        .order("score", { ascending: false, nullsFirst: false })
        .limit(500),
      supabase
        .from("icp_profiles")
        .select("id", { count: "exact", head: true })
        .eq("company_id", ctx.company.id)
        .eq("is_active", true),
    ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-1.5 text-2xl font-semibold">
          Leads &amp; CRM
          <HelpTip
            title="Leads & CRM"
            text="Rode o Agente Hunter para encontrar empresas e acompanhe cada uma delas no pipeline, arrastando o card entre as etapas conforme a negociação avança."
            articleSlug="o-que-e-o-pipeline-kanban"
          />
        </h1>
        <p className="text-sm text-muted-foreground">
          Pipeline de {ctx.company.name} — arraste os cartões entre as colunas.
        </p>
      </div>

      <HunterPanel hasIcp={(icpCount ?? 0) > 0} />

      <Kanban
        stages={(stages ?? []) as PipelineStage[]}
        leads={leads ?? []}
      />
    </div>
  );
}
