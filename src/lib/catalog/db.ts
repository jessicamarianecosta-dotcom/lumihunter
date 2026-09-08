/**
 * Cliente Supabase tipado para as tabelas da Base Comercial.
 *
 * Enquanto a migration `20260908210000_base_comercial.sql` não é aplicada e o
 * `database.generated.ts` regerado, as novas tabelas não existem no schema
 * tipado principal. Este client isola esses tipos para não mexer no
 * `Database` global (que o resto da app usa).
 *
 * BYPASSA RLS (service-role) — todo acesso filtra `company_id` no código.
 */
import { createClient } from "@supabase/supabase-js";
import type {
  CatalogEvent,
  CatalogImportJob,
  CatalogSource,
  Json,
  ProductCatalogColumns,
  ProductVariantRow,
  ProductVariationGroupRow,
  ProductVariationOptionRow,
} from "@/lib/supabase/database.types";

type Tbl<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

type ProductsCatalogRow = ProductCatalogColumns & {
  id: string;
  company_id: string;
  category_id: string | null;
  name: string;
  kind: string;
  description: string | null;
  is_active: boolean;
  keywords: string[];
  applications: string[];
  tags: string[];
  price_avg: number | null;
  price_start: number | null;
};

export type CatalogDatabase = {
  __InternalSupabase: { PostgrestVersion: "14.5" };
  public: {
    Tables: {
      products: Tbl<ProductsCatalogRow>;
      product_categories: Tbl<{ id: string; company_id: string; name: string }>;
      catalog_sources: Tbl<CatalogSource>;
      product_variation_groups: Tbl<ProductVariationGroupRow>;
      product_variation_options: Tbl<ProductVariationOptionRow>;
      product_variants: Tbl<ProductVariantRow>;
      catalog_import_jobs: Tbl<CatalogImportJob>;
      catalog_events: Tbl<CatalogEvent>;
    };
    Views: { [_ in never]: never };
    Functions: {
      search_commercial_catalog: {
        Args: { p_company_id: string; p_query: string; p_limit?: number };
        Returns: {
          product_id: string;
          name: string;
          description: string | null;
          source: string;
          is_active: boolean;
          rank: number;
        }[];
      };
    };
    Enums: { catalog_source_kind: "manual" | "pdf" | "precy_online" };
    CompositeTypes: { [_ in never]: never };
  };
}

export type { Json };

export function catalogAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente");
  return createClient<CatalogDatabase>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type CatalogAdmin = ReturnType<typeof catalogAdmin>;
