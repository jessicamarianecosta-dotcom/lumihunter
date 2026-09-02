"use client";

import * as Popover from "@radix-ui/react-popover";
import Link from "next/link";
import { HelpCircle, ArrowRight } from "lucide-react";
import { getArticle, getCategory } from "@/lib/help/data";

export function HelpTip({
  title,
  text,
  articleSlug,
}: {
  title: string;
  text: string;
  articleSlug: string;
}) {
  const article = getArticle(articleSlug);
  const category = article ? getCategory(article.category) : undefined;
  const href = article && category ? `/ajuda/${category.slug}/${article.slug}` : "/ajuda";

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label={`Ajuda: ${title}`}
        >
          <HelpCircle className="size-3.5" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          align="start"
          className="z-50 w-72 rounded-xl border bg-popover p-4 text-popover-foreground shadow-2xl"
        >
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            {text}
          </p>
          <Link
            href={href}
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
          >
            Saiba mais
            <ArrowRight className="size-3" />
          </Link>
          <Popover.Arrow className="fill-popover" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
