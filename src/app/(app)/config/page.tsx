import type { Metadata } from "next";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getAppContext, isAdmin } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkSeatQuota } from "@/lib/limits";
import { getIntegrationConfig, type ResendConfig } from "@/lib/integrations/config";
import { sendEmail } from "@/lib/integrations/resend";
import {
  getAiIntegrationConfig,
  saveActiveAiProvider,
  saveAiProviderKey,
  maskApiKey,
  type AiProviderId,
} from "@/lib/ai/settings";
import { normalizeEmail } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SeedLumiLifeButton } from "@/components/app/seed-lumilife";
import { AiTestConnectionButton } from "@/components/app/ai-test-connection";
import { HelpTip } from "@/components/help/help-tip";

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

async function saveAiProviderSelection(formData: FormData) {
  "use server";
  const ctx = await getAppContext();
  if (!isAdmin(ctx.role)) throw new Error("sem permissão");
  const active = (String(formData.get("active_provider") || "anthropic") ===
  "openai"
    ? "openai"
    : "anthropic") as AiProviderId;
  await saveActiveAiProvider(ctx.company.id, active, {
    anthropic: String(formData.get("anthropic_model") || "") || undefined,
    openai: String(formData.get("openai_model") || "") || undefined,
  });
  revalidatePath("/config");
}

async function saveAiKey(provider: AiProviderId, formData: FormData) {
  "use server";
  const ctx = await getAppContext();
  if (!isAdmin(ctx.role)) throw new Error("sem permissão");
  const apiKey = String(formData.get("api_key") || "").trim();
  const model = String(formData.get("model") || "").trim();
  await saveAiProviderKey(
    ctx.company.id,
    provider,
    apiKey || null,
    model || undefined,
    ctx.userId,
  );
  revalidatePath("/config");
}

async function inviteMember(formData: FormData) {
  "use server";
  const ctx = await getAppContext();
  if (!isAdmin(ctx.role)) throw new Error("sem permissão");

  const email = normalizeEmail(String(formData.get("email") || ""));
  const role = String(formData.get("role") || "sales");
  if (!email) throw new Error("e-mail inválido");
  if (role === "owner") throw new Error("papel inválido");

  const admin = createAdminClient();
  const seat = await checkSeatQuota(admin, ctx.company.id);
  if (!seat.ok) throw new Error(seat.message);

  const { data: inv, error } = await admin
    .from("invitations")
    .upsert(
      {
        company_id: ctx.company.id,
        email,
        role: role as "admin" | "sales" | "marketing" | "finance" | "viewer",
        invited_by: ctx.userId,
        accepted_at: null,
        expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
      },
      { onConflict: "company_id,email" },
    )
    .select("token")
    .single();
  if (error) throw new Error(error.message);

  const host =
    process.env.NEXT_PUBLIC_APP_URL ||
    `https://${(await headers()).get("host") ?? "lumihunter.vercel.app"}`;
  const link = `${host}/convite/${inv.token}`;

  const resend = await getIntegrationConfig<ResendConfig>(ctx.company.id, "resend");
  await sendEmail({
    to: email,
    subject: `Convite para o LumiHunter — ${ctx.company.name}`,
    html: `<p>Você foi convidado(a) para a conta <strong>${ctx.company.name}</strong> no LumiHunter AI.</p>
<p><a href="${link}">Aceitar convite</a></p>
<p>Ou copie: ${link}</p>
<p style="color:#888;font-size:12px">O convite expira em 7 dias.</p>`,
    apiKey: resend?.config.api_key,
    from: resend?.config.from_email,
  });

  revalidatePath("/config");
}

async function revokeInvitation(id: string) {
  "use server";
  const ctx = await getAppContext();
  if (!isAdmin(ctx.role)) throw new Error("sem permissão");
  const supabase = await createClient();
  await supabase
    .from("invitations")
    .delete()
    .eq("id", id)
    .eq("company_id", ctx.company.id);
  revalidatePath("/config");
}

async function removeMember(userId: string) {
  "use server";
  const ctx = await getAppContext();
  if (!isAdmin(ctx.role)) throw new Error("sem permissão");
  if (userId === ctx.userId) throw new Error("você não pode remover a si mesmo");
  const supabase = await createClient();
  await supabase
    .from("company_members")
    .delete()
    .eq("company_id", ctx.company.id)
    .eq("user_id", userId)
    .neq("role", "owner");
  revalidatePath("/config");
}

export default async function ConfigPage() {
  const ctx = await getAppContext();
  const supabase = await createClient();
  const c = ctx.company;

  const [
    { data: integrations },
    { data: members },
    { data: sub },
    { data: invites },
    aiIntegration,
  ] = await Promise.all([
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
    supabase
      .from("invitations")
      .select("id, email, role, expires_at")
      .eq("company_id", c.id)
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
    getAiIntegrationConfig(c.id),
  ]);
  const admin = isAdmin(ctx.role);

  const aiConfig = aiIntegration?.config ?? {};
  const activeAiProvider: AiProviderId = aiConfig.active_provider ?? "anthropic";
  const anthropicModel = aiConfig.anthropic?.model ?? "claude-haiku-4-5";
  const openaiModel = aiConfig.openai?.model ?? "gpt-5.6-luna";
  const anthropicKeyMasked = maskApiKey(aiConfig.anthropic?.api_key);
  const openaiKeyMasked = maskApiKey(aiConfig.openai?.api_key);
  const anthropicConfigured = !!aiConfig.anthropic?.api_key || !!process.env.ANTHROPIC_API_KEY;
  const openaiConfigured = !!aiConfig.openai?.api_key || !!process.env.OPENAI_API_KEY;

  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-1.5 text-2xl font-semibold">
        Configurações
        <HelpTip
          title="Configurações"
          text="Dados da empresa, integrações de WhatsApp e e-mail, time, papéis e plano da conta."
          articleSlug="visao-geral-das-configuracoes"
        />
      </h1>

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

      <Card>
        <CardContent className="space-y-4 p-5">
          <p className="text-sm font-medium">Inteligência Artificial</p>

          <div className="rounded-md border p-3 text-sm">
            <p className="text-xs text-muted-foreground">IA ativa</p>
            <p className="mt-1 flex flex-wrap items-center gap-2 font-medium">
              <span
                className={`h-2 w-2 rounded-full ${activeAiProvider === "openai" ? "bg-emerald-500" : "bg-amber-500"}`}
              />
              {activeAiProvider === "openai" ? "OpenAI" : "Anthropic"}
              <span className="font-normal text-muted-foreground">
                · modelo {activeAiProvider === "openai" ? openaiModel : anthropicModel}
              </span>
            </p>
          </div>

          <form
            action={saveAiProviderSelection}
            className="flex flex-wrap items-end gap-3 border-b pb-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="active_provider">Provedor ativo</Label>
              <select
                id="active_provider"
                name="active_provider"
                defaultValue={activeAiProvider}
                disabled={!admin}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </div>
            <input type="hidden" name="anthropic_model" value={anthropicModel} />
            <input type="hidden" name="openai_model" value={openaiModel} />
            <Button size="sm" type="submit" disabled={!admin}>
              Definir como ativo
            </Button>
            <AiTestConnectionButton />
          </form>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium">
                OpenAI
                <Badge variant={openaiConfigured ? "success" : "secondary"}>
                  {openaiConfigured ? "configurada" : "não configurada"}
                </Badge>
              </p>
              <form
                action={saveAiKey.bind(null, "openai")}
                className="mt-2 space-y-2"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="openai_api_key">Chave da API OpenAI</Label>
                  <Input
                    id="openai_api_key"
                    name="api_key"
                    type="password"
                    autoComplete="off"
                    placeholder={openaiKeyMasked ?? "sk-..."}
                  />
                  {openaiKeyMasked && (
                    <p className="text-[11px] text-muted-foreground">
                      Atual: {openaiKeyMasked}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="openai_model">Modelo</Label>
                  <Input id="openai_model" name="model" defaultValue={openaiModel} />
                </div>
                <Button size="sm" type="submit" disabled={!admin}>
                  Salvar
                </Button>
              </form>
            </div>

            <div>
              <p className="flex items-center gap-2 text-sm font-medium">
                Anthropic
                <Badge variant={anthropicConfigured ? "success" : "secondary"}>
                  {anthropicConfigured ? "configurada" : "não configurada"}
                </Badge>
              </p>
              <form
                action={saveAiKey.bind(null, "anthropic")}
                className="mt-2 space-y-2"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="anthropic_api_key">Chave da API Anthropic</Label>
                  <Input
                    id="anthropic_api_key"
                    name="api_key"
                    type="password"
                    autoComplete="off"
                    placeholder={anthropicKeyMasked ?? "sk-ant-..."}
                  />
                  {anthropicKeyMasked && (
                    <p className="text-[11px] text-muted-foreground">
                      Atual: {anthropicKeyMasked}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="anthropic_model">Modelo</Label>
                  <Input
                    id="anthropic_model"
                    name="model"
                    defaultValue={anthropicModel}
                  />
                </div>
                <Button size="sm" type="submit" disabled={!admin}>
                  Salvar
                </Button>
              </form>
            </div>
          </div>
        </CardContent>
      </Card>

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
                  className="flex items-center justify-between gap-2 text-muted-foreground"
                >
                  <span className="truncate">
                    {profileName(m.profiles) ?? m.user_id.slice(0, 8)}
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge variant="outline">{m.role}</Badge>
                    {admin && m.role !== "owner" && m.user_id !== ctx.userId && (
                      <form action={removeMember.bind(null, m.user_id)}>
                        <button
                          type="submit"
                          className="text-xs text-destructive hover:underline"
                        >
                          remover
                        </button>
                      </form>
                    )}
                  </span>
                </li>
              ))}
            </ul>

            {!!invites?.length && (
              <ul className="mt-3 space-y-1 border-t pt-3 text-sm">
                {invites.map((i) => (
                  <li
                    key={i.id}
                    className="flex items-center justify-between gap-2 text-muted-foreground"
                  >
                    <span className="truncate">{i.email}</span>
                    <span className="flex items-center gap-2">
                      <Badge variant="secondary">convite · {i.role}</Badge>
                      {admin && (
                        <form action={revokeInvitation.bind(null, i.id)}>
                          <button
                            type="submit"
                            className="text-xs text-destructive hover:underline"
                          >
                            cancelar
                          </button>
                        </form>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {admin && (
              <form
                action={inviteMember}
                className="mt-4 flex flex-wrap items-end gap-2 border-t pt-4"
              >
                <div className="min-w-[180px] flex-1 space-y-1.5">
                  <Label htmlFor="invite-email">Convidar por e-mail</Label>
                  <Input
                    id="invite-email"
                    name="email"
                    type="email"
                    placeholder="colega@empresa.com"
                    required
                  />
                </div>
                <select
                  name="role"
                  defaultValue="sales"
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="admin">Admin</option>
                  <option value="sales">Vendas</option>
                  <option value="marketing">Marketing</option>
                  <option value="finance">Financeiro</option>
                  <option value="viewer">Leitura</option>
                </select>
                <Button size="sm" type="submit">
                  Enviar convite
                </Button>
              </form>
            )}
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
