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
  const patch: Record<string, unknown> = { status };
  if (status === "delivered")
    patch.delivered_at = new Date().toISOString();
  if (status === "read") patch.read_at = new Date().toISOString();

  await admin
    .from("messages")
    .update(patch)
    .eq("provider_message_id", event.providerMessageId);

  return NextResponse.json({ ok: true });
}
