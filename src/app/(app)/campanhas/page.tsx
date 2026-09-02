import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { getAppContext, canWrite } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { HelpTip } from "@/components/help/help-tip";
import { formatDatePtBR } from "@/lib/utils";

export const metadata: Metadata = { title: "Campanhas" };

async function createCampaign(formData: FormData) {
  "use server";
  const ctx = await getAppContext();
  if (!canWrite(ctx.role)) throw new Error("sem permissão");
  const supabase = await createClient();
  await supabase.from("campaigns").insert({
    company_id: ctx.company.id,
    name: String(formData.get("name") || "").trim(),
    goal: String(formData.get("goal") || "") || null,
    channel:
      (String(formData.get("channel")) as "whatsapp" | "email") || "whatsapp",
    segment: String(formData.get("segment") || "") || null,
    city: String(formData.get("city") || "") || null,
    target_count: Number(formData.get("target_count")) || 0,
    created_by: ctx.userId,
  });
  revalidatePath("/campanhas");
}

async function setStatus(id: string, status: string) {
  "use server";
  const ctx = await getAppContext();
  if (!canWrite(ctx.role)) throw new Error("sem permissão");
  const supabase = await createClient();
  await supabase
    .from("campaigns")
    .update({
      status: status as never,
      ...(status === "active" ? { started_at: new Date().toISOString() } : {}),
    })
    .eq("id", id)
    .eq("company_id", ctx.company.id);
  revalidatePath("/campanhas");
}

export default async function CampanhasPage() {
  const ctx = await getAppContext();
  const supabase = await createClient();
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("*")
    .eq("company_id", ctx.company.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-1.5 text-2xl font-semibold">
          Campanhas
          <HelpTip
            title="Campanhas"
            text="Organize abordagens por canal, segmento e cidade, com uma meta de leads. Ative ou pause quando quiser."
            articleSlug="o-que-sao-campanhas"
          />
        </h1>
        <p className="text-sm text-muted-foreground">
          Sequências de abordagem por canal, segmento e cidade.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {(campaigns ?? []).map((c) => (
            <Card key={c.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">
                    <Link href={`/campanhas/${c.id}`} className="hover:underline">
                      {c.name}
                    </Link>{" "}
                    <Badge
                      variant={
                        c.status === "active"
                          ? "success"
                          : c.status === "paused"
                            ? "warning"
                            : "secondary"
                      }
                    >
                      {c.status}
                    </Badge>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.channel} · {c.segment ?? "todos"} · {c.city ?? "todas"} ·
                    meta {c.target_count} · {formatDatePtBR(c.created_at)}
                  </p>
                </div>
                <div className="flex gap-2">
                  {c.status !== "active" && (
                    <form action={setStatus.bind(null, c.id, "active")}>
                      <Button size="sm" variant="secondary">
                        Ativar
                      </Button>
                    </form>
                  )}
                  {c.status === "active" && (
                    <form action={setStatus.bind(null, c.id, "paused")}>
                      <Button size="sm" variant="outline">
                        Pausar
                      </Button>
                    </form>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {(!campaigns || campaigns.length === 0) && (
            <p className="text-sm text-muted-foreground">
              Nenhuma campanha criada.
            </p>
          )}
        </div>

        <Card className="h-fit">
          <CardContent className="p-4">
            <p className="text-sm font-medium">Nova campanha</p>
            <form action={createCampaign} className="mt-3 space-y-3">
              <F name="name" label="Nome" required />
              <F name="goal" label="Objetivo" />
              <div className="space-y-1.5">
                <Label htmlFor="channel">Canal</Label>
                <select
                  id="channel"
                  name="channel"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">E-mail</option>
                </select>
              </div>
              <F name="segment" label="Segmento" />
              <F name="city" label="Cidade" />
              <F name="target_count" label="Meta de leads" type="number" />
              <Button type="submit" className="w-full">
                Criar
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function F({
  name,
  label,
  ...props
}: { name: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
  );
}
