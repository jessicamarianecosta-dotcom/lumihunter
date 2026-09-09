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
