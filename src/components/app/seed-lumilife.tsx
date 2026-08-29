"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function SeedLumiLifeButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="text-right">
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const supabase = createClient();
            const { error } = await supabase.rpc("seed_lumilife");
            if (error) setMsg(error.message);
            else {
              setMsg("Empresa LumiLife criada.");
              router.refresh();
            }
          })
        }
      >
        {pending ? "Criando…" : "Criar LumiLife demo"}
      </Button>
      {msg && <p className="mt-1 text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}
