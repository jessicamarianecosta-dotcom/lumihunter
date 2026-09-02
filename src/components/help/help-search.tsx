"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { searchHelp } from "@/lib/help/data";
import { cn } from "@/lib/utils";

export function HelpSearch({
  autoFocus = false,
  compact = false,
}: {
  autoFocus?: boolean;
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchHelp(query).slice(0, 8), [query]);
  const showResults = query.trim().length > 0;

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <input
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pesquise uma dúvida, recurso ou módulo…"
          className={cn(
            "w-full rounded-xl border bg-background pl-11 pr-11 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            compact ? "h-10" : "h-12 sm:h-14 sm:text-base",
          )}
          aria-label="Pesquisar na Central de Ajuda"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-secondary"
            aria-label="Limpar busca"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {showResults && (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border bg-popover shadow-2xl">
          {results.length === 0 ? (
            <div className="p-6 text-center text-sm">
              <p className="font-medium">Nenhum resultado encontrado</p>
              <p className="mt-1 text-muted-foreground">
                Não encontramos um artigo para essa busca. Tente pesquisar por
                outro termo ou consulte uma das categorias abaixo.
              </p>
            </div>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto p-1.5">
              {results.map(({ article, category, snippet }) => (
                <li key={article.slug}>
                  <Link
                    href={`/ajuda/${category.slug}/${article.slug}`}
                    onClick={() => setQuery("")}
                    className="block rounded-lg px-3 py-2.5 hover:bg-secondary"
                  >
                    <p className="text-sm font-medium">{article.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {category.emoji} {category.label}
                    </p>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      {snippet}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
