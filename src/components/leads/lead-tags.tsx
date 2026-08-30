"use client";

import { useRef, useTransition } from "react";
import { X } from "lucide-react";
import { addLeadTag, removeLeadTag } from "@/app/(app)/leads/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export function LeadTags({
  leadId,
  tags,
}: {
  leadId: string;
  tags: { id: string; tag: string }[];
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();

  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm font-medium">Tags</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.map((t) => (
            <Badge key={t.id} variant="secondary" className="gap-1 pr-1">
              {t.tag}
              <button
                onClick={() =>
                  start(() => {
                    void removeLeadTag(t.id, leadId);
                  })
                }
                className="rounded-full p-0.5 hover:bg-foreground/10"
                aria-label="Remover tag"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          {tags.length === 0 && (
            <span className="text-xs text-muted-foreground">Nenhuma tag.</span>
          )}
        </div>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = ref.current?.value ?? "";
            start(async () => {
              await addLeadTag(leadId, v);
              if (ref.current) ref.current.value = "";
            });
          }}
        >
          <Input
            ref={ref}
            placeholder="nova tag"
            className="h-8 text-xs"
            disabled={pending}
          />
        </form>
      </CardContent>
    </Card>
  );
}
