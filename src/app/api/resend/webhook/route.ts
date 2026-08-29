import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseResendEvent, statusFromEvent } from "@/lib/integrations/resend";

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => null);
  const event = parseResendEvent(payload);
  if (!event) return NextResponse.json({ ok: true });

  const status = statusFromEvent(event.type);
  if (!status) return NextResponse.json({ ok: true });

  const admin = createAdminClient();
  const now = new Date().toISOString();

  await admin
    .from("messages")
    .update({
      status: status as "sent" | "delivered" | "read" | "bounced" | "failed",
      ...(status === "delivered" ? { delivered_at: now } : {}),
      ...(status === "read" ? { read_at: now } : {}),
    })
    .eq("provider_message_id", event.providerMessageId);

  return NextResponse.json({ ok: true });
}
