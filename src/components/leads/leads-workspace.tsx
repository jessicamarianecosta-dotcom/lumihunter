"use client";

import { useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Kanban } from "./kanban";
import { LeadsList } from "./leads-list";
import { ViewToggle } from "./view-toggle";
import { LeadsFilters } from "./leads-filters";
import { setLeadsViewPreference } from "@/app/(app)/leads/actions";
import type { LeadsView, LeadsFilters as LeadsFiltersState } from "@/lib/leads/filters";
import type { LeadRow } from "@/app/(app)/leads/page";
import type { PipelineStage } from "@/lib/supabase/database.types";

interface Options {
  segments: string[];
  cities: string[];
  states: string[];
  sources: string[];
}

export function LeadsWorkspace({
  view: initialView,
  stages,
  leads,
  totalCount,
  filters,
  options,
}: {
  view: LeadsView;
  stages: PipelineStage[];
  leads: LeadRow[];
  totalCount: number;
  filters: LeadsFiltersState;
  options: Options;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const viewParam = searchParams.get("view");
  const view: LeadsView = viewParam === "kanban" || viewParam === "list" ? viewParam : initialView;

  function changeView(next: LeadsView) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", next);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
    void setLeadsViewPreference(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <ViewToggle view={view} onChange={changeView} />
          <p className="text-sm text-muted-foreground">
            {totalCount} {totalCount === 1 ? "lead encontrado" : "leads encontrados"}
          </p>
        </div>
      </div>

      <LeadsFilters filters={filters} stages={stages} options={options} />

      {view === "kanban" ? (
        <Kanban stages={stages} leads={leads} />
      ) : (
        <LeadsList leads={leads} stages={stages} />
      )}
    </div>
  );
}
