import { parseJsonFromText } from "../client";
import { ICP_ASSISTANT_SYSTEM } from "../prompts";
import { generateText, isAiDemoMode } from "@/lib/ai";
import { logAiRun } from "@/lib/ai/log";
import type { Company, Product } from "@/lib/supabase/database.types";

export interface IcpSuggestion {
  name: string;
  description: string;
  reasoning: string;
  states: string[];
  cities: string[];
  regions: string[];
  segments: string[];
  company_sizes: string[];
  keywords: string[];
  suggested_products: {
    name: string;
    description: string;
    keywords: string[];
    example_buyers: string[];
  }[];
}

interface RunArgs {
  companyId: string;
  company: Pick<
    Company,
    "name" | "segment" | "city" | "state" | "description"
  >;
  products: Pick<Product, "name">[];
  userId?: string | null;
}

export async function runIcpAssistant(args: RunArgs): Promise<IcpSuggestion> {
  const started = Date.now();
  const hasProducts = args.products.length > 0;

  if (await isAiDemoMode(args.companyId)) {
    const s = demoIcp(args.company, hasProducts);
    await logAiRun({
      companyId: args.companyId,
      agentKind: "qualifier",
      provider: "demo",
      model: "demo",
      input: { mode: "demo", assistant: "icp" },
      output: { segments: s.segments.length },
      usage: null,
      durationMs: Date.now() - started,
      createdBy: args.userId ?? null,
    });
    return s;
  }

  const userPrompt = `## Empresa (o que o usuário informou)
Nome: ${args.company.name}
Ramo / segmento: ${args.company.segment ?? "não informado"}
Cidade/UF: ${args.company.city ?? "não informada"} / ${args.company.state ?? "—"}
Descrição: ${args.company.description ?? "não informada"}

## Produtos já cadastrados
${hasProducts ? args.products.map((p) => `- ${p.name}`).join("\n") : "NENHUM — sugira os produtos/serviços típicos desse ramo."}

## Tarefa
Proponha o Perfil de Cliente Ideal. JSON:
{
  "name": "nome curto do perfil",
  "description": "2-3 frases sobre quem é esse cliente",
  "reasoning": "1-2 frases explicando o raciocínio, linguagem simples",
  "states": ["UF"],
  "cities": ["cidades e região metropolitana"],
  "regions": ["ex: Grande São Paulo"],
  "segments": ["segmentos de clientes que compram"],
  "company_sizes": ["MEI","pequena","média"],
  "keywords": ["termos que aparecem nos sites/redes desses clientes"],
  "suggested_products": ${hasProducts ? "[]" : '[{ "name": "", "description": "", "keywords": [], "example_buyers": [] }]'}
}`;

  let out: IcpSuggestion = demoIcp(args.company, hasProducts);
  let usage = null;
  let provider: "anthropic" | "openai" = "anthropic";
  let model = "unknown";
  try {
    const res = await generateText({
      companyId: args.companyId,
      system: ICP_ASSISTANT_SYSTEM,
      prompt: userPrompt,
      maxTokens: 2500,
    });
    usage = res.usage;
    provider = res.provider;
    model = res.model;
    out = parseJsonFromText<IcpSuggestion>(res.text);
    out.suggested_products ??= [];
  } finally {
    await logAiRun({
      companyId: args.companyId,
      agentKind: "qualifier",
      provider,
      model,
      input: { assistant: "icp", company: args.company.name },
      output: { segments: out.segments?.length ?? 0 },
      usage,
      durationMs: Date.now() - started,
      createdBy: args.userId ?? null,
    });
  }
  return out;
}

function demoIcp(
  company: RunArgs["company"],
  hasProducts: boolean,
): IcpSuggestion {
  const city = company.city || "sua cidade";
  const uf = company.state || "SP";
  const ramo = (company.segment || "serviços").toLowerCase();
  return {
    name: `Clientes ideais — ${company.name}`,
    description: `Pequenos e médios negócios de ${city} e região que precisam de ${ramo} de forma recorrente e valorizam atendimento próximo.`,
    reasoning: `Como a ${company.name} atua com ${ramo} em ${city}, o melhor alvo são negócios locais do mesmo raio de entrega, que compram com frequência. (sugestão em modo demo)`,
    states: [uf],
    cities: [city, "região metropolitana"],
    regions: [`Região de ${city}`],
    segments: [
      "comércio local",
      "prestadores de serviço",
      "pequenas indústrias",
      "e-commerce regional",
      "eventos",
    ],
    company_sizes: ["MEI", "pequena", "média"],
    keywords: [
      "encomendas",
      "orçamento",
      "atacado",
      "personalizado",
      "identidade visual",
    ],
    suggested_products: hasProducts
      ? []
      : [
          {
            name: `${company.segment || "Serviço"} sob demanda`,
            description: `Principal serviço da ${company.name}.`,
            keywords: [ramo, "personalizado", "orçamento"],
            example_buyers: ["lojas", "restaurantes", "prestadores de serviço"],
          },
        ],
  };
}
