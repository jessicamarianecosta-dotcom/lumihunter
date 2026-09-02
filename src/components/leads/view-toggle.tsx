"use client";

import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeadsView } from "@/lib/leads/filters";

const OPTIONS: { value: LeadsView; label: string; icon: typeof LayoutGrid }[] = [
  { value: "kanban", label: "Visualização Kanban", icon: LayoutGrid },
  { value: "list", label: "Visualização em lista", icon: List },
];

export function ViewToggle({
  view,
  onChange,
}: {
  view: LeadsView;
  onChange: (view: LeadsView) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-lg border bg-secondary/50 p-0.5">
      {OPTIONS.map((opt) => {
        const active = view === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-label={opt.label}
            aria-pressed={active}
            title={opt.label}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <opt.icon className="size-3.5" />
            <span className="hidden sm:inline">
              {opt.value === "kanban" ? "Kanban" : "Lista"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
