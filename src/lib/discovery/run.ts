/**
 * Ciclo de vida de uma rodada de descoberta. Funções puras.
 *
 * Cada clique em "Procurar possíveis leads" abre uma RODADA nova
 * (`discovery_runs`). As descobertas ficam presas à rodada (`discovery_run_id`)
 * e a campanha aponta para a última rodada concluída
 * (`campaigns.current_discovery_run_id`). A tela e os contadores olham só a
 * rodada atual — nada de acumular.
 *
 * Um resultado só vira LEAD (status "qualified" → aparece na lista principal)
 * se passou em TODOS os gates (`prospectable`). Todo o resto entra como
 * "rejected" e fica apenas na aba "Descartados" (auditoria).
 *
 * Exceção: uma descoberta que já virou lead aprovado carrega o `status` e o
 * `lead_id` para a nova rodada.
 */
import type { DiscoveredCompany } from "./types";

export interface PriorApproval {
  lead_id: string | null;
  approved_at: string | null;
  approved_by: string | null;
}

export type DiscoveryStatus = "approved" | "rejected" | "qualified";

/** Status da descoberta nesta rodada, honrando aprovações de rodadas anteriores. */
export function resolveRowStatus(
  c: Pick<DiscoveredCompany, "prospectable">,
  prior: PriorApproval | undefined,
): DiscoveryStatus {
  if (prior) return "approved";
  return c.prospectable ? "qualified" : "rejected";
}

export interface RunStats {
  /** LEADS válidos da rodada (passaram em todos os gates). */
  found: number;
  /** Candidatos que chegaram à qualificação (após hard filter). */
  screened: number;
  /** Reprovados na qualificação. */
  rejected: number;
  competitors: number;
  noWhatsapp: number;
}

/** Contadores da RODADA. `qualified` = LEADS válidos; o resto é descarte. */
export function runStats(
  qualified: DiscoveredCompany[],
  rejected: DiscoveredCompany[],
): RunStats {
  return {
    found: qualified.length,
    screened: qualified.length + rejected.length,
    rejected: rejected.length,
    competitors: rejected.filter((c) => c.competitor).length,
    noWhatsapp: rejected.filter(
      (c) => !c.competitor && c.resultType === "business" && !c.whatsappVerified,
    ).length,
  };
}
