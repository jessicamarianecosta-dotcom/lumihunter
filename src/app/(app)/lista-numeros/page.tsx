import type { Metadata } from "next";
import { getAppContext } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { listCatalogPdfs } from "@/lib/catalog/pdfs";
import { SweepPanel } from "@/components/app/sweep-panel";

export const metadata: Metadata = { title: "Lista de números" };

export default async function ListaNumerosPage() {
  const ctx = await getAppContext();
  const admin = createAdminClient();

  const [{ data: sweeps }, pdfs] = await Promise.all([
    admin
      .from("number_sweeps")
      .select(
        "id, name, ddd, quantity_target, sent_count, attempted_count, invalid_count, skipped_count, failed_count, status, interval_seconds, created_at",
      )
      .eq("company_id", ctx.company.id)
      .order("created_at", { ascending: false }),
    listCatalogPdfs(admin, ctx.company.id).catch(() => []),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Lista de números</h1>
        <p className="text-sm text-muted-foreground">
          Módulo 2 — informe um DDD e um número inicial e o LumiHunter gera os
          candidatos sequenciais e envia até atingir a quantidade de{" "}
          <strong>envios efetivos</strong> (números inválidos não contam e são
          pulados automaticamente).
        </p>
      </div>
      <SweepPanel
        sweeps={sweeps ?? []}
        catalogs={pdfs.map((p) => ({ id: p.id, label: p.file_name }))}
      />
    </div>
  );
}
