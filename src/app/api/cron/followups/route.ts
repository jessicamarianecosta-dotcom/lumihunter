import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMessage as sendWhatsAppMessage } from "@/lib/whatsapp/service";
import { normalizePhoneBR } from "@/lib/utils";

/**
 * Processa a fila de follow-up das campanhas.
 * Protegido por CRON_SECRET (Authorization: Bearer ...). Configure em vercel.json.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    auth !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: due } = await admin
    .from("campaign_targets")
    .select("id, company_id, campaign_id, lead_id, step")
    .eq("status", "pending")
    .lte("next_action_at", nowIso)
    .limit(50);

  let processed = 0;
  for (const t of due ?? []) {
    const { data: campaign } = await admin
      .from("campaigns")
      .select("channel, followup_sequence_id, template_id, status")
      .eq("id", t.campaign_id)
      .maybeSingle();
    if (!campaign || campaign.status !== "active") continue;

    // pára se o lead já respondeu
    const { count } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", t.lead_id)
      .eq("direction", "inbound");
    if ((count ?? 0) > 0) {
      await admin
        .from("campaign_targets")
        .update({ status: "replied" })
        .eq("id", t.id);
      continue;
    }

    const { data: seq } = campaign.followup_sequence_id
      ? await admin
          .from("followup_sequences")
          .select("steps")
          .eq("id", campaign.followup_sequence_id)
          .maybeSingle()
      : { data: null };

    const steps = (seq?.steps as { day: number; body?: string }[] | null) ?? [];
    const stepDef = steps[t.step];
    if (!stepDef) {
      await admin
        .from("campaign_targets")
        .update({ status: "sent" })
        .eq("id", t.id);
      continue;
    }

    const { data: lead } = await admin
      .from("leads")
      .select("id, whatsapp, phone")
      .eq("id", t.lead_id)
      .maybeSingle();
    const to = normalizePhoneBR(lead?.whatsapp ?? lead?.phone);
    if (to && stepDef.body) {
      await sendWhatsAppMessage(t.company_id, { to, body: stepDef.body });
    }

    const nextStep = steps[t.step + 1];
    await admin
      .from("campaign_targets")
      .update({
        step: t.step + 1,
        last_message_at: nowIso,
        next_action_at: nextStep
          ? new Date(
              Date.now() +
                (nextStep.day - stepDef.day) * 24 * 60 * 60 * 1000,
            ).toISOString()
          : null,
        status: nextStep ? "pending" : "sent",
      })
      .eq("id", t.id);
    processed++;
  }

  return NextResponse.json({ due: due?.length ?? 0, processed });
}
