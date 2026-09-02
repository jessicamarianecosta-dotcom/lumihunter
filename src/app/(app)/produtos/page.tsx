import type { Metadata } from "next";
import { getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CsvImportButton, CsvExportButton } from "@/components/shared/csv-tools";
import { AddProductButton } from "@/components/produtos/add-product-button";
import { formatCurrencyBRL } from "@/lib/utils";
import type { Product } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Produtos" };

export default async function ProductsPage() {
  const ctx = await getAppContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("company_id", ctx.company.id)
    .order("created_at", { ascending: false });
  const products = (data ?? []) as Product[];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Produtos</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie os produtos e serviços oferecidos pela sua empresa. O catálogo
            alimenta os agentes Hunter e Copywriter.
          </p>
        </div>
        <AddProductButton />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <CsvImportButton
          endpoint="/api/products/import"
          hint="Colunas: nome, tipo, descrição, preço_médio, palavras-chave…"
        />
        <CsvExportButton href="/api/products/export" />
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Produtos cadastrados
        </h2>
        {products.map((p) => (
          <Card key={p.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">
                    {p.name}{" "}
                    <Badge variant={p.is_active ? "success" : "secondary"}>
                      {p.is_active ? "ativo" : "inativo"}
                    </Badge>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {p.description ?? "—"}
                  </p>
                </div>
                <span className="text-sm text-muted-foreground">
                  {formatCurrencyBRL(p.price_avg)}
                </span>
              </div>
              {p.keywords.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.keywords.map((k) => (
                    <Badge key={k} variant="outline">
                      {k}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {products.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum produto cadastrado.</p>
        )}
      </div>
    </div>
  );
}
