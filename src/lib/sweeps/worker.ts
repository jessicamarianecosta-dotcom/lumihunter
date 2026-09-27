/**
 * Módulo 2 — worker do envio para lista sequencial de números.
 *
 * Gera candidatos (ddd + próximo número), tenta enviar UM por vez e só avança
 * a meta (`sent_count`) em envio CONFIRMADO. Número inválido/sem WhatsApp não
 * conta como envio: é registrado e o worker segue para o próximo candidato
 * automaticamente, sem intervenção. Reaproveita o mesmo serviço de envio
 * WhatsApp e o mesmo classificador de erro da fila de prospecção por
 * campanha — nenhum mecanismo aqui tenta burlar limites ou detecção da Meta.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { normalizePhoneBR } from "@/lib/utils";
import { sendMessage, sendDocument } from "@/lib/whatsapp/service";
import { classifyWhatsAppError } from "@/lib/outreach/eligibility";
import { isBlocked } from "@/lib/outreach/optout";
import { resolveCampaignCatalog } from "@/lib/catalog/pdfs";
import { withinWindow, nextWindowStart, intervalElapsed } from "@/lib/outreach/window";
import { candidateToPhone, nextCandidate } from "./candidates";

type Admin = SupabaseClient<Database>;

const CIRCUIT_BREAKER = 8;
/** limite de candidatos puramente inválidos tentados num único tick, pra não passar o tempo todo pulando números. */
const MAX_SKIP_CHAIN = 25;

export type SweepTickOutcome =
  | { kind: "sent"; phone: string; remaining: number }
  | { kind: "invalid_chain"; attempted: number; remaining: number }
  | { kind: "failed"; reason: string; remaining: number }
  | { kind: "completed" }
  | { kind: "exhausted" }
  | { kind: "waiting"; reason: string; nextAt: string | null }
  | { kind: "paused"; reason: string }
  | { kind: "not_running"; reason: string };

interface SweepRow {
  id: string;
  company_id: string;
  ddd: string;
  next_number: number | string;
  quantity_target: number;
  sent_count: number;
  attempted_count: number;
  invalid_count: number;
  skipped_count: number;
  failed_count: number;
  status: string;
  message_templates: unknown;
  next_template_index: number;
  catalog_pdf_id: string | null;
  interval_seconds: number;
  window_start: string | null;
  window_end: string | null;
  timezone: string;
  last_sent_at: string | null;
  consecutive_errors: number;
}

function pickTemplate(sweep: SweepRow): { text: string; index: number } {
  const templates = Array.isArray(sweep.message_templates)
    ? (sweep.message_templates as string[]).filter((t) => t?.trim())
    : [];
  if (templates.length === 0) return { text: "", index: 0 };
  const idx = sweep.next_template_index % templates.length;
  return { text: templates[idx], index: idx };
}

async function fetchCompanyName(admin: Admin, companyId: string): Promise<string> {
  const { data } = await admin
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .maybeSingle();
  return data?.name ?? "LumiLife";
}

/**
 * Uma "rodada" = tenta candidatos até conseguir UM envio confirmado, até
 * esgotar a faixa de números, ou até `MAX_SKIP_CHAIN` inválidos seguidos
 * (protege o orçamento de tempo do cron; a próxima chamada continua do
 * mesmo cursor).
 */
export async function sendNextForSweep(
  admin: Admin,
  sweepId: string,
  opts: { manual?: boolean } = {},
): Promise<SweepTickOutcome> {
  const now = new Date();

  const { data: sweepData } = await admin
    .from("number_sweeps")
    .select("*")
    .eq("id", sweepId)
    .maybeSingle();
  if (!sweepData) return { kind: "not_running", reason: "sweep não encontrada" };
  const sweep = sweepData as unknown as SweepRow;

  if (sweep.status !== "running")
    return { kind: "not_running", reason: "sweep não está em execução" };

  if (sweep.sent_count >= sweep.quantity_target) {
    await admin
      .from("number_sweeps")
      .update({ status: "completed" })
      .eq("id", sweepId);
    return { kind: "completed" };
  }

  if (sweep.consecutive_errors >= CIRCUIT_BREAKER) {
    await admin.from("number_sweeps").update({ status: "paused" }).eq("id", sweepId);
    await admin.from("activities").insert({
      company_id: sweep.company_id,
      kind: "system",
      title: "Envio para lista de números pausado",
      body: "Pausado automaticamente após erros consecutivos. Verifique a integração do WhatsApp.",
    });
    return { kind: "paused", reason: "erros consecutivos" };
  }

  const tz = sweep.timezone || "America/Sao_Paulo";
  const windowStart = sweep.window_start || "00:00";
  const windowEnd = sweep.window_end || "00:00";
  if (!opts.manual && !withinWindow(now, windowStart, windowEnd, tz)) {
    return {
      kind: "waiting",
      reason: "fora do horário permitido",
      nextAt: nextWindowStart(now, windowStart, windowEnd, tz).toISOString(),
    };
  }
  if (!opts.manual && !intervalElapsed(sweep.last_sent_at, sweep.interval_seconds, now)) {
    const nextAt = sweep.last_sent_at
      ? new Date(new Date(sweep.last_sent_at).getTime() + sweep.interval_seconds * 1000).toISOString()
      : null;
    return { kind: "waiting", reason: "aguardando intervalo mínimo", nextAt };
  }

  const companyName = await fetchCompanyName(admin, sweep.company_id);
  const catalog = sweep.catalog_pdf_id
    ? await resolveCampaignCatalog(admin, sweep.company_id, sweep.catalog_pdf_id, companyName)
    : null;

  let cursor = BigInt(sweep.next_number);
  let skipChain = 0;

  while (skipChain < MAX_SKIP_CHAIN) {
    const phone = candidateToPhone(sweep.ddd, cursor);
    if (!phone) {
      await admin.from("number_sweeps").update({ status: "completed" }).eq("id", sweepId);
      return { kind: "exhausted" };
    }
    const normalized = normalizePhoneBR(phone)!;

    // já tentado antes (retomada de sweep pausada) — avança sem reprocessar.
    const { data: already } = await admin
      .from("number_sweep_attempts")
      .select("id")
      .eq("sweep_id", sweepId)
      .eq("candidate_number", Number(cursor))
      .maybeSingle();
    if (already) {
      const next = nextCandidate(cursor);
      if (!next) {
        await admin.from("number_sweeps").update({ status: "completed" }).eq("id", sweepId);
        return { kind: "exhausted" };
      }
      cursor = next;
      continue;
    }

    const blocked = await isBlocked(admin, sweep.company_id, normalized);
    if (blocked) {
      await admin.from("number_sweep_attempts").insert({
        sweep_id: sweepId,
        company_id: sweep.company_id,
        candidate_number: Number(cursor),
        phone: normalized,
        status: "skipped",
        failure_code: "opted_out",
        failure_reason: "contato optou por não receber mensagens",
      });
      await admin
        .from("number_sweeps")
        .update({
          skipped_count: sweep.skipped_count + 1,
          attempted_count: sweep.attempted_count + 1,
          next_number: Number(cursor + 1n),
        })
        .eq("id", sweepId);
      const next = nextCandidate(cursor);
      if (!next) return { kind: "exhausted" };
      cursor = next;
      skipChain++;
      continue;
    }

    const { text: template, index } = pickTemplate(sweep);
    const body = template || "Olá! Tudo bem?";

    const result = await sendMessage(sweep.company_id, { to: normalized, body });

    if (!result.ok) {
      const err = classifyWhatsAppError(result.error);
      await admin.from("number_sweep_attempts").insert({
        sweep_id: sweepId,
        company_id: sweep.company_id,
        candidate_number: Number(cursor),
        phone: normalized,
        status: err.invalidNumber ? "invalid" : "failed",
        failure_code: err.code,
        failure_reason: result.error ?? "falha no envio",
        message_template_used: body,
      });

      if (err.invalidNumber) {
        await admin
          .from("number_sweeps")
          .update({
            invalid_count: sweep.invalid_count + 1,
            attempted_count: sweep.attempted_count + 1,
            next_number: Number(cursor + 1n),
          })
          .eq("id", sweepId);
        const next = nextCandidate(cursor);
        if (!next) return { kind: "exhausted" };
        cursor = next;
        skipChain++;
        continue;
      }

      // erro não relacionado ao número (auth, rate limit, transitório): não avança o
      // cursor — a próxima chamada tenta o MESMO candidato de novo.
      await admin
        .from("number_sweeps")
        .update({
          failed_count: sweep.failed_count + 1,
          attempted_count: sweep.attempted_count + 1,
          consecutive_errors: sweep.consecutive_errors + 1,
        })
        .eq("id", sweepId);
      return {
        kind: "failed",
        reason: result.error ?? "falha no envio",
        remaining: sweep.quantity_target - sweep.sent_count,
      };
    }

    // ── Envio confirmado ────────────────────────────────────────────────
    let catalogSent = false;
    if (catalog) {
      const doc = await sendDocument(sweep.company_id, {
        to: normalized,
        link: catalog.url,
        filename: catalog.filename,
      });
      catalogSent = doc.ok;
      if (!doc.ok) console.error("[sweeps] catálogo não enviado:", doc.error);
    }

    await admin.from("number_sweep_attempts").insert({
      sweep_id: sweepId,
      company_id: sweep.company_id,
      candidate_number: Number(cursor),
      phone: normalized,
      status: "sent",
      provider_message_id: result.providerMessageId ?? null,
      message_template_used: body,
    });

    const newSentCount = sweep.sent_count + 1;
    await admin
      .from("number_sweeps")
      .update({
        sent_count: newSentCount,
        attempted_count: sweep.attempted_count + 1,
        next_number: Number(cursor + 1n),
        next_template_index: (index + 1) % Math.max(1, (sweep.message_templates as unknown[])?.length || 1),
        last_sent_at: now.toISOString(),
        consecutive_errors: 0,
        status: newSentCount >= sweep.quantity_target ? "completed" : "running",
      })
      .eq("id", sweepId);

    await admin.from("activities").insert({
      company_id: sweep.company_id,
      kind: "whatsapp",
      title: result.simulated ? "WhatsApp enviado (simulação)" : "WhatsApp enviado",
      body: `Lista de números — ${normalized}${catalogSent ? " + catálogo" : ""}`,
    });

    return {
      kind: "sent",
      phone: normalized,
      remaining: Math.max(0, sweep.quantity_target - newSentCount),
    };
  }

  // esgotou a cadeia de inválidos neste tick sem conseguir 1 envio — a
  // próxima chamada do cron continua do cursor já avançado, sem duplicar.
  return { kind: "invalid_chain", attempted: skipChain, remaining: sweep.quantity_target - sweep.sent_count };
}

/** Para o cron: drena as sweeps com status "running", respeitando o intervalo. */
export async function drainRunningSweeps(
  admin: Admin,
  opts: { budgetMs?: number } = {},
): Promise<{ sweeps: number; sent: number; invalid: number; failed: number }> {
  const budgetMs = opts.budgetMs ?? 60_000;
  const deadline = Date.now() + budgetMs;

  const { data: sweeps } = await admin
    .from("number_sweeps")
    .select("id, interval_seconds")
    .eq("status", "running");

  let sent = 0;
  let invalid = 0;
  let failed = 0;
  const touched = new Set<string>();

  for (const s of sweeps ?? []) {
    while (Date.now() < deadline) {
      const r = await sendNextForSweep(admin, s.id);
      touched.add(s.id);
      if (r.kind === "sent") {
        sent++;
        const waitMs = Math.min((s.interval_seconds || 30) * 1000, Math.max(0, deadline - Date.now()));
        if (waitMs > 0 && r.remaining > 0) await new Promise((res) => setTimeout(res, waitMs));
        continue;
      }
      if (r.kind === "invalid_chain") {
        invalid += r.attempted;
        continue; // segue tentando dentro do mesmo tick, mesmo orçamento de tempo
      }
      if (r.kind === "failed") {
        failed++;
        break; // erro não relacionado ao número — deixa para a próxima execução do cron
      }
      break; // completed | exhausted | waiting | paused | not_running
    }
  }

  return { sweeps: touched.size, sent, invalid, failed };
}
