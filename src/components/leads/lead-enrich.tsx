"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function LeadEnrich({
  leadId,
  cnpj,
}: {
  leadId: string;
  cnpj: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(cnpj ?? "");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cnpj: value }),
      });
      const data = await res.json();
      if (res.ok) {
        const n = data.fieldsUpdated?.length ?? 0;
        setNote(
          n > 0
            ? `Atualizado da Receita: ${data.fieldsUpdated.join(", ")}.`
            : "CNPJ consultado — nada novo a preencher.",
        );
        router.refresh();
      } else {
        setNote(data.error ?? "Falha na consulta.");
      }
    } catch {
      setNote("Falha na consulta.");
    }
    setBusy(false);
  }

  return (
    <Card>
      <CardContent className="p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Building2 className="size-4 text-accent" /> Enriquecer por CNPJ
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Busca razão social, atividade, endereço e telefone na base pública da
          Receita. Só preenche o que estiver vazio.
        </p>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
        >
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="00.000.000/0000-00"
            className="h-8 text-xs"
            disabled={busy}
          />
          <Button size="sm" type="submit" disabled={busy}>
            {busy ? "Consultando…" : "Buscar"}
          </Button>
        </form>
        {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
      </CardContent>
    </Card>
  );
}
