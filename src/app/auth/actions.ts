"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string };

/** Só aceita caminhos internos ("/algo"), nunca URLs absolutas. */
function safeNext(value: FormDataEntryValue | null, fallback: string): string {
  const s = String(value ?? "");
  return s.startsWith("/") && !s.startsWith("//") ? s : fallback;
}

async function origin() {
  const h = await headers();
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    `https://${h.get("host") ?? "localhost:3000"}`
  );
}

export async function signInWithPassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const supabase = await createClient();
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "E-mail ou senha inválidos." };
  redirect(safeNext(formData.get("next"), "/app"));
}

export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const supabase = await createClient();
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const fullName = String(formData.get("full_name") || "");
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${await origin()}/auth/callback`,
    },
  });
  if (error) return { error: error.message };
  redirect(safeNext(formData.get("next"), "/onboarding"));
}

export async function signInWithMagicLink(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const supabase = await createClient();
  const email = String(formData.get("email"));
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${await origin()}/auth/callback` },
  });
  if (error) return { error: error.message };
  return { message: "Enviamos um link de acesso para o seu e-mail." };
}

export async function signInWithGoogle(formData?: FormData) {
  const supabase = await createClient();
  const next = safeNext(formData?.get("next") ?? null, "/app");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return;
  if (data.url) redirect(data.url);
}

export async function resetPassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const supabase = await createClient();
  const email = String(formData.get("email"));
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await origin()}/auth/callback?next=/config`,
  });
  if (error) return { error: error.message };
  return { message: "Se o e-mail existir, enviamos instruções de recuperação." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
