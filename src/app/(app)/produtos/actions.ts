"use server";

import { revalidatePath } from "next/cache";
import { getAppContext, canWrite } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

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
