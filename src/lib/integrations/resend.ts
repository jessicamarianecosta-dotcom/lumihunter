/**
 * Resend — envio de e-mail transacional/outbound.
 * Habilite com RESEND_ENABLED=true e RESEND_API_KEY no .env.
 */

const ENABLED = process.env.RESEND_ENABLED === "true";

export interface EmailSendResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
  simulated?: boolean;
}

interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

export async function sendEmail(args: SendEmailArgs): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = args.from || process.env.RESEND_FROM_EMAIL;

  if (!ENABLED || !apiKey || !from) {
    return {
      ok: true,
      simulated: true,
      providerMessageId: `sim_email_${Date.now()}`,
    };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: args.to,
        subject: args.subject,
        html: args.html,
        reply_to: args.replyTo,
        headers: args.headers,
      }),
    });
    const data = (await res.json()) as { id?: string; message?: string };
    if (!res.ok) return { ok: false, error: data.message || `HTTP ${res.status}` };
    return { ok: true, providerMessageId: data.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export type ResendEventType =
  | "email.sent"
  | "email.delivered"
  | "email.delivery_delayed"
  | "email.bounced"
  | "email.opened"
  | "email.clicked"
  | "email.complained";

export interface ResendEvent {
  type: ResendEventType;
  providerMessageId: string;
  to?: string;
}

export function parseResendEvent(payload: unknown): ResendEvent | null {
  const p = payload as {
    type?: string;
    data?: { email_id?: string; to?: string[] };
  };
  if (!p.type || !p.data?.email_id) return null;
  return {
    type: p.type as ResendEventType,
    providerMessageId: p.data.email_id,
    to: p.data.to?.[0],
  };
}

const STATUS_MAP: Record<string, string> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.opened": "read",
  "email.bounced": "bounced",
  "email.complained": "failed",
};

export function statusFromEvent(type: ResendEventType): string | null {
  return STATUS_MAP[type] ?? null;
}
