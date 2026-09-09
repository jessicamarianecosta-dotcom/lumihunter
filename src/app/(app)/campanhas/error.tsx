"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CampanhasError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[campanhas] erro renderizado", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md space-y-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Não foi possível carregar</h1>
      <p className="text-sm text-muted-foreground">
        Houve uma falha temporária ao carregar esta tela de campanhas. Tente de
        novo — seus dados estão salvos.
      </p>
      <div className="flex items-center justify-center gap-2">
        <Button size="sm" onClick={() => reset()}>
          <RefreshCw className="size-4" /> Tentar de novo
        </Button>
        <Link
          href="/campanhas"
          className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
        >
          <ArrowLeft className="size-4" /> Campanhas
        </Link>
      </div>
    </div>
  );
}
