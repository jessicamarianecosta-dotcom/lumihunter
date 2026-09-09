/**
 * Opt-out — OBRIGATÓRIO. Se o lead pede para não receber, nunca mais entra na
 * fila de prospecção, mesmo em outra campanha da mesma empresa.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { phoneMatchCandidates } from "@/lib/utils";

type Admin = SupabaseClient<Database>;

const OPT_OUT_RE =
  /\b(n[ãa]o\s+quero(?:\s+(?:receber|mais|nada))?|sem\s+interesse|n[ãa]o\s+(?:tenho|há)\s+interesse|n[ãa]o\s+me\s+(?:envie|mande|manda|mandem|perturbe)|pode\s+parar|par[ae]r?\s+de\s+(?:enviar|mandar)|me\s+(?:tire|remova|exclua)|descadastr\w*|remover\s+(?:meu|da)\s+(?:cadastro|lista|contato)|unsubscribe|\bstop\b|\bpare\b|n[ãa]o\s+perturbe)/i;

/** Heurística: a mensagem do lead parece um pedido de opt-out? Pura. */
export function looksLikeOptOut(text: string): boolean {
  return OPT_OUT_RE.test(text.trim());
}

/** O telefone está bloqueado para WhatsApp nesta empresa? */
export async function isBlocked(
  admin: Admin,
  companyId: string,
  phone: string | null,
): Promise<boolean> {
  if (!phone) return false;
  const candidates = phoneMatchCandidates(phone);
  if (candidates.length === 0) return false;
  const { data } = await admin
    .from("blacklist")
    .select("id")
    .eq("company_id", companyId)
    .eq("channel", "whatsapp")
    .in("value", candidates)
    .limit(1);
  return !!(data && data.length);
}

/** Registra o opt-out: blacklist + consents + activity. Idempotente. */
export async function recordOptOut(
  admin: Admin,
  args: {
    companyId: string;
    leadId: string | null;
    phone: string;
    source: string;
  },
): Promise<void> {
  const value = phoneMatchCandidates(args.phone)[0] ?? args.phone.replace(/\D/g, "");

  await admin
    .from("blacklist")
    .upsert(
      {
        company_id: args.companyId,
        channel: "whatsapp",
        value,
        reason: `opt-out (${args.source})`,
      },
      { onConflict: "company_id,channel,value", ignoreDuplicates: true },
    );

  await admin.from("consents").insert({
    company_id: args.companyId,
    lead_id: args.leadId,
    channel: "whatsapp",
    kind: "opt_out",
    source: args.source,
    detail: { phone: value },
  });

  if (args.leadId) {
    await admin.from("activities").insert({
      company_id: args.companyId,
      lead_id: args.leadId,
      kind: "system",
      title: "Opt-out de WhatsApp",
      body: `O contato pediu para não receber mensagens (${args.source}). Bloqueado para novas prospecções.`,
    });
  }
}
