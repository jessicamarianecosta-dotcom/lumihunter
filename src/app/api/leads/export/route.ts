import { tryGetContext } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { toCsv } from "@/lib/csv";

const HEADERS = [
  "name",
  "legal_name",
  "cnpj",
  "segment",
  "city",
  "state",
  "phone",
  "whatsapp",
  "email",
  "website",
  "instagram",
  "status",
  "score",
  "source",
  "discovered_at",
];

export async function GET() {
  const ctx = await tryGetContext();
  if (!ctx) return new Response("não autenticado", { status: 401 });

  const admin = createAdminClient();
  const { data } = await admin
    .from("leads")
    .select(HEADERS.join(","))
    .eq("company_id", ctx.company.id)
    .order("created_at", { ascending: false })
    .limit(5000);

  const csv = toCsv(HEADERS, (data ?? []) as unknown as Record<string, unknown>[]);
  const date = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${date}.csv"`,
    },
  });
}
