"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ArticleFeedback({ articleSlug }: { articleSlug: string }) {
  const [answer, setAnswer] = useState<"yes" | "no" | null>(null);

  function vote(value: "yes" | "no") {
    setAnswer(value);
    try {
      window.localStorage.setItem(`lh_help_feedback_${articleSlug}`, value);
    } catch {
      // localStorage indisponível — a interação segue funcionando visualmente.
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      {answer ? (
        <p className="text-sm text-muted-foreground">
          {answer === "yes"
            ? "Que bom que ajudou! Obrigado pelo retorno."
            : "Obrigado pelo retorno — vamos usar isso para melhorar este artigo."}
        </p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium">Este artigo foi útil?</p>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => vote("yes")}>
              <ThumbsUp className="size-3.5" />
              Sim
            </Button>
            <Button size="sm" variant="secondary" onClick={() => vote("no")}>
              <ThumbsDown className="size-3.5" />
              Não
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
