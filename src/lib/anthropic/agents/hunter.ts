import { anthropic, MODELS, textOf, parseJsonFromText } from "../client";
import { HUNTER_SYSTEM } from "../prompts";
import { logAiRun } from "../log";
import { webSearch } from "@/lib/search";
import type { IcpProfile, Product } from "@/lib/supabase/database.types";

export interface HunterLead {
  name: string;
  legal_name: string | null;
  segment: string | null;
  description: string | null;
  city: string | null;
  state: string | null;
  website: string | null;
  instagram: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  products_sold: string[];
  source_urls: string[];
}

interface RunArgs {
  companyId: string;
  icp: IcpProfile;
  products: Product[];
  limit?: number;
  extraQuery?: string;
  userId?: string | null;
}

/** Monta as queries de busca a partir do ICP. */
function buildQueries(icp: IcpProfile, extra?: string): string[] {
  const cities = icp.cities.length ? icp.cities : ["Brasil"];
  const segments = icp.segments.length ? icp.segments : ["empresas"];
  const queries: string[] = [];
  for (const seg of segments.slice(0, 6)) {
    for (const city of cities.slice(0, 3)) {
      queries.push(`${seg} em ${city} contato instagram`);
    }
  }
  if (extra) queries.unshift(extra);
  return queries.slice(0, 12);
}

export async function runHunter(args: RunArgs): Promise<HunterLead[]> {
  const started = Date.now();
  const limit = args.limit ?? 15;
  const queries = buildQueries(args.icp, args.extraQuery);

  const searchResults = (
    await Promise.all(
      queries.map((q) =>
        webSearch(q, { limit: 6, location: args.icp.cities[0] }).catch(() => []),
      ),
    )
  ).flat();

  const catalog = args.products
    .filter((p) => p.is_active)
    .map((p) => `- ${p.name}: ${p.description ?? ""} (palavras-chave: ${p.keywords.join(", ")})`)
    .join("\n");

  const icpText = [
    `Nome: ${args.icp.name}`,
    `Estados: ${args.icp.states.join(", ") || "—"}`,
    `Cidades: ${args.icp.cities.join(", ") || "—"}`,
    `Segmentos: ${args.icp.segments.join(", ") || "—"}`,
    `Portes: ${args.icp.company_sizes.join(", ") || "—"}`,
    `Palavras-chave: ${args.icp.keywords.join(", ") || "—"}`,
  ].join("\n");

  const userPrompt = `## Catálogo da empresa usuária
${catalog}

## Perfil de Cliente Ideal (ICP)
${icpText}

## Resultados de busca (fontes públicas)
${searchResults
  .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`)
  .join("\n\n")}

## Tarefa
Extraia até ${limit} empresas-alvo REAIS e distintas que aderem ao ICP e teriam potencial de
comprar algum item do catálogo. Responda com JSON no formato:
{
  "leads": [
    {
      "name": "string",
      "legal_name": "string|null",
      "segment": "string|null",
      "description": "string|null",
      "city": "string|null",
      "state": "string|null (UF)",
      "website": "string|null",
      "instagram": "string|null (@handle ou url)",
      "phone": "string|null",
      "whatsapp": "string|null",
      "email": "string|null",
      "products_sold": ["string"],
      "source_urls": ["string"]
    }
  ]
}`;

  const model = MODELS.hunter;
  let leads: HunterLead[] = [];
  let usage = null;
  try {
    const msg = await anthropic().messages.create({
      model,
      max_tokens: 8000,
      system: HUNTER_SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
    });
    usage = msg.usage;
    const parsed = parseJsonFromText<{ leads: HunterLead[] }>(textOf(msg));
    leads = (parsed.leads ?? []).slice(0, limit);
  } finally {
    await logAiRun({
      companyId: args.companyId,
      agentKind: "hunter",
      model,
      input: { queries, results: searchResults.length },
      output: { count: leads.length },
      usage,
      durationMs: Date.now() - started,
      createdBy: args.userId ?? null,
    });
  }
  return leads;
}
