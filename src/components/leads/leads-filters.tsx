"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  EMPTY_FILTERS,
  SORT_OPTIONS,
  countActiveFilters,
  filtersToSearchParams,
  type LeadsFilters as LeadsFiltersState,
} from "@/lib/leads/filters";
import type { PipelineStage } from "@/lib/supabase/database.types";

interface Options {
  segments: string[];
  cities: string[];
  states: string[];
  sources: string[];
}

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

export function LeadsFilters({
  filters,
  stages,
  options,
}: {
  filters: LeadsFiltersState;
  stages: PipelineStage[];
  options: Options;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [q, setQ] = useState(filters.q);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => setQ(filters.q), [filters.q]);
  useEffect(() => setDraft(filters), [filters, open]);

  function apply(next: LeadsFiltersState, view?: string) {
    const params = filtersToSearchParams(next);
    const currentView = view ?? searchParams.get("view");
    if (currentView) params.set("view", currentView);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  function onSearchChange(value: string) {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      apply({ ...filters, q: value });
    }, 300);
  }

  function onSortChange(sort: LeadsFiltersState["sort"]) {
    apply({ ...filters, sort });
  }

  function applyDraft() {
    apply({ ...draft, q: filters.q });
    setOpen(false);
  }

  function clearAll() {
    const cleared = { ...EMPTY_FILTERS, q: filters.q };
    setDraft(cleared);
    apply(cleared);
    setOpen(false);
  }

  const activeCount = countActiveFilters(filters);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Pesquisar leads..."
          className="pl-9"
        />
      </div>

      <div className="flex items-center gap-2">
        <select
          value={filters.sort}
          onChange={(e) => onSortChange(e.target.value as LeadsFiltersState["sort"])}
          className={cn(selectClass, "w-auto")}
          aria-label="Ordenar por"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <SlidersHorizontal className="size-3.5" />
              Filtros
              {activeCount > 0 && (
                <span className="grid size-4 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                  {activeCount}
                </span>
              )}
            </Button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
            <Dialog.Content
              className={cn(
                "fixed z-50 flex max-h-[85vh] flex-col overflow-hidden bg-card shadow-2xl outline-none duration-200",
                "inset-x-0 bottom-0 rounded-t-2xl data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
                "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[26rem] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95",
              )}
            >
              <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
                <Dialog.Title className="text-sm font-semibold">Filtros</Dialog.Title>
                <Dialog.Close asChild>
                  <Button variant="ghost" size="icon" aria-label="Fechar filtros">
                    <X className="size-4" />
                  </Button>
                </Dialog.Close>
              </div>
              <Dialog.Description className="sr-only">
                Filtre os leads por status, segmento, localização, score e contato.
              </Dialog.Description>

              <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <select
                    value={draft.stageId}
                    onChange={(e) => setDraft((d) => ({ ...d, stageId: e.target.value }))}
                    className={selectClass}
                  >
                    <option value="">Todos</option>
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Segmento</Label>
                    <select
                      value={draft.segment}
                      onChange={(e) => setDraft((d) => ({ ...d, segment: e.target.value }))}
                      className={selectClass}
                    >
                      <option value="">Todos</option>
                      {options.segments.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cidade</Label>
                    <select
                      value={draft.city}
                      onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))}
                      className={selectClass}
                    >
                      <option value="">Todas</option>
                      {options.cities.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Estado</Label>
                    <select
                      value={draft.state}
                      onChange={(e) => setDraft((d) => ({ ...d, state: e.target.value }))}
                      className={selectClass}
                    >
                      <option value="">Todos</option>
                      {options.states.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Origem</Label>
                    <select
                      value={draft.source}
                      onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))}
                      className={selectClass}
                    >
                      <option value="">Todas</option>
                      {options.sources.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>
                    Score: {draft.scoreMin} — {draft.scoreMax}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={draft.scoreMin}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, scoreMin: Number(e.target.value) || 0 }))
                      }
                    />
                    <span className="text-muted-foreground">—</span>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={draft.scoreMax}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, scoreMax: Number(e.target.value) || 100 }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Descoberto entre</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={draft.discoveredFrom}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, discoveredFrom: e.target.value }))
                      }
                    />
                    <span className="text-muted-foreground">—</span>
                    <Input
                      type="date"
                      value={draft.discoveredTo}
                      onChange={(e) => setDraft((d) => ({ ...d, discoveredTo: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Contato</Label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={draft.hasWhatsapp}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, hasWhatsapp: e.target.checked }))
                      }
                    />
                    Possui WhatsApp
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={draft.hasEmail}
                      onChange={(e) => setDraft((d) => ({ ...d, hasEmail: e.target.checked }))}
                    />
                    Possui e-mail
                  </label>
                </div>
              </div>

              <div className="flex shrink-0 items-center justify-between gap-2 border-t p-4">
                <Button variant="ghost" onClick={clearAll}>
                  Limpar filtros
                </Button>
                <Button onClick={applyDraft}>Aplicar filtros</Button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </div>
  );
}
