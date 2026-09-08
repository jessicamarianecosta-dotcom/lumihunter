"use server";

import { revalidatePath } from "next/cache";
import { getAppContext, canWrite } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { upsertSource, removeSource } from "@/lib/catalog/sources";
import { parseStoreSlug } from "@/lib/catalog/providers/precy";

export interface CatalogUrlResult {
  ok: boolean;
  error?: string;
}

/** Salva/atualiza a URL do catálogo online (Precy+) da empresa. */
export async function saveCatalogOnlineUrl(
  _prev: CatalogUrlResult | null,
  formData: FormData,
): Promise<CatalogUrlResult> {
  const ctx = await getAppContext();
  if (!canWrite(ctx.role)) return { ok: false, error: "sem permissão" };

  const url = String(formData.get("url") || "").trim();
  if (!url) {
    try {
      await removeSource(ctx.company.id, "precy_online");
    } catch (e) {
      return { ok: false, error: friendly(e) };
    }
    revalidatePath("/produtos");
    return { ok: true };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: "URL inválida." };
  }
  const slug = parseStoreSlug(url);

  try {
    await upsertSource({
      companyId: ctx.company.id,
      kind: "precy_online",
      createdBy: ctx.userId,
      patch: {
        external_url: url,
        status: "connected",
        config: { host: parsed.host, slug } as never,
      },
    });
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
  revalidatePath("/produtos");
  return { ok: true };
}

export async function deleteCatalogSource(kind: "pdf" | "precy_online") {
  const ctx = await getAppContext();
  if (!canWrite(ctx.role)) throw new Error("sem permissão");
  await removeSource(ctx.company.id, kind);
  revalidatePath("/produtos");
}

function friendly(e: unknown): string {
  const m = (e as Error)?.message ?? "erro";
  if (/relation .* does not exist|Could not find the table/i.test(m)) {
    return "Base Comercial ainda não ativada (aplique a migration 20260908210000).";
  }
  return m;
}

function list(v: FormDataEntryValue | null): string[] {
  return String(v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function createProduct(formData: FormData) {
  const ctx = await getAppContext();
  if (!canWrite(ctx.role)) throw new Error("sem permissão");
  const supabase = await createClient();

  await supabase.from("products").insert({
    company_id: ctx.company.id,
    name: String(formData.get("name") || "").trim(),
    kind: String(formData.get("kind") || "product"),
    description: String(formData.get("description") || "") || null,
    price_start: Number(formData.get("price_start")) || null,
    price_avg: Number(formData.get("price_avg")) || null,
    min_quantity: Number(formData.get("min_quantity")) || null,
    lead_time_days: Number(formData.get("lead_time_days")) || null,
    keywords: list(formData.get("keywords")),
    applications: list(formData.get("applications")),
    cities_served: list(formData.get("cities_served")),
    example_buyers: list(formData.get("example_buyers")),
    ideal_audience: String(formData.get("ideal_audience") || "") || null,
  });
  revalidatePath("/produtos");
}

export async function toggleProduct(id: string, isActive: boolean) {
  const ctx = await getAppContext();
  if (!canWrite(ctx.role)) throw new Error("sem permissão");
  const supabase = await createClient();
  await supabase
    .from("products")
    .update({ is_active: isActive })
    .eq("id", id)
    .eq("company_id", ctx.company.id);
  revalidatePath("/produtos");
}
