"use client";

import { useRef, useTransition } from "react";
import { addLeadNote } from "@/app/(app)/leads/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

export function NoteForm({ leadId }: { leadId: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [pending, start] = useTransition();

  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm font-medium">Nova nota interna</p>
        <Textarea ref={ref} rows={3} className="mt-2" placeholder="Anote algo sobre este lead…" />
        <Button
          className="mt-2"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const body = ref.current?.value ?? "";
              await addLeadNote(leadId, body);
              if (ref.current) ref.current.value = "";
            })
          }
        >
          {pending ? "Salvando…" : "Salvar nota"}
        </Button>
      </CardContent>
    </Card>
  );
}
