"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import {
  MoreVertical,
  Sparkles,
  MapPin,
  Send,
  Mail,
  Archive,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StageSelect } from "./stage-select";
import { archiveLeadsBulk, moveLeadsToStageBulk } from "@/app/(app)/leads/actions";
import type { LeadRow } from "@/app/(app)/leads/page";
import type { PipelineStage } from "@/lib/supabase/database.types";

function scoreVariant(score: number | null) {
  if (score == null) return "secondary" as const;
  if (score >= 70) return "success" as const;
  if (score >= 40) return "warning" as const;
  return "secondary" as const;
}

export function LeadsList({
  leads,
  stages,
}: {
  leads: LeadRow[];
  stages: PipelineStage[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, startTransition] = useTransition();
  const stageNameById = new Map(stages.map((s) => [s.id, s.name]));
  const interestedStage = stages.find((s) => s.slug === "interested");

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === leads.length ? new Set() : new Set(leads.map((l) => l.id)),
    );
  }

  function qualifyOne(id: string) {
    startTransition(async () => {
      await fetch("/api/agents/qualifier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: id }),
      }).catch(() => null);
      router.refresh();
    });
  }

  function qualifyBulk() {
    const ids = Array.from(selected);
    startTransition(async () => {
      await Promise.all(
        ids.map((id) =>
          fetch("/api/agents/qualifier", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ leadId: id }),
          }).catch(() => null),
        ),
      );
      setSelected(new Set());
      router.refresh();
    });
  }

  function archiveBulk() {
    const ids = Array.from(selected);
    startTransition(async () => {
      await archiveLeadsBulk(ids);
      setSelected(new Set());
      router.refresh();
    });
  }

  function moveBulk(stageId: string) {
    if (!stageId) return;
    const ids = Array.from(selected);
    startTransition(async () => {
      await moveLeadsToStageBulk(ids, stageId);
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-secondary/50 p-3">
          <p className="text-sm font-medium">
            {selected.size} {selected.size === 1 ? "lead selecionado" : "leads selecionados"}
          </p>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            <select
              defaultValue=""
              disabled={busy}
              onChange={(e) => moveBulk(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="" disabled>
                Alterar status…
              </option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <Button size="sm" variant="secondary" onClick={qualifyBulk} disabled={busy}>
              <Sparkles className="size-3.5" />
              Qualificar
            </Button>
            {interestedStage && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => moveBulk(interestedStage.id)}
                disabled={busy}
              >
                Marcar como interessado
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={archiveBulk} disabled={busy}>
              <Archive className="size-3.5" />
              Arquivar
            </Button>
          </div>
        </div>
      )}

      {/* Desktop: tabela */}
      <Card className="hidden overflow-hidden md:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="w-10 p-3">
                    <input
                      type="checkbox"
                      checked={leads.length > 0 && selected.size === leads.length}
                      onChange={toggleAll}
                      aria-label="Selecionar todos os leads"
                    />
                  </th>
                  <th className="p-3">Empresa</th>
                  <th className="p-3">Segmento</th>
                  <th className="p-3">Localização</th>
                  <th className="p-3">Score</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Contato</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className="border-b last:border-0 hover:bg-secondary/40">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selected.has(l.id)}
                        onChange={() => toggle(l.id)}
                        aria-label={`Selecionar ${l.name}`}
                      />
                    </td>
                    <td className="p-3">
                      <Link href={`/leads/${l.id}`} className="font-medium hover:underline">
                        {l.name}
                      </Link>
                    </td>
                    <td className="p-3 text-muted-foreground">{l.segment ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">
                      {l.city ?? "—"}
                      {l.state ? `/${l.state}` : ""}
                    </td>
                    <td className="p-3">
                      {l.score != null ? (
                        <Badge variant={scoreVariant(l.score)}>
                          <Sparkles className="mr-1 size-3" />
                          {l.score}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      <StageSelect leadId={l.id} currentStageId={l.stage_id} stages={stages} />
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {l.whatsapp && (
                          <a
                            href={`https://wa.me/${l.whatsapp.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-muted-foreground hover:text-accent"
                            aria-label="Abrir WhatsApp"
                          >
                            <Send className="size-4" />
                          </a>
                        )}
                        {l.email && (
                          <a
                            href={`mailto:${l.email}`}
                            className="text-muted-foreground hover:text-accent"
                            aria-label="Enviar e-mail"
                          >
                            <Mail className="size-4" />
                          </a>
                        )}
                        {!l.whatsapp && !l.email && (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      <LeadRowMenu lead={l} onQualify={() => qualifyOne(l.id)} />
                    </td>
                  </tr>
                ))}
                {leads.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      Nenhum lead encontrado com os filtros atuais.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Mobile: cards */}
      <div className="space-y-2 md:hidden">
        {leads.map((l) => (
          <Card key={l.id}>
            <CardContent className="flex items-start gap-3 p-3">
              <input
                type="checkbox"
                checked={selected.has(l.id)}
                onChange={() => toggle(l.id)}
                aria-label={`Selecionar ${l.name}`}
                className="mt-1"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/leads/${l.id}`} className="truncate text-sm font-medium hover:underline">
                    {l.name}
                  </Link>
                  {l.score != null && (
                    <Badge variant={scoreVariant(l.score)} className="shrink-0">
                      <Sparkles className="mr-1 size-3" />
                      {l.score}
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {l.segment ?? "—"}
                  {(l.city || l.state) && (
                    <>
                      {" · "}
                      <MapPin className="inline size-3" /> {l.city}
                      {l.state ? `/${l.state}` : ""}
                    </>
                  )}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Status: {stageNameById.get(l.stage_id ?? "") ?? "—"}
                </p>
              </div>
              <LeadRowMenu lead={l} onQualify={() => qualifyOne(l.id)} />
            </CardContent>
          </Card>
        ))}
        {leads.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Nenhum lead encontrado com os filtros atuais.
          </p>
        )}
      </div>
    </div>
  );
}

function LeadRowMenu({ lead, onQualify }: { lead: LeadRow; onQualify: () => void }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Mais ações para ${lead.name}`}>
          <MoreVertical className="size-4" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align="end"
          className="z-50 w-48 space-y-0.5 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-2xl"
        >
          <Link
            href={`/leads/${lead.id}`}
            className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-secondary"
          >
            <ExternalLink className="size-4" />
            Ver detalhes
          </Link>
          <button
            type="button"
            onClick={onQualify}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-secondary"
          >
            <Sparkles className="size-4" />
            Qualificar
          </button>
          {lead.whatsapp && (
            <a
              href={`https://wa.me/${lead.whatsapp.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-secondary"
            >
              <Send className="size-4" />
              WhatsApp
            </a>
          )}
          {lead.email && (
            <a
              href={`mailto:${lead.email}`}
              className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-secondary"
            >
              <Mail className="size-4" />
              E-mail
            </a>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
