"use client";

import { useRef, useTransition } from "react";
import {
  addLeadTask,
  toggleLeadTask,
} from "@/app/(app)/leads/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDatePtBR } from "@/lib/utils";

export function LeadTasks({
  leadId,
  tasks,
}: {
  leadId: string;
  tasks: { id: string; title: string; status: string; due_at: string | null }[];
}) {
  const titleRef = useRef<HTMLInputElement>(null);
  const dueRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();

  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm font-medium">Tarefas</p>
        <ul className="mt-2 space-y-1.5">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={t.status === "done"}
                onChange={(e) =>
                  start(() => {
                    void toggleLeadTask(t.id, leadId, e.target.checked);
                  })
                }
              />
              <span
                className={
                  t.status === "done"
                    ? "text-muted-foreground line-through"
                    : ""
                }
              >
                {t.title}
                {t.due_at && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    · {formatDatePtBR(t.due_at)}
                  </span>
                )}
              </span>
            </li>
          ))}
          {tasks.length === 0 && (
            <li className="text-xs text-muted-foreground">Nenhuma tarefa.</li>
          )}
        </ul>
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const title = titleRef.current?.value ?? "";
            const due = dueRef.current?.value ?? "";
            start(async () => {
              await addLeadTask(leadId, title, due);
              if (titleRef.current) titleRef.current.value = "";
              if (dueRef.current) dueRef.current.value = "";
            });
          }}
        >
          <Input
            ref={titleRef}
            placeholder="Nova tarefa (ex: enviar orçamento)"
            className="h-8 text-xs"
            disabled={pending}
          />
          <div className="flex gap-2">
            <Input
              ref={dueRef}
              type="datetime-local"
              className="h-8 text-xs"
              disabled={pending}
            />
            <Button size="sm" type="submit" disabled={pending}>
              Add
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
