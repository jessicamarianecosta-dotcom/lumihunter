import type { ReactNode } from "react";

/** Tipografia simples para páginas legais, sem depender do plugin de prose. */
export function LegalDoc({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: ReactNode;
}) {
  return (
    <article className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">
          Última atualização: {updatedAt}
        </p>
      </header>
      <div
        className="space-y-5 text-sm leading-relaxed text-muted-foreground
          [&_a]:text-accent [&_a]:underline
          [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground
          [&_h3]:mt-6 [&_h3]:font-medium [&_h3]:text-foreground
          [&_li]:ml-1 [&_strong]:text-foreground
          [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5"
      >
        {children}
      </div>
    </article>
  );
}
