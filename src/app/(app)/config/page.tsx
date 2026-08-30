import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { getAppContext, isAdmin } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SeedLumiLifeButton } from "@/components/app/seed-lumilife";

export const metadata: Metadata = { title: "Configurações" };

async function saveCompany(formData: FormData) {
  "use server";
  const ctx = await getAppContext();
  if (!isAdmin(ctx.role)) throw new Error("sem permissão");
  const supabase = await createClient();
  await supabase
    .from("companies")
    .update({
      name: String(formData.get("name") || ctx.company.name),
      segment: String(formData.get("segment") || "") || null,
      city: String(formData.get("city") || "") || null,
      state: String(formData.get("state") || "") || null,
      commercial_whatsapp: String(formData.get("whatsapp") || "") || null,
      commercial_email: String(formData.get("email") || "") || null,
      website: String(formData.get("website") || "") || null,
      instagram: String(formData.get("instagram") || "") || null,
      description: String(formData.get("description") || "") || null,
      brand_color: String(formData.get("brand_color") || "#F5C518"),
    })
    .eq("id", ctx.company.id);
  revalidatePath("/config");
}

async function saveIntegration(provider: "whatsapp" | "resend", formData: FormData) {
  "use server";
  const ctx = await getAppContext();
  if (!isAdmin(ctx.role)) throw new Error("sem permissão");
  const supabase = await createClient();

  const config =
    provider === "whatsapp"
      ? {
          access_token: String(formData.get("access_token") || "") || undefined,
          phone_number_id: String(formData.get("phone_number_id") || "") || undefined,
          business_account_id: String(formData.get("business_account_id") || "") || undefined,
          api_version: String(formData.get("api_version") || "v21.0"),
        }
      : {
          api_key: String(formData.get("api_key") || "") || undefined,
          from_email: String(formData.get("from_email") || "") || undefined,
          domain: String(formData.get("domain") || "") || undefined,
        };

  const hasSecret =
    provider === "whatsapp" ? !!config.access_token : !!(config as { api_key?: string }).api_key;

  await supabase.from("integrations").upsert(
    {
      company_id: ctx.company.id,
      provider,
      config,
      is_connected: hasSecret,
      connected_by: ctx.userId,
      connected_at: hasSecret ? new Date().toISOString() : null,
    },
    { onConflict: "company_id,provider" },
  );
  revalidatePath("/config");
}

export default async function ConfigPage() {
  const ctx = await getAppContext();
  const supabase = await createClient();
  const c = ctx.company;

  const [{ data: integrations }, { data: members }, { data: sub }] =
    await Promise.all([
      supabase
        .from("integrations")
        .select("provider, is_connected, config")
        .eq("company_id", c.id),
      supabase
        .from("company_members")
        .select("role, user_id, profiles(full_name)")
        .eq("company_id", c.id),
      supabase
        .from("subscriptions")
        .select("plan, limits")
        .eq("company_id", c.id)
        .maybeSingle(),
    ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Configurações</h1>

      <Card>
        <CardContent className="p-5">
          <p className="text-sm font-medium">Empresa</p>
          <form
            action={saveCompany}
            className="mt-3 grid gap-3 sm:grid-cols-2"
          >
            <F name="name" label="Nome" defaultValue={c.name} />
            <F name="segment" label="Segmento" defaultValue={c.segment ?? ""} />
            <F name="city" label="Cidade" defaultValue={c.city ?? ""} />
            <F name="state" label="UF" defaultValue={c.state ?? ""} maxLength={2} />
            <F name="whatsapp" label="WhatsApp" defaultValue={c.commercial_whatsapp ?? ""} />
            <F name="email" label="E-mail" defaultValue={c.commercial_email ?? ""} />
            <F name="website" label="Site" defaultValue={c.website ?? ""} />
            <F name="instagram" label="Instagram" defaultValue={c.instagram ?? ""} />
            <div className="space-y-1.5">
              <Label htmlFor="brand_color">Cor</Label>
              <Input
                id="brand_color"
                name="brand_color"
                type="color"
                defaultValue={c.brand_color ?? "#F5C518"}
                className="h-9 p-1"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                name="description"
                rows={2}
                defaultValue={c.description ?? ""}
              />
            </div>
            <Button type="submit" disabled={!isAdmin(ctx.role)}>
              Salvar
            </Button>
          </form>
        </CardContent>
      </Card>

      {(() => {
        const wa = (integrations?.find((i) => i.provider === "whatsapp")
          ?.config ?? {}) as Record<string, string>;
        const rs = (integrations?.find((i) => i.provider === "resend")?.config ??
          {}) as Record<string, string>;
        const waOn = integrations?.find((i) => i.provider === "whatsapp")
          ?.is_connected;
        const rsOn = integrations?.find((i) => i.provider === "resend")
          ?.is_connected;
        return (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardContent className="p-5">
                <p className="flex items-center gap-2 text-sm font-medium">
                  WhatsApp Cloud API
                  <Badge variant={waOn ? "success" : "secondary"}>
                    {waOn ? "conectado" : "não conectado"}
                  </Badge>
                </p>
                <form
                  action={saveIntegration.bind(null, "whatsapp")}
                  className="mt-3 space-y-3"
                >
                  <F name="phone_number_id" label="Phone Number ID" defaultValue={wa.phone_number_id ?? ""} />
                  <F name="business_account_id" label="Business Account ID" defaultValue={wa.business_account_id ?? ""} />
                  <F name="access_token" label="Access Token (permanente)" type="password" defaultValue={wa.access_token ?? ""} />
                  <F name="api_version" label="Versão da API" defaultValue={wa.api_version ?? "v21.0"} />
                  <Button size="sm" type="submit" disabled={!isAdmin(ctx.role)}>
                    Salvar
                  </Button>
                </form>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Webhook: <code>https://lumihunter.vercel.app/api/whatsapp/webhook</code>{" "}
                  · Verify token: <code>lumihunter-verify</code>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <p className="flex items-center gap-2 text-sm font-medium">
                  Resend (e-mail)
                  <Badge variant={rsOn ? "success" : "secondary"}>
                    {rsOn ? "conectado" : "não conectado"}
                  </Badge>
                </p>
                <form
                  action={saveIntegration.bind(null, "resend")}
                  className="mt-3 space-y-3"
                >
                  <F name="api_key" label="API Key (re_...)" type="password" defaultValue={rs.api_key ?? ""} />
                  <F name="from_email" label="Remetente (from)" defaultValue={rs.from_email ?? ""} placeholder="contato@seudominio.com.br" />
                  <F name="domain" label="Domínio verificado" defaultValue={rs.domain ?? ""} />
                  <Button size="sm" type="submit" disabled={!isAdmin(ctx.role)}>
                    Salvar
                  </Button>
                </form>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Webhook: <code>https://lumihunter.vercel.app/api/resend/webhook</code>
                </p>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm font-medium">Outras integrações</p>
            <ul className="mt-3 space-y-2 text-sm">
              {["google", "stripe"].map((p) => (
                <li key={p} className="flex items-center justify-between">
                  <span className="capitalize">{p}</span>
                  <Badge variant="secondary">em breve</Badge>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Google (login) é configurado no Supabase. Stripe entra na fase de
              cobrança.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-sm font-medium">Equipe &amp; plano</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Plano atual:{" "}
              <Badge variant="outline">{sub?.plan ?? c.plan}</Badge>
            </p>
            <ul className="mt-3 space-y-1 text-sm">
              {(members ?? []).map((m) => (
                <li
                  key={m.user_id}
                  className="flex items-center justify-between text-muted-foreground"
                >
                  <span>
                    {profileName(m.profiles) ?? m.user_id.slice(0, 8)}
                  </span>
                  <Badge variant="outline">{m.role}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex items-center justify-between p-5">
          <div>
            <p className="text-sm font-medium">Dados de demonstração</p>
            <p className="text-xs text-muted-foreground">
              Cria a empresa &ldquo;LumiLife Comunicação Visual&rdquo; com
              catálogo e ICP prontos, vinculada à sua conta.
            </p>
          </div>
          <SeedLumiLifeButton />
        </CardContent>
      </Card>
    </div>
  );
}

function profileName(p: unknown): string | null {
  const rec = Array.isArray(p) ? p[0] : p;
  return (rec as { full_name?: string | null } | null)?.full_name ?? null;
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
