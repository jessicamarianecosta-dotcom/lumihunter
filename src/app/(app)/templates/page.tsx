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
import type { MessageTemplate } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Templates de mensagem" };

async function createTemplate(formData: FormData) {
  "use server";
  const ctx = await getAppContext();
  if (!canWrite(ctx.role)) throw new Error("sem permissão");
  const supabase = await createClient();
  const channel = String(formData.get("channel") || "whatsapp");
  await supabase.from("message_templates").insert({
    company_id: ctx.company.id,
    name: String(formData.get("name") || "").trim(),
    channel: channel as "whatsapp" | "email" | "instagram" | "call" | "manual",
    subject:
      channel === "email" ? String(formData.get("subject") || "") || null : null,
    body: String(formData.get("body") || "").trim(),
    cta: String(formData.get("cta") || "") || null,
    created_by: ctx.userId,
  });
  revalidatePath("/templates");
}

async function removeTemplate(id: string) {
  "use server";
  const ctx = await getAppContext();
  if (!canWrite(ctx.role)) throw new Error("sem permissão");
  const supabase = await createClient();
  await supabase
    .from("message_templates")
    .delete()
    .eq("id", id)
    .eq("company_id", ctx.company.id);
  revalidatePath("/templates");
}

export default async function TemplatesPage() {
  const ctx = await getAppContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("message_templates")
    .select("*")
    .eq("company_id", ctx.company.id)
    .order("created_at", { ascending: false });
  const templates = (data ?? []) as MessageTemplate[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Templates de mensagem</h1>
        <p className="text-sm text-muted-foreground">
          Modelos reutilizáveis para campanhas e respostas. Use variáveis como{" "}
          <code>{"{{empresa}}"}</code>, <code>{"{{cidade}}"}</code> e{" "}
          <code>{"{{produto}}"}</code>.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{t.name}</p>
                    <div className="mt-1 flex gap-1">
                      <Badge variant="outline">{t.channel}</Badge>
                      {t.is_ai_generated && (
                        <Badge variant="secondary">IA</Badge>
                      )}
                    </div>
                  </div>
                  <form action={removeTemplate.bind(null, t.id)}>
                    <Button size="sm" variant="ghost" type="submit">
                      Remover
                    </Button>
                  </form>
                </div>
                {t.subject && (
                  <p className="mt-2 text-sm font-medium">{t.subject}</p>
                )}
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                  {t.body}
                </p>
                {t.cta && (
                  <p className="mt-2 text-xs">
                    <strong>CTA:</strong> {t.cta}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
          {templates.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum template ainda. Crie um ao lado ou salve as mensagens geradas
              pelo Copywriter.
            </p>
          )}
        </div>

        <Card className="h-fit">
          <CardContent className="p-4">
            <p className="text-sm font-medium">Novo template</p>
            <form action={createTemplate} className="mt-3 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="channel">Canal</Label>
                <select
                  id="channel"
                  name="channel"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">E-mail</option>
                  <option value="instagram">Instagram</option>
                  <option value="call">Ligação (roteiro)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="subject">Assunto (e-mail)</Label>
                <Input id="subject" name="subject" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="body">Mensagem</Label>
                <Textarea id="body" name="body" rows={6} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cta">Chamada para ação (CTA)</Label>
                <Input id="cta" name="cta" />
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
