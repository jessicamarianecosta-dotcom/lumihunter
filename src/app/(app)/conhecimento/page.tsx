import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { getAppContext, canWrite } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { KnowledgeEntry } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Base de conhecimento" };

const CATEGORIES = [
  "geral",
  "produtos",
  "preços",
  "materiais e acabamentos",
  "prazos",
  "regiões atendidas",
  "diferenciais",
  "argumentos comerciais",
  "perguntas frequentes",
];

async function createEntry(formData: FormData) {
  "use server";
  const ctx = await getAppContext();
  if (!canWrite(ctx.role)) throw new Error("sem permissão");
  const supabase = await createClient();
  await supabase.from("knowledge_entries").insert({
    company_id: ctx.company.id,
    title: String(formData.get("title") || "").trim(),
    category: String(formData.get("category") || "geral"),
    content: String(formData.get("content") || "").trim(),
    tags: String(formData.get("tags") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    created_by: ctx.userId,
  });
  revalidatePath("/conhecimento");
}

async function removeEntry(id: string) {
  "use server";
  const ctx = await getAppContext();
  if (!canWrite(ctx.role)) throw new Error("sem permissão");
  const supabase = await createClient();
  await supabase
    .from("knowledge_entries")
    .delete()
    .eq("id", id)
    .eq("company_id", ctx.company.id);
  revalidatePath("/conhecimento");
}

export default async function ConhecimentoPage() {
  const ctx = await getAppContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("knowledge_entries")
    .select("*")
    .eq("company_id", ctx.company.id)
    .order("category")
    .order("created_at", { ascending: false });
  const entries = (data ?? []) as KnowledgeEntry[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Base de conhecimento</h1>
        <p className="text-sm text-muted-foreground">
          &ldquo;Tudo que a {ctx.company.name} vende e faz.&rdquo; Os agentes de IA
          usam estes textos para qualificar leads e escrever as abordagens.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {entries.map((e) => (
            <Card key={e.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{e.title}</p>
                    <Badge variant="outline" className="mt-1">
                      {e.category}
                    </Badge>
                  </div>
                  <form action={removeEntry.bind(null, e.id)}>
                    <Button size="sm" variant="ghost" type="submit">
                      Remover
                    </Button>
                  </form>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {e.content}
                </p>
                {e.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {e.tags.map((t) => (
                      <Badge key={t} variant="secondary">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {entries.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma entrada ainda. Comece cadastrando produtos, preços, prazos e
              argumentos comerciais.
            </p>
          )}
        </div>

        <Card className="h-fit">
          <CardContent className="p-4">
            <p className="text-sm font-medium">Nova entrada</p>
            <form action={createEntry} className="mt-3 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="title">Título</Label>
                <Input id="title" name="title" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category">Categoria</Label>
                <select
                  id="category"
                  name="category"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="content">Conteúdo</Label>
                <Textarea id="content" name="content" rows={5} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tags">Tags (vírgula)</Label>
                <Input id="tags" name="tags" />
              </div>
              <Button type="submit" className="w-full">
                Adicionar
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
