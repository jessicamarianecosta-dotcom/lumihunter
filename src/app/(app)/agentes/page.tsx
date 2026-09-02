import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { getAppContext, isAdmin } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { HelpTip } from "@/components/help/help-tip";
import { isDemoMode } from "@/lib/anthropic/demo";

export const metadata: Metadata = { title: "Agentes de IA" };

async function updateAgent(formData: FormData) {
  "use server";
  const ctx = await getAppContext();
  if (!isAdmin(ctx.role)) throw new Error("sem permissão");
  const supabase = await createClient();
  await supabase
    .from("ai_agents")
    .update({
      model: String(formData.get("model") || "claude-sonnet-5"),
      temperature: Number(formData.get("temperature")) || 0.7,
      system_prompt: String(formData.get("system_prompt") || "") || null,
      is_active: formData.get("is_active") === "on",
    })
    .eq("id", String(formData.get("id")))
    .eq("company_id", ctx.company.id);
  revalidatePath("/agentes");
}

export default async function AgentsPage() {
  const ctx = await getAppContext();
  const supabase = await createClient();

  const [{ data: agents }, { data: runs }] = await Promise.all([
    supabase
      .from("ai_agents")
      .select("*")
      .eq("company_id", ctx.company.id)
      .order("kind"),
    supabase
      .from("ai_runs")
      .select("agent_kind, cost_usd, input_tokens, output_tokens, created_at")
      .eq("company_id", ctx.company.id)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const totalCost = (runs ?? []).reduce((s, r) => s + Number(r.cost_usd), 0);
  const usd = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 4,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="flex items-center gap-1.5 text-2xl font-semibold">
            Agentes de IA
            <HelpTip
              title="Agentes de IA"
              text="Hunter, Qualifier, Copywriter, Sales Coach e Analyst. Ajuste modelo, temperatura e prompt de cada um aqui."
              articleSlug="como-funcionam-os-agentes-de-ia"
            />
          </h1>
          <p className="text-sm text-muted-foreground">
            Hunter, Qualifier, Copywriter, Sales Coach e Analyst.
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="text-muted-foreground">Custo IA (últimas 200 execuções)</p>
          <p className="text-lg font-semibold">{usd.format(totalCost)}</p>
        </div>
      </div>

      {isDemoMode() && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          <strong>Modo demo ativo.</strong> Os agentes retornam respostas
          simuladas (custo zero) porque não há <code>ANTHROPIC_API_KEY</code>{" "}
          configurada. Adicione a chave nas variáveis de ambiente para usar IA
          real.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {(agents ?? []).map((a) => {
          const kindRuns = (runs ?? []).filter((r) => r.agent_kind === a.kind);
          return (
            <Card key={a.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{a.name}</p>
                  <Badge variant={a.is_active ? "success" : "secondary"}>
                    {a.is_active ? "ativo" : "inativo"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {kindRuns.length} execuções ·{" "}
                  {usd.format(
                    kindRuns.reduce((s, r) => s + Number(r.cost_usd), 0),
                  )}
                </p>

                <form action={updateAgent} className="mt-3 space-y-2 text-sm">
                  <input type="hidden" name="id" value={a.id} />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor={`model-${a.id}`}>Modelo</Label>
                      <select
                        id={`model-${a.id}`}
                        name="model"
                        defaultValue={a.model}
                        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                      >
                        <option value="claude-sonnet-5">claude-sonnet-5</option>
                        <option value="claude-opus-5">claude-opus-5</option>
                        <option value="claude-haiku-4-5">claude-haiku-4-5</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`temp-${a.id}`}>Temperatura</Label>
                      <Input
                        id={`temp-${a.id}`}
                        name="temperature"
                        type="number"
                        step="0.1"
                        min="0"
                        max="1"
                        defaultValue={a.temperature}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`sp-${a.id}`}>
                      System prompt (deixe vazio para usar o padrão)
                    </Label>
                    <Textarea
                      id={`sp-${a.id}`}
                      name="system_prompt"
                      rows={3}
                      defaultValue={a.system_prompt ?? ""}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      name="is_active"
                      defaultChecked={a.is_active}
                    />
                    Ativo
                  </label>
                  <Button size="sm" type="submit" disabled={!isAdmin(ctx.role)}>
                    Salvar
                  </Button>
                </form>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Estimativa de custo baseada nos preços públicos por token da Anthropic
        (cobrança em USD). Valores reais podem variar.
      </p>
    </div>
  );
}
