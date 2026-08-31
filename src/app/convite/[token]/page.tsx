import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_COMPANY_COOKIE } from "@/lib/auth/context";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Convite" };

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // sem sessão: manda pro cadastro, voltando pra cá depois
  if (!user) {
    redirect(`/signup?next=${encodeURIComponent(`/convite/${token}`)}`);
  }

  const { data: companyId, error } = await supabase.rpc("accept_invitation", {
    p_token: token,
  });

  if (error || !companyId) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold">Convite inválido</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error?.message ??
            "Este convite não existe, expirou ou já foi utilizado."}
        </p>
        <Button asChild className="mt-6">
          <Link href="/app">Ir para o painel</Link>
        </Button>
      </Shell>
    );
  }

  const jar = await cookies();
  jar.set(ACTIVE_COMPANY_COOKIE, companyId as string, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  redirect("/app");
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center">
        {children}
      </div>
    </div>
  );
}
