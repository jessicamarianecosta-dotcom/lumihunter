import type { Metadata } from "next";
import { getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createProduct } from "./actions";
import { CsvImportButton, CsvExportButton } from "@/components/shared/csv-tools";
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Produtos</h1>
          <p className="text-sm text-muted-foreground">
            O catálogo alimenta os agentes Hunter e Copywriter.
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <CsvImportButton
            endpoint="/api/products/import"
            hint="Colunas: nome, tipo, descrição, preço_médio, palavras-chave…"
          />
          <CsvExportButton href="/api/products/export" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
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
            <p className="text-sm text-muted-foreground">
              Nenhum produto cadastrado.
            </p>
          )}
        </div>

        <Card className="h-fit">
          <CardContent className="p-4">
            <p className="text-sm font-medium">Novo produto</p>
            <form action={createProduct} className="mt-3 space-y-3">
              <F name="name" label="Nome" required />
              <div className="space-y-1.5">
                <Label htmlFor="kind">Tipo</Label>
                <select
                  id="kind"
                  name="kind"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="product">Produto</option>
                  <option value="service">Serviço</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">Descrição</Label>
                <Textarea id="description" name="description" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <F name="price_start" label="Preço inicial" type="number" />
                <F name="price_avg" label="Preço médio" type="number" />
                <F name="min_quantity" label="Qtd. mínima" type="number" />
                <F name="lead_time_days" label="Prazo (dias)" type="number" />
              </div>
              <F name="keywords" label="Palavras-chave (vírgula)" />
              <F name="applications" label="Aplicações (vírgula)" />
              <F name="cities_served" label="Cidades atendidas (vírgula)" />
              <F name="example_buyers" label="Exemplos de compradores (vírgula)" />
              <F name="ideal_audience" label="Público ideal" />
              <Button type="submit" className="w-full">
                Adicionar
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function F({
  name,
  label,
  ...props
}: { name: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
  );
}
