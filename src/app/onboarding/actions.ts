"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_COMPANY_COOKIE } from "@/lib/auth/context";

export type OnboardingState = { error?: string };

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Informe o nome da empresa." };

  const { data: companyId, error } = await supabase.rpc("create_company", {
    p_name: name,
    p_segment: String(formData.get("segment") || "") || null,
    p_city: String(formData.get("city") || "") || null,
    p_state: String(formData.get("state") || "") || null,
  });
  if (error || !companyId) {
    return { error: error?.message || "Não foi possível criar a empresa." };
  }

  await supabase
    .from("companies")
    .update({
      cnpj: String(formData.get("cnpj") || "") || null,
      website: String(formData.get("website") || "") || null,
      instagram: String(formData.get("instagram") || "") || null,
      commercial_whatsapp: String(formData.get("whatsapp") || "") || null,
      commercial_email: String(formData.get("email") || "") || null,
      description: String(formData.get("description") || "") || null,
      brand_color: String(formData.get("brand_color") || "#F5C518"),
      onboarding_completed: true,
    })
    .eq("id", companyId);

  // primeiro produto (opcional)
  const productName = String(formData.get("product_name") || "").trim();
  if (productName) {
    await supabase.from("products").insert({
      company_id: companyId,
      name: productName,
      description: String(formData.get("product_description") || "") || null,
      price_avg: Number(formData.get("product_price")) || null,
      keywords: String(formData.get("product_keywords") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_COMPANY_COOKIE, companyId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect("/app");
}
