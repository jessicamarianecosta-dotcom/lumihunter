"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAppContext, ACTIVE_COMPANY_COOKIE } from "@/lib/auth/context";

export async function switchCompany(companyId: string) {
  const ctx = await getAppContext();
  const allowed = ctx.memberships.some((m) => m.company_id === companyId);
  if (!allowed) throw new Error("empresa inválida");

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_COMPANY_COOKIE, companyId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/app");
}
