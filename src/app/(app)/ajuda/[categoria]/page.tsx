import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { HelpBreadcrumbs } from "@/components/help/breadcrumbs";
import { HELP_CATEGORIES, getCategory, getArticlesByCategory } from "@/lib/help/data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ categoria: string }>;
}): Promise<Metadata> {
  const { categoria } = await params;
  const category = getCategory(categoria);
  return { title: category ? category.label : "Central de Ajuda" };
}

export function generateStaticParams() {
  return HELP_CATEGORIES.map((c) => ({ categoria: c.slug }));
}

export default async function HelpCategoryPage({
  params,
}: {
  params: Promise<{ categoria: string }>;
}) {
  const { categoria } = await params;
  const category = getCategory(categoria);
  if (!category) notFound();

  const articles = getArticlesByCategory(category.slug);

  return (
    <div className="space-y-5">
      <HelpBreadcrumbs
        items={[{ label: "Central de Ajuda", href: "/ajuda" }, { label: category.label }]}
      />

      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary">
          <category.icon className="size-5 text-accent" />
        </span>
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">{category.label}</h1>
          <p className="text-sm text-muted-foreground">{category.description}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {articles.map((article) => (
          <Link key={article.slug} href={`/ajuda/${category.slug}/${article.slug}`} className="block h-full">
            <Card className="h-full transition-colors hover:border-accent">
              <CardContent className="p-4">
                <p className="text-sm font-medium">{article.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{article.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
        {articles.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Ainda não há artigos nesta categoria.
          </p>
        )}
      </div>
    </div>
  );
}
