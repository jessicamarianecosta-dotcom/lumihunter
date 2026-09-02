import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, LifeBuoy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { HelpBreadcrumbs } from "@/components/help/breadcrumbs";
import { ArticleBody } from "@/components/help/article-body";
import { ArticleFeedback } from "@/components/help/article-feedback";
import {
  HELP_ARTICLES,
  getArticle,
  getCategory,
  getRelatedArticles,
} from "@/lib/help/data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ categoria: string; artigo: string }>;
}): Promise<Metadata> {
  const { artigo } = await params;
  const article = getArticle(artigo);
  return { title: article ? article.title : "Central de Ajuda" };
}

export function generateStaticParams() {
  return HELP_ARTICLES.map((a) => ({ categoria: a.category, artigo: a.slug }));
}

export default async function HelpArticlePage({
  params,
}: {
  params: Promise<{ categoria: string; artigo: string }>;
}) {
  const { categoria, artigo } = await params;
  const article = getArticle(artigo);
  const category = article ? getCategory(article.category) : undefined;
  if (!article || !category || category.slug !== categoria) notFound();

  const related = getRelatedArticles(article);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <HelpBreadcrumbs
        items={[
          { label: "Central de Ajuda", href: "/ajuda" },
          { label: category.label, href: `/ajuda/${category.slug}` },
          { label: article.title },
        ]}
      />

      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">{article.title}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{article.description}</p>
      </div>

      <ArticleBody blocks={article.content} />

      <ArticleFeedback articleSlug={article.slug} />

      {related.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold">Artigos relacionados</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {related.map((r) => (
              <Link key={r.slug} href={`/ajuda/${r.category}/${r.slug}`} className="block">
                <Card className="transition-colors hover:border-accent">
                  <CardContent className="flex items-center justify-between gap-2 p-3">
                    <span className="text-sm font-medium">{r.title}</span>
                    <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      <Card className="border-dashed">
        <CardContent className="flex items-start gap-3 p-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary">
            <LifeBuoy className="size-4 text-accent" />
          </span>
          <div>
            <p className="text-sm font-medium">Ainda precisa de ajuda?</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Não encontrou o que procurava? Peça ajuda a um administrador da
              sua conta ou consulte a categoria{" "}
              <Link href="/ajuda/problemas" className="text-accent hover:underline">
                Problemas e soluções
              </Link>
              .
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
