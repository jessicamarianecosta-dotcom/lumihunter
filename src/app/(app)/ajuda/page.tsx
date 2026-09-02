import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { HelpSearch } from "@/components/help/help-search";
import {
  HELP_CATEGORIES,
  GETTING_STARTED_STEPS,
  getArticle,
  getArticlesByCategory,
} from "@/lib/help/data";
import { HELP_FAQ } from "@/lib/help/faq";

export const metadata: Metadata = { title: "Central de Ajuda" };

export default function HelpIndexPage() {
  return (
    <div className="space-y-10">
      <div className="mx-auto max-w-2xl space-y-5 text-center">
        <h1 className="text-2xl font-semibold sm:text-3xl">
          Como podemos ajudar?
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Encontre respostas, aprenda a usar o LumiHunter e aproveite melhor
          todos os recursos da plataforma.
        </p>
        <HelpSearch autoFocus />
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Comece aqui</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {GETTING_STARTED_STEPS.map((step, i) => {
            const article = getArticle(step.articleSlug);
            const href = article ? `/ajuda/${article.category}/${article.slug}` : "/ajuda";
            return (
              <Link key={step.title} href={href} className="block h-full">
                <Card className="h-full transition-colors hover:border-accent">
                  <CardContent className="flex h-full flex-col gap-2 p-4">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold">
                      {i + 1}
                    </span>
                    <p className="text-sm font-medium">{step.title}</p>
                    <p className="text-xs text-muted-foreground">{step.text}</p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Categorias</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {HELP_CATEGORIES.map((category) => {
            const count = getArticlesByCategory(category.slug).length;
            return (
              <Link key={category.slug} href={`/ajuda/${category.slug}`} className="block h-full">
                <Card className="h-full transition-colors hover:border-accent">
                  <CardContent className="flex h-full items-start gap-3 p-4">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary">
                      <category.icon className="size-4 text-accent" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{category.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {category.description}
                      </p>
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        {count} {count === 1 ? "artigo" : "artigos"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Perguntas frequentes</h2>
        <div className="space-y-2">
          {HELP_FAQ.map((item) => {
            const article = item.articleSlug ? getArticle(item.articleSlug) : undefined;
            return (
              <Card key={item.question}>
                <CardContent className="p-4">
                  <p className="text-sm font-medium">{item.question}</p>
                  <p className="mt-1.5 text-sm text-muted-foreground">{item.answer}</p>
                  {article && (
                    <Link
                      href={`/ajuda/${article.category}/${article.slug}`}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                    >
                      Saiba mais
                      <ArrowRight className="size-3" />
                    </Link>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
