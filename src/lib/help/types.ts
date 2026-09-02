import type { LucideIcon } from "lucide-react";

export type HelpBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "list"; items: string[] }
  | { type: "steps"; items: { title: string; text: string }[] }
  | { type: "tip"; text: string }
  | { type: "warning"; text: string };

export interface HelpCategory {
  slug: string;
  label: string;
  emoji: string;
  icon: LucideIcon;
  description: string;
}

export interface HelpArticle {
  slug: string;
  category: string;
  title: string;
  description: string;
  keywords: string[];
  content: HelpBlock[];
  related?: string[];
}

export interface GettingStartedStep {
  title: string;
  text: string;
  articleSlug: string;
}
