"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Snapshot {
  campaignName: string;
  found: number;
  withWhatsapp: number;
  fresh: number;
  approachedToday: number;
  replies: number;
  running: boolean;
  searching: boolean;
  target: number;
}

/** Progresso da campanha — atualiza sozinho, sem precisar recarregar a página. */
export function ProspeccaoProgress({ initial }: { initial: Snapshot }) {
  const [snapshot, setSnapshot] = useState<Snapshot>(initial);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/prospeccao/snapshot");
        if (res.ok) setSnapshot(await res.json());
      } catch {
        /* mantém o último valor conhecido */
      }
    };
    const id = setInterval(load, 8_000);
    return () => clearInterval(id);
  }, []);

  const progress = [
    {
      label: "Leads válidos",
      value:
        snapshot.target > 0 ? `${snapshot.found} / ${snapshot.target}` : String(snapshot.found),
    },
    { label: "Com WhatsApp", value: snapshot.withWhatsapp },
    { label: "Novos contatos", value: snapshot.fresh },
    { label: "Abordados hoje", value: snapshot.approachedToday },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="mb-1 text-sm font-medium text-muted-foreground">
          Campanha: <span className="text-foreground">{snapshot.campaignName}</span>
        </h2>
        <h3 className="mb-2 flex flex-wrap items-center gap-x-2 text-sm font-medium text-muted-foreground">
          Progresso
          {snapshot.searching && snapshot.found < snapshot.target && (
            <span className="text-amber-600">
              · encontrando mais {snapshot.target - snapshot.found} lead(s) — expandindo a
              busca automaticamente
            </span>
          )}
          {snapshot.running && <span className="text-emerald-600">· abordagem em andamento</span>}
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {progress.map((p) => (
            <Card key={p.label}>
              <CardContent className="p-4">
                <p className="text-2xl font-semibold tabular-nums">{p.value}</p>
                <p className="text-xs text-muted-foreground">{p.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="flex items-center justify-between p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg bg-secondary">
              <MessageCircle className="size-4 text-accent" />
            </span>
            <div>
              <p className="font-medium">Conversas</p>
              <p className="text-xs text-muted-foreground">
                {snapshot.replies > 0
                  ? `${snapshot.replies} cliente(s) responderam e aguardam atendimento`
                  : "Nenhuma resposta aguardando no momento"}
              </p>
            </div>
          </div>
          <Button asChild variant={snapshot.replies > 0 ? "default" : "outline"}>
            <Link href="/conversas">Ver conversas</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
