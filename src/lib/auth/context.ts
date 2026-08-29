import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Company, CompanyMember, MemberRole } from "@/lib/supabase/database.types";

export const ACTIVE_COMPANY_COOKIE = "lh_active_company";

export interface AppContext {
  userId: string;
  email: string;
  memberships: (CompanyMember & { companies: Company })[];
  company: Company;
  role: MemberRole;
}

/**
 * Contexto da sessão: usuário logado + empresa ativa (via cookie).
 * Redireciona para /login se não autenticado e para /onboarding se sem empresa.
 */
export const getAppContext = cache(async (): Promise<AppContext> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("company_members")
    .select("*, companies(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const list = (memberships ?? []) as (CompanyMember & { companies: Company })[];
  if (list.length === 0) redirect("/onboarding");

  const cookieStore = await cookies();
  const activeId = cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value;
  const active = list.find((m) => m.company_id === activeId) ?? list[0];

  return {
    userId: user.id,
    email: user.email ?? "",
    memberships: list,
    company: active.companies,
    role: active.role,
  };
});

/** Versão que não redireciona — para uso em rotas de API. */
export async function tryGetContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: memberships } = await supabase
    .from("company_members")
    .select("*, companies(*)")
    .eq("user_id", user.id);

  const list = (memberships ?? []) as (CompanyMember & { companies: Company })[];
  if (list.length === 0) return null;

  const cookieStore = await cookies();
  const activeId = cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value;
  const active = list.find((m) => m.company_id === activeId) ?? list[0];

  return {
    userId: user.id,
    email: user.email ?? "",
    company: active.companies,
    role: active.role,
    supabase,
  };
}

export function canWrite(role: MemberRole) {
  return role !== "viewer";
}
export function isAdmin(role: MemberRole) {
  return role === "owner" || role === "admin";
}
