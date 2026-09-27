import type { Metadata } from "next";
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
import { ProspeccaoPanel } from "@/components/app/prospeccao-panel";
import { ProspeccaoProgress } from "@/components/app/prospeccao-progress";
import { LeadsDiscoveryList } from "@/components/leads/leads-discovery-list";

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

  const regionsLabel = (campaign.regions ?? []).join(", ");
  const campaignName =
    [campaign.audience_text, regionsLabel].filter(Boolean).join(" — ") || "Prospecção";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
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
              regions: regionsLabel,
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

      <ProspeccaoProgress
        initial={{
          campaignName,
          found: snapshot.found,
          withWhatsapp: snapshot.withWhatsapp,
          fresh: snapshot.fresh,
          approachedToday: snapshot.approachedToday,
          replies: snapshot.replies,
          running: snapshot.running,
          searching: snapshot.searching,
          target: snapshot.target,
        }}
      />

      <div>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">
          Leads encontrados
        </h2>
        <LeadsDiscoveryList
          campaignId={campaign.id}
          runId={campaign.current_discovery_run_id}
        />
      </div>
    </div>
  );
}
