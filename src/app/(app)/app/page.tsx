import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { getAppContext } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getOrCreateOperationalCampaign,
  getProspeccaoSnapshot,
  syncApprovedProspeccaoTemplate,
} from "@/lib/prospeccao";
import { listCatalogPdfs } from "@/lib/catalog/pdfs";
import { DEFAULT_BASE_MESSAGE } from "@/lib/outreach/vars";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProspeccaoPanel } from "@/components/app/prospeccao-panel";

export const metadata: Metadata = { title: "Prospecção" };

export default async function ProspeccaoPage() {
  const ctx = await getAppContext();
  const admin = createAdminClient();

  const campaign = await getOrCreateOperationalCampaign(
    admin,
    ctx.company.id,
    ctx.userId,
  );
  // mantém o template de prospecção vinculado assim que a Meta aprovar
  const templateState = await syncApprovedProspeccaoTemplate(admin, ctx.company.id);
  const [snapshot, pdfs] = await Promise.all([
    getProspeccaoSnapshot(admin, ctx.company.id, campaign),
    listCatalogPdfs(admin, ctx.company.id).catch(() => []),
  ]);

  const progress = [
    { label: "Encontrados", value: snapshot.found },
    { label: "Com WhatsApp", value: snapshot.withWhatsapp },
    { label: "Novos contatos", value: snapshot.fresh },
    { label: "Abordados hoje", value: snapshot.approachedToday },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Prospecção</h1>
        <p className="text-sm text-muted-foreground">
          Escolha o segmento e a região, e o LumiHunter pesquisa empresas,
          encontra o WhatsApp comercial e faz a abordagem com o catálogo da{" "}
          {ctx.company.name}.
        </p>
      </div>

      {templateState !== "approved" && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {templateState === "pending"
            ? "O template de WhatsApp está em análise pela Meta. A pesquisa já funciona; a abordagem começa a enviar automaticamente assim que ele for aprovado (costuma sair em minutos a algumas horas)."
            : "O template de WhatsApp para abordagem ainda não está pronto. Vá em Configurações → WhatsApp para criá-lo. A pesquisa de empresas já funciona normalmente."}
        </div>
      )}

      <Card>
        <CardContent className="p-5">
          <ProspeccaoPanel
            defaults={{
              segment: campaign.audience_text ?? "",
              regions: (campaign.regions ?? []).join(", "),
              quantity: campaign.max_opportunities ?? 100,
              catalogPdfId: campaign.outreach_catalog_pdf_id ?? "",
              message: campaign.outreach_base_message ?? DEFAULT_BASE_MESSAGE,
            }}
            catalogs={pdfs.map((p) => ({
              id: p.id,
              label: p.file_name,
            }))}
          />
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">
          Progresso
          {snapshot.running && (
            <span className="ml-2 text-emerald-600">· abordagem em andamento</span>
          )}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {progress.map((p) => (
            <Card key={p.label}>
              <CardContent className="p-4">
                <p className="text-2xl font-semibold tabular-nums">{p.value}</p>
                <p className="text-xs text-muted-foreground">{p.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="flex items-center justify-between p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg bg-secondary">
              <MessageCircle className="size-4 text-accent" />
            </span>
            <div>
              <p className="font-medium">Conversas</p>
              <p className="text-xs text-muted-foreground">
                {snapshot.replies > 0
                  ? `${snapshot.replies} cliente(s) responderam e aguardam atendimento`
                  : "Nenhuma resposta aguardando no momento"}
              </p>
            </div>
          </div>
          <Button asChild variant={snapshot.replies > 0 ? "default" : "outline"}>
            <Link href="/conversas">Ver conversas</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
