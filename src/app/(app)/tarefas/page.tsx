import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { getAppContext, canWrite } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDatePtBR } from "@/lib/utils";

export const metadata: Metadata = { title: "Tarefas" };

async function createTask(formData: FormData) {
  "use server";
  const ctx = await getAppContext();
  if (!canWrite(ctx.role)) throw new Error("sem permissão");
  const supabase = await createClient();
  await supabase.from("tasks").insert({
    company_id: ctx.company.id,
    title: String(formData.get("title") || "").trim(),
    due_at: String(formData.get("due_at") || "") || null,
    assignee_id: ctx.userId,
    created_by: ctx.userId,
  });
  revalidatePath("/tarefas");
}

async function completeTask(id: string) {
  "use server";
  const ctx = await getAppContext();
  if (!canWrite(ctx.role)) throw new Error("sem permissão");
  const supabase = await createClient();
  await supabase
    .from("tasks")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", ctx.company.id);
  revalidatePath("/tarefas");
}

export default async function TarefasPage() {
  const ctx = await getAppContext();
  const supabase = await createClient();
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("company_id", ctx.company.id)
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(200);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Tarefas</h1>

      <form
        action={createTask}
        className="flex flex-wrap items-end gap-2 rounded-xl border bg-card p-4"
      >
        <div className="flex-1 space-y-1">
          <label className="text-xs text-muted-foreground">Título</label>
          <Input name="title" required />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Prazo</label>
          <Input name="due_at" type="datetime-local" />
        </div>
        <Button type="submit">Adicionar</Button>
      </form>

      <div className="space-y-2">
        {(tasks ?? []).map((t) => (
          <Card key={t.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p
                  className={`text-sm ${t.status === "done" ? "text-muted-foreground line-through" : ""}`}
                >
                  {t.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.due_at ? formatDatePtBR(t.due_at) : "sem prazo"} ·{" "}
                  <Badge variant="outline">{t.status}</Badge>
                </p>
              </div>
              {t.status !== "done" && (
                <form action={completeTask.bind(null, t.id)}>
                  <Button size="sm" variant="secondary">
                    Concluir
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        ))}
        {(!tasks || tasks.length === 0) && (
          <p className="text-sm text-muted-foreground">Nenhuma tarefa.</p>
        )}
      </div>
    </div>
  );
}
