/**
 * Ciclo de vida de uma rodada de descoberta. Funções puras.
 *
 * Cada clique em "Procurar possíveis leads" abre uma RODADA nova
 * (`discovery_runs`). As descobertas ficam presas à rodada (`discovery_run_id`)
 * e a campanha aponta para a última rodada concluída
 * (`campaigns.current_discovery_run_id`). A tela e os contadores olham só a
 * rodada atual — nada de acumular.
 *
 * Exceção: uma descoberta que já virou lead aprovado carrega o `status` e o
 * `lead_id` para a nova rodada (o lead e o campaign_target continuam intactos
 * no CRM independentemente da rodada).
 */
import type { DiscoveredCompany } from "./types";

export interface PriorApproval {
  lead_id: string | null;
  approved_at: string | null;
  approved_by: string | null;
}

export type DiscoveryStatus = "approved" | "rejected" | "qualified" | "discovered";

/** Status da descoberta nesta rodada, honrando aprovações de rodadas anteriores. */
export function resolveRowStatus(
  c: Pick<DiscoveredCompany, "competitor" | "qualification">,
  prior: PriorApproval | undefined,
): DiscoveryStatus {
  if (prior) return "approved";
  if (c.competitor) return "rejected";
  if (c.qualification === "high" || c.qualification === "medium") return "qualified";
  return "discovered";
}

export interface RunStats {
  found: number;
  prospectable: number;
  qualified: number;
  competitors: number;
  noWhatsapp: number;
}

/** Contadores da RODADA (só as descobertas desta rodada). */
export function runStats(candidates: DiscoveredCompany[]): RunStats {
  return {
    found: candidates.length,
    prospectable: candidates.filter((c) => !c.competitor && c.whatsappVerified).length,
    qualified: candidates.filter(
      (c) => !c.competitor && (c.qualification === "high" || c.qualification === "medium"),
    ).length,
    competitors: candidates.filter((c) => c.competitor).length,
    noWhatsapp: candidates.filter((c) => !c.competitor && !c.whatsappVerified).length,
  };
}
