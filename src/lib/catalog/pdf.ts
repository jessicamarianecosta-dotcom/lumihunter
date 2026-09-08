/**
 * Base Comercial — importação de catálogo PDF.
 *
 * Fluxo: upload → `catalog_import_jobs` (extracted_items) → revisão humana →
 * `applyImportJob` cria products + variações + variantes (source = 'pdf').
 *
 * A extração usa a API da Anthropic (leitura nativa de PDF) quando há chave
 * real configurada; sem chave (modo demo) devolve uma extração de exemplo para
 * o fluxo de revisão continuar testável. NUNCA preenche um campo que não pôde
 * ser determinado — marca o item como `review`.
 */
import Anthropic from "@anthropic-ai/sdk";
import { catalogAdmin } from "./db";
import { resolveActiveAi } from "@/lib/ai";
import { logCatalogEvent } from "./sources";
import type { Json } from "@/lib/supabase/database.types";

export interface ExtractedVariant {
  optionLabels: string[];
  attributes: Record<string, string | number | null>;
  priceKind: "fixed" | "per_unit" | "per_quantity" | "quote";
  price: number | null;
  minQuantity: number | null;
  leadTimeDays: number | null;
}

export interface ExtractedItem {
  name: string;
  category: string | null;
  kind: "product" | "service";
  description: string | null;
  attributes: Record<string, string | number | null>;
  variants: ExtractedVariant[];
  /** 'ok' = confiável; 'review' = ambíguo, precisa de olhada humana. */
  confidence: "ok" | "review";
  notes: string | null;
}

const EXTRACTION_SYSTEM = `Você extrai um catálogo comercial de um PDF e devolve APENAS JSON.
Regras invioláveis:
- NÃO invente nada. Só registre o que está EXPLÍCITO no PDF.
- Campo sem informação clara → null. Item ambíguo → "confidence": "review".
- Preço: transcreva exatamente o valor impresso (R$). Se houver preço por
  quantidade/variação, gere uma variante para cada.
- Atributos livres conforme o ramo (material, gramatura, medida, acabamento,
  sabor, fragrância, cor, peso...). Não force campos de gráfica.
Schema:
{"items":[{
  "name": string,
  "category": string|null,
  "kind": "product"|"service",
  "description": string|null,
  "attributes": { "<attr>": string|number|null },
  "variants": [{
    "optionLabels": string[],
    "attributes": { "<attr>": string|number|null },
    "priceKind": "fixed"|"per_unit"|"per_quantity"|"quote",
    "price": number|null,
    "minQuantity": number|null,
    "leadTimeDays": number|null
  }],
  "confidence": "ok"|"review",
  "notes": string|null
}]}`;

function demoExtraction(): ExtractedItem[] {
  return [
    {
      name: "Cartão de visita",
      category: "Gráfica",
      kind: "product",
      description: "Extração de exemplo (modo demo — sem chave de IA).",
      attributes: { medida: "9x5 cm" },
      variants: [
        {
          optionLabels: ["Couché 250g", "Frente e verso", "100 un"],
          attributes: { material: "Couché", gramatura: "250g" },
          priceKind: "fixed",
          price: 35,
          minQuantity: 100,
          leadTimeDays: 3,
        },
      ],
      confidence: "ok",
      notes: null,
    },
    {
      name: "Banner",
      category: "Comunicação Visual",
      kind: "product",
      description: null,
      attributes: { medida: "60x40 cm" },
      variants: [
        {
          optionLabels: [],
          attributes: {},
          priceKind: "quote",
          price: null,
          minQuantity: null,
          leadTimeDays: null,
        },
      ],
      confidence: "review",
      notes: "Preço não localizado no PDF de exemplo.",
    },
  ];
}

async function downloadPdfBase64(filePath: string): Promise<string> {
  const admin = catalogAdmin();
  const { data, error } = await admin.storage.from("catalogs").download(filePath);
  if (error || !data) throw new Error(`Falha ao ler o PDF do storage: ${error?.message}`);
  const buf = Buffer.from(await data.arrayBuffer());
  return buf.toString("base64");
}

function safeParseItems(text: string): ExtractedItem[] {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  const slice = start >= 0 && end >= 0 ? text.slice(start, end + 1) : text;
  const parsed = JSON.parse(slice) as { items?: ExtractedItem[] };
  return Array.isArray(parsed.items) ? parsed.items : [];
}

/** Processa um job: extrai os itens do PDF e move o job para `review`. */
export async function processImportJob(jobId: string): Promise<void> {
  const admin = catalogAdmin();
  const { data: job } = await admin
    .from("catalog_import_jobs")
    .select("*")
    .eq("id", jobId)
    .single();
  if (!job) throw new Error("job não encontrado");

  await admin
    .from("catalog_import_jobs")
    .update({ status: "processing" })
    .eq("id", jobId);

  try {
    let items: ExtractedItem[];
    const { provider, apiKey, model } = await resolveActiveAi(job.company_id);

    if (provider === "anthropic" && apiKey) {
      const b64 = await downloadPdfBase64(job.file_path);
      const client = new Anthropic({ apiKey });
      // O bloco `document` (leitura nativa de PDF) foi adicionado à API depois
      // da versão do SDK fixada aqui; o cast mantém o build sem bumpar o SDK.
      const userContent = [
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: b64 },
        },
        { type: "text", text: "Extraia o catálogo completo em JSON." },
      ] as unknown as Anthropic.MessageParam["content"];
      const msg = await client.messages.create({
        model,
        max_tokens: 8000,
        system: EXTRACTION_SYSTEM,
        messages: [{ role: "user", content: userContent }],
      });
      const text = msg.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      items = safeParseItems(text);
    } else {
      // Sem chave Anthropic: fluxo de revisão com extração de exemplo.
      items = demoExtraction();
    }

    const reviewCount = items.filter((i) => i.confidence === "review").length;
    await admin
      .from("catalog_import_jobs")
      .update({
        status: "review",
        extracted_items: items as unknown as Json,
        extracted_count: items.length,
        review_count: reviewCount,
        error_message: null,
      })
      .eq("id", jobId);
    await logCatalogEvent(job.company_id, "pdf_processed", {
      job: jobId,
      items: items.length,
      review: reviewCount,
    });
  } catch (e) {
    await admin
      .from("catalog_import_jobs")
      .update({ status: "error", error_message: (e as Error).message })
      .eq("id", jobId);
    await logCatalogEvent(job.company_id, "pdf_error", { job: jobId });
    throw e;
  }
}

/**
 * Aplica os itens aprovados de um job: cria products + grupos/opções + variantes
 * com `source = 'pdf'`. `approved` são os índices de `extracted_items` a criar;
 * `edits` permite sobrescrever um item antes de aplicar.
 */
export async function applyImportJob(args: {
  jobId: string;
  companyId: string;
  approved: number[];
  edits?: Record<number, Partial<ExtractedItem>>;
}): Promise<{ created: number }> {
  const admin = catalogAdmin();
  const { data: job } = await admin
    .from("catalog_import_jobs")
    .select("*")
    .eq("id", args.jobId)
    .eq("company_id", args.companyId)
    .single();
  if (!job) throw new Error("job não encontrado");

  const all = (job.extracted_items ?? []) as unknown as ExtractedItem[];
  let created = 0;

  for (const idx of args.approved) {
    const item: ExtractedItem = { ...all[idx], ...(args.edits?.[idx] ?? {}) };
    if (!item?.name) continue;

    const { data: product, error: pErr } = await admin
      .from("products")
      .insert({
        company_id: args.companyId,
        name: item.name,
        kind: item.kind === "service" ? "service" : "product",
        description: item.description,
        source: "pdf",
        needs_review: item.confidence === "review",
      })
      .select("id")
      .single();
    if (pErr || !product) continue;

    // grupos/opções a partir dos optionLabels das variantes (heurística simples:
    // 1 grupo "Opções" — o refinamento fino fica para a UI de variações)
    const labelSet = [
      ...new Set(item.variants.flatMap((v) => v.optionLabels)),
    ];
    const optionIdByLabel = new Map<string, string>();
    if (labelSet.length) {
      const { data: group } = await admin
        .from("product_variation_groups")
        .insert({
          company_id: args.companyId,
          product_id: product.id,
          name: "Opções",
        })
        .select("id")
        .single();
      if (group) {
        for (const label of labelSet) {
          const { data: opt } = await admin
            .from("product_variation_options")
            .insert({
              company_id: args.companyId,
              group_id: group.id,
              value: label,
            })
            .select("id")
            .single();
          if (opt) optionIdByLabel.set(label, opt.id);
        }
      }
    }

    for (const v of item.variants) {
      await admin.from("product_variants").insert({
        company_id: args.companyId,
        product_id: product.id,
        option_ids: v.optionLabels
          .map((l) => optionIdByLabel.get(l))
          .filter((x): x is string => !!x),
        attributes: v.attributes as unknown as Json,
        price_kind: v.priceKind,
        price: v.price,
        min_quantity: v.minQuantity,
        lead_time_days: v.leadTimeDays,
        source: "pdf",
        needs_review: item.confidence === "review",
      });
    }
    created += 1;
  }

  await admin
    .from("catalog_import_jobs")
    .update({ status: "applied", applied_count: created })
    .eq("id", args.jobId);
  await admin
    .from("catalog_sources")
    .update({ status: "connected", products_count: created, last_sync_at: new Date().toISOString() })
    .eq("company_id", args.companyId)
    .eq("kind", "pdf");
  await logCatalogEvent(args.companyId, "pdf_applied", { job: args.jobId, created });

  return { created };
}
