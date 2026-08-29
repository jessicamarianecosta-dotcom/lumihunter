"use client";

import { useTransition } from "react";
import { moveLeadToStage } from "@/app/(app)/leads/actions";

export function StageSelect({
  leadId,
  currentStageId,
  stages,
}: {
  leadId: string;
  currentStageId: string | null;
  stages: { id: string; name: string }[];
}) {
  const [pending, start] = useTransition();
  return (
    <select
      defaultValue={currentStageId ?? ""}
      disabled={pending}
      onChange={(e) =>
        start(() => {
          void moveLeadToStage(leadId, e.target.value);
        })
      }
      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
    >
      {stages.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}
