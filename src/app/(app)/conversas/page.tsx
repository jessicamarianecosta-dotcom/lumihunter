import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDatePtBR } from "@/lib/utils";

export const metadata: Metadata = { title: "Conversas" };

export default async function ConversasPage() {
  const ctx = await getAppContext();
  const supabase = await createClient();
  const { data: conversations } = await supabase
    .from("conversations")
    .select("*, leads(id, name)")
    .eq("company_id", ctx.company.id)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(100);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Conversas</h1>
        <p className="text-sm text-muted-foreground">
          Central única de WhatsApp e e-mail.
        </p>
      </div>

      <div className="space-y-2">
        {(conversations ?? []).map((c) => {
          const lead = c.leads as { id: string; name: string } | null;
          return (
            <Link
              key={c.id}
              href={lead ? `/leads/${lead.id}` : "#"}
              className="block"
            >
              <Card>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-medium">
                      {lead?.name ?? "Lead"}{" "}
                      <Badge variant="outline">{c.channel}</Badge>
                      {c.unread_count > 0 && (
                        <Badge variant="danger" className="ml-1">
                          {c.unread_count}
                        </Badge>
                      )}
                    </p>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      {c.last_message_preview ?? "—"}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {c.last_message_at ? formatDatePtBR(c.last_message_at) : ""}
                  </span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
        {(!conversations || conversations.length === 0) && (
          <p className="text-sm text-muted-foreground">
            Nenhuma conversa ainda. Envie a primeira mensagem a partir de um lead.
          </p>
        )}
      </div>
    </div>
  );
}
