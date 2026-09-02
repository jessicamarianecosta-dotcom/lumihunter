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
import { IcpAssistant } from "@/components/icp/icp-assistant";
import { HelpTip } from "@/components/help/help-tip";

export const metadata: Metadata = { title: "Cliente ideal (ICP)" };

async function createIcp(formData: FormData) {
  "use server";
  const ctx = await getAppContext();
  if (!canWrite(ctx.role)) throw new Error("sem permissão");
  const supabase = await createClient();
  const split = (v: FormDataEntryValue | null) =>
    String(v ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  await supabase.from("icp_profiles").insert({
    company_id: ctx.company.id,
    name: String(formData.get("name") || "").trim(),
    description: String(formData.get("description") || "") || null,
    states: split(formData.get("states")),
    cities: split(formData.get("cities")),
    segments: split(formData.get("segments")),
    company_sizes: split(formData.get("company_sizes")),
    keywords: split(formData.get("keywords")),
  });
  revalidatePath("/icp");
}

export default async function IcpPage() {
  const ctx = await getAppContext();
  const supabase = await createClient();
  const [{ data }, { count: productCount }] = await Promise.all([
    supabase
      .from("icp_profiles")
      .select("*")
      .eq("company_id", ctx.company.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("company_id", ctx.company.id),
  ]);
  const icps = (data ?? []) as import("@/lib/supabase/database.types").IcpProfile[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-1.5 text-2xl font-semibold">
          Perfil de Cliente Ideal (ICP)
          <HelpTip
            title="Cliente ideal (ICP)"
            text="Descreva o tipo de empresa que você busca — o Agente Hunter usa esses perfis para saber onde e o que procurar."
            articleSlug="o-que-e-o-perfil-de-cliente-ideal-icp"
          />
        </h1>
        <p className="text-sm text-muted-foreground">
          O Hunter usa estes perfis para saber quem procurar.
        </p>
      </div>

      <IcpAssistant hasProducts={(productCount ?? 0) > 0} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {icps.map((icp) => (
            <Card key={icp.id}>
              <CardContent className="p-4">
                <p className="font-medium">{icp.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {icp.description ?? "—"}
                </p>
                <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <Row label="Estados" values={icp.states} />
                  <Row label="Cidades" values={icp.cities} />
                  <Row label="Segmentos" values={icp.segments} />
                  <Row label="Palavras-chave" values={icp.keywords} />
                </dl>
              </CardContent>
            </Card>
          ))}
          {icps.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum ICP definido.</p>
          )}
        </div>

        <Card className="h-fit">
          <CardContent className="p-4">
            <p className="text-sm font-medium">Novo ICP</p>
            <form action={createIcp} className="mt-3 space-y-3">
              <F name="name" label="Nome do perfil" required />
              <div className="space-y-1.5">
                <Label htmlFor="description">Descrição</Label>
                <Textarea id="description" name="description" rows={2} />
              </div>
              <F name="states" label="Estados / UF (vírgula)" />
              <F name="cities" label="Cidades (vírgula)" />
              <F name="segments" label="Segmentos (vírgula)" />
              <F name="company_sizes" label="Portes (vírgula)" />
              <F name="keywords" label="Palavras-chave (vírgula)" />
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

function Row({ label, values }: { label: string; values: string[] }) {
  if (!values?.length) return null;
  return (
    <div className="flex gap-2">
      <dt className="font-medium">{label}:</dt>
      <dd>{values.join(", ")}</dd>
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
