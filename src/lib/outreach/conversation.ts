/**
 * Espelha o estado do envio (outreach) na `conversations` — a fonte única de
 * acompanhamento para a usuária. NADA aqui é simulado: "entregue"/"lido" só
 * entram com status real vindo do webhook da Meta.
 *
 * Uma conversa por lead + canal (idempotente). O estado nunca "regride": um
 * webhook `delivered` que chega atrasado não desfaz um `read`; `replied` e
 * `opted_out` sempre vencem.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Admin = SupabaseClient<Database>;

export type OutreachState =
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "read"
  | "auto_replied"
  | "replied"
  | "failed"
  | "opted_out";

export type ReplyKind = "auto" | "human";
export type InterestStatus = "interested" | "not_interested";

/**
 * `auto_replied` fica entre `read` e `replied`: uma resposta automática
 * (bot/ausência) avança o acompanhamento, mas uma resposta humana posterior
 * sempre prevalece — nunca o contrário (rank de `replied` é maior).
 */
const RANK: Record<OutreachState, number> = {
  queued: 1,
  sending: 2,
  sent: 3,
  delivered: 4,
  read: 5,
  auto_replied: 6,
  replied: 7,
  failed: 8,
  opted_out: 9,
};

/**
 * Estado de acompanhamento resultante — avança, nunca regride. Puro.
 * `replied` e `opted_out` sempre vencem; `failed` não sobrescreve um envio que
 * já foi entregue/lido/respondido. Retorna `null` = manter o estado atual.
 */
export function resolveOutreachState(
  current: string | null,
  incoming: OutreachState,
): OutreachState | null {
  const prev = current ? (RANK[current as OutreachState] ?? 0) : 0;
  const next = RANK[incoming];
  if (incoming === "replied" || incoming === "opted_out") {
    return current === incoming ? null : incoming;
  }
  if (incoming === "failed" && prev >= RANK.delivered) return null;
  return next > prev ? incoming : null;
}

/** Estado da fila (`outreach_queue.status`) → estado de acompanhamento. */
export function queueStatusToState(status: string): OutreachState | null {
  switch (status) {
    case "draft":
    case "ready":
    case "scheduled":
      return "queued";
    case "sending":
      return "sending";
    case "sent":
      return "sent";
    case "delivered":
      return "delivered";
    case "read":
      return "read";
    case "replied":
      return "replied";
    case "failed":
      return "failed";
    case "opted_out":
      return "opted_out";
    default:
      return null; // skipped / cancelled — não vira acompanhamento
  }
}

/** Rótulo pt-BR + ícone para um estado de acompanhamento. */
export function outreachStateLabel(state: string | null): {
  label: string;
  icon: string;
  tone: "muted" | "info" | "success" | "danger" | "hot";
} {
  switch (state) {
    case "queued":
      return { label: "Na fila", icon: "🟡", tone: "muted" };
    case "sending":
      return { label: "Enviando", icon: "🔵", tone: "info" };
    case "sent":
      return { label: "Enviado", icon: "✓", tone: "info" };
    case "delivered":
      return { label: "Entregue", icon: "✓✓", tone: "success" };
    case "read":
      return { label: "Lido", icon: "👁", tone: "success" };
    case "auto_replied":
      return { label: "Resposta automática", icon: "🤖", tone: "info" };
    case "replied":
      return { label: "Respondeu", icon: "💬", tone: "hot" };
    case "failed":
      return { label: "Falhou", icon: "🔴", tone: "danger" };
    case "opted_out":
      return { label: "Opt-out", icon: "🚫", tone: "danger" };
    default:
      return { label: "—", icon: "•", tone: "muted" };
  }
}

/**
 * Um único badge por conversa — nunca vários vermelhos ao mesmo tempo.
 * Prioridade: precisa de você > sem interesse/opt-out > falhou >
 * resposta automática > interessado > estado de envio (fila/entregue/lido…).
 */
export function conversationBadge(row: {
  outreach_state: string | null;
  needs_attention: boolean;
  interest_status?: string | null;
}): { label: string; icon: string; tone: "muted" | "info" | "success" | "danger" | "hot" } {
  if (row.needs_attention) return { label: "Precisa de você", icon: "🔥", tone: "danger" };
  if (row.interest_status === "not_interested" || row.outreach_state === "opted_out")
    return { label: "Sem interesse", icon: "⚪", tone: "muted" };
  if (row.outreach_state === "failed") return { label: "Falhou", icon: "🔴", tone: "danger" };
  if (row.outreach_state === "auto_replied")
    return { label: "Resposta automática", icon: "🤖", tone: "info" };
  if (row.interest_status === "interested")
    return { label: "Interessado", icon: "🟢", tone: "success" };
  return outreachStateLabel(row.outreach_state);
}

/**
 * Garante a conversa de WhatsApp do lead (1 por lead+canal). Idempotente.
 * Retorna o id da conversa, ou null se não conseguiu.
 */
export async function ensureOutreachConversation(
  admin: Admin,
  args: { companyId: string; leadId: string; campaignId?: string | null; provider?: string },
): Promise<string | null> {
  const { data: existing } = await admin
    .from("conversations")
    .select("id")
    .eq("lead_id", args.leadId)
    .eq("channel", "whatsapp")
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await admin
    .from("conversations")
    .insert({
      company_id: args.companyId,
      lead_id: args.leadId,
      channel: "whatsapp",
      status: "open",
      provider: args.provider ?? "meta",
      outreach_campaign_id: args.campaignId ?? null,
    })
    .select("id")
    .single();
  if (error) {
    // corrida: outro processo criou — relê
    const { data: race } = await admin
      .from("conversations")
      .select("id")
      .eq("lead_id", args.leadId)
      .eq("channel", "whatsapp")
      .maybeSingle();
    return race?.id ?? null;
  }
  return created?.id ?? null;
}

/**
 * Aplica um estado de acompanhamento à conversa (avança, nunca regride).
 * `needsAttention`/`interestStatus`/`replyKind` são decididos pelo chamador
 * a partir do conteúdo da resposta — ver reply-classifier.ts.
 */
export async function markConversationOutreach(
  admin: Admin,
  args: {
    companyId: string;
    conversationId?: string | null;
    leadId?: string | null;
    campaignId?: string | null;
    state: OutreachState;
    at?: string;
    preview?: string | null;
    catalogSent?: boolean;
    /**
     * Define explicitamente se a conversa precisa de atendimento humano.
     * `undefined` = não altera (ex.: resposta automática não deve nem ligar
     * nem desligar o que já estava valendo). Deve ser calculado pelo chamador
     * a partir da classificação da resposta (ver reply-classifier.ts) — esta
     * função nunca decide sozinha que "recebeu resposta" = "precisa de você".
     */
    needsAttention?: boolean;
    /** Classificação da última resposta humana. `undefined` = não altera. */
    interestStatus?: InterestStatus | null;
    /** `auto` (bot/ausência) ou `human`. `undefined` = não altera. */
    replyKind?: ReplyKind | null;
  },
): Promise<void> {
  const at = args.at ?? new Date().toISOString();

  let convId = args.conversationId ?? null;
  let current: {
    id: string;
    outreach_state: string | null;
    needs_attention: boolean;
  } | null = null;

  if (convId) {
    const { data } = await admin
      .from("conversations")
      .select("id, outreach_state, needs_attention")
      .eq("id", convId)
      .maybeSingle();
    current = data ?? null;
  } else if (args.leadId) {
    const { data } = await admin
      .from("conversations")
      .select("id, outreach_state, needs_attention")
      .eq("lead_id", args.leadId)
      .eq("channel", "whatsapp")
      .maybeSingle();
    current = data ?? null;
    convId = current?.id ?? null;
  }

  if (!convId && args.leadId) {
    convId = await ensureOutreachConversation(admin, {
      companyId: args.companyId,
      leadId: args.leadId,
      campaignId: args.campaignId,
    });
  }
  if (!convId) return;

  const resolved = resolveOutreachState(current?.outreach_state ?? null, args.state);

  const patch: Database["public"]["Tables"]["conversations"]["Update"] = {
    last_message_at: at,
  };
  if (args.preview !== undefined && args.preview !== null)
    patch.last_message_preview = args.preview.slice(0, 160);
  if (args.campaignId) patch.outreach_campaign_id = args.campaignId;
  if (args.catalogSent) patch.catalog_sent = true;

  // Timestamp/estado "chegou uma resposta" é factual — atualiza mesmo quando
  // o rank não avança (ex.: 2ª resposta humana seguida, mesma classificação).
  if (args.state === "replied" || args.state === "auto_replied") {
    patch.last_inbound_at = at;
    patch.status = "pending";
  } else if (args.state === "opted_out") {
    patch.last_inbound_at = at;
  }

  if (resolved) {
    patch.outreach_state = args.state;
    if (args.state === "sending" || args.state === "sent") patch.last_outbound_at = at;
  }

  // needs_attention/interest/reply_kind refletem a ÚLTIMA resposta e são
  // decididos pelo chamador (classificação de conteúdo) — nunca implícitos
  // aqui a partir só de "chegou mensagem".
  if (args.replyKind !== undefined) patch.last_reply_kind = args.replyKind;
  if (args.interestStatus !== undefined) patch.interest_status = args.interestStatus;
  if (args.needsAttention !== undefined) {
    patch.needs_attention = args.needsAttention;
    if (args.needsAttention) {
      if (!current?.needs_attention) patch.attention_since = at;
    } else {
      patch.attention_since = null;
    }
  }

  await admin.from("conversations").update(patch).eq("id", convId);
}

/** Humano assumiu a conversa: limpa `needs_attention`. */
export async function markConversationHandled(
  admin: Admin,
  args: { conversationId: string; userId: string | null },
): Promise<void> {
  await admin
    .from("conversations")
    .update({
      needs_attention: false,
      handled_at: new Date().toISOString(),
      handled_by: args.userId,
      status: "pending",
    })
    .eq("id", args.conversationId);
}

/** Nº de conversas que precisam de atendimento humano (para o menu). */
export async function attentionCount(
  admin: Admin,
  companyId: string,
): Promise<number> {
  const { count } = await admin
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("needs_attention", true);
  return count ?? 0;
}
