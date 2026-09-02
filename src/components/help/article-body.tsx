import { Lightbulb, AlertTriangle } from "lucide-react";
import type { HelpBlock } from "@/lib/help/types";

export function ArticleBody({ blocks }: { blocks: HelpBlock[] }) {
  return (
    <div className="space-y-4">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "p":
            return (
              <p key={i} className="text-sm leading-relaxed text-foreground/90">
                {block.text}
              </p>
            );
          case "h2":
            return (
              <h2 key={i} className="pt-2 text-base font-semibold">
                {block.text}
              </h2>
            );
          case "list":
            return (
              <ul key={i} className="list-disc space-y-1.5 pl-5 text-sm text-foreground/90">
                {block.items.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            );
          case "steps":
            return (
              <ol key={i} className="space-y-3">
                {block.items.map((step, j) => (
                  <li key={j} className="flex gap-3">
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-medium">
                      {j + 1}
                    </span>
                    <div className="text-sm">
                      <p className="font-medium">{step.title}</p>
                      <p className="mt-0.5 text-muted-foreground">{step.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            );
          case "tip":
            return (
              <div
                key={i}
                className="flex gap-2 rounded-lg border border-accent/30 bg-accent/5 p-3 text-sm"
              >
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-accent" />
                <p className="text-foreground/90">
                  <strong className="font-medium">Dica.</strong> {block.text}
                </p>
              </div>
            );
          case "warning":
            return (
              <div
                key={i}
                className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>{block.text}</p>
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
