"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { MapPin, Sparkles } from "lucide-react";
import { moveLeadToStage } from "@/app/(app)/leads/actions";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Lead, PipelineStage } from "@/lib/supabase/database.types";

type KLead = Pick<
  Lead,
  "id" | "name" | "segment" | "city" | "state" | "score" | "stage_id"
>;

export function Kanban({
  stages,
  leads,
}: {
  stages: PipelineStage[];
  leads: KLead[];
}) {
  const [items, setItems] = useState(leads);
  const [dragId, setDragId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function drop(stageId: string) {
    if (!dragId) return;
    const id = dragId;
    setItems((prev) =>
      prev.map((l) => (l.id === id ? { ...l, stage_id: stageId } : l)),
    );
    setDragId(null);
    startTransition(() => {
      void moveLeadToStage(id, stageId);
    });
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {stages.map((stage) => {
        const cards = items.filter((l) => l.stage_id === stage.id);
        return (
          <div
            key={stage.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => drop(stage.id)}
            className="flex w-[78vw] max-w-[18rem] shrink-0 flex-col rounded-xl border bg-card sm:w-72"
          >
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="flex items-center gap-2 text-sm font-medium">
                <span
                  className="size-2 rounded-full"
                  style={{ background: stage.color ?? "#94a3b8" }}
                />
                {stage.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {cards.length}
              </span>
            </div>
            <div className="flex-1 space-y-2 p-2">
              {cards.map((l) => (
                <Link
                  key={l.id}
                  href={`/leads/${l.id}`}
                  draggable
                  onDragStart={() => setDragId(l.id)}
                  className={cn(
                    "block rounded-lg border bg-background p-3 text-sm shadow-sm transition hover:border-accent",
                    dragId === l.id && "opacity-50",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{l.name}</span>
                    {l.score != null && (
                      <Badge
                        variant={
                          l.score >= 70
                            ? "success"
                            : l.score >= 40
                              ? "warning"
                              : "secondary"
                        }
                      >
                        <Sparkles className="mr-1 size-3" />
                        {l.score}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {l.segment ?? "—"}
                  </p>
                  {(l.city || l.state) && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3" />
                      {l.city}
                      {l.state ? `/${l.state}` : ""}
                    </p>
                  )}
                </Link>
              ))}
              {cards.length === 0 && (
                <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                  Arraste leads para cá
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
