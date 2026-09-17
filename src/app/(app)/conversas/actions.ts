"use server";

import { revalidatePath } from "next/cache";
import { getAppContext, canWrite } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

/**
 * Humano assume o atendimento de uma conversa que recebeu resposta.
 * Limpa `needs_attention` — a prospecção automática JÁ estava parada para este
 * contato (o webhook marca REPLIED e o worker nunca reabre um lead que respondeu).
 */
export async function assumeConversation(conversationId: string) {
  const ctx = await getAppContext();
  if (!canWrite(ctx.role)) throw new Error("sem permissão");
  const supabase = await createClient();

  await supabase
    .from("conversations")
    .update({
      needs_attention: false,
      handled_at: new Date().toISOString(),
      handled_by: ctx.userId,
      status: "pending",
    })
    .eq("id", conversationId)
    .eq("company_id", ctx.company.id);

  revalidatePath("/conversas");
  revalidatePath(`/conversas/${conversationId}`);
}

/**
 * Classificação manual do interesse do lead pela usuária — sobrescreve a
 * classificação automática da última resposta. "Sem interesse" também limpa
 * `needs_attention` (não precisa mais de ação).
 */
export async function setConversationInterest(
  conversationId: string,
  interest: "interested" | "not_interested",
) {
  const ctx = await getAppContext();
  if (!canWrite(ctx.role)) throw new Error("sem permissão");
  const supabase = await createClient();

  await supabase
    .from("conversations")
    .update({
      interest_status: interest,
      ...(interest === "not_interested"
        ? { needs_attention: false, attention_since: null }
        : {}),
    })
    .eq("id", conversationId)
    .eq("company_id", ctx.company.id);

  revalidatePath("/conversas");
  revalidatePath(`/conversas/${conversationId}`);
}

/** Encerra a conversa — some da lista de pendências, fica só no histórico. */
export async function closeConversation(conversationId: string) {
  const ctx = await getAppContext();
  if (!canWrite(ctx.role)) throw new Error("sem permissão");
  const supabase = await createClient();

  await supabase
    .from("conversations")
    .update({
      status: "closed",
      needs_attention: false,
      attention_since: null,
      handled_at: new Date().toISOString(),
      handled_by: ctx.userId,
    })
    .eq("id", conversationId)
    .eq("company_id", ctx.company.id);

  revalidatePath("/conversas");
  revalidatePath(`/conversas/${conversationId}`);
}
