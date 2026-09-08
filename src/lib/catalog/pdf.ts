/**
 * Base Comercial — importação de catálogo PDF.
 *
 * Fluxo: upload → `catalog_import_jobs` → extração validada → revisão humana →
 * `applyImportJob` cria products + variações (grupos/opções nomeados) + variantes
 * (source = 'pdf'). Extração inválida NUNCA vira produto — o job vai para erro.
 */
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveActiveAi } from "@/lib/ai";
import { logCatalogEvent } from "./sources";
import {
  EXTRACTION_SYSTEM,
  demoExtraction,
  parseExtraction,
  type NormalizedItem,
  type NormalizedVariant,
} from "./extract";
import type { Json } from "@/lib/supabase/database.types";

export type { NormalizedItem, NormalizedVariant } from "./extract";

async function downloadPdfBase64(filePath: string): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("catalogs").download(filePath);
  if (error || !data) throw new Error(`Falha ao ler o PDF do storage: ${error?.message}`);
  const buf = Buffer.from(await data.arrayBuffer());
  return buf.toString("base64");
}

/** Processa um job: extrai + valida os itens do PDF e move para `review` (ou `error`). */
export async function processImportJob(jobId: string): Promise<void> {
  const admin = createAdminClient();
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
    const { provider, apiKey, model } = await resolveActiveAi(job.company_id);
    let items: NormalizedItem[];
    let usedDemo = false;

    if (provider === "anthropic" && apiKey) {
      const b64 = await downloadPdfBase64(job.file_path);
      const client = new Anthropic({ apiKey });
      const userContent = [
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: b64 },
        },
        {
          type: "text",
          text: "Extraia o catálogo completo em JSON, seguindo o schema à risca.",
        },
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

      const parsed = parseExtraction(text);
      if (!parsed.ok) {
        await admin
          .from("catalog_import_jobs")
          .update({
            status: "error",
            error_message: `Extração inválida — ${parsed.error}. Nada foi importado.`,
          })
          .eq("id", jobId);
        await logCatalogEvent(job.company_id, "pdf_error", { job: jobId, reason: parsed.error });
        return;
      }
      items = parsed.items;
    } else {
      items = demoExtraction();
      usedDemo = true;
    }

    const reviewCount = items.filter((i) => i.needsReview).length;
    await admin
      .from("catalog_import_jobs")
      .update({
        status: "review",
        extracted_items: { items, demo: usedDemo } as unknown as Json,
        extracted_count: items.length,
        review_count: reviewCount,
        error_message: null,
      })
      .eq("id", jobId);
    await logCatalogEvent(job.company_id, "pdf_processed", {
      job: jobId,
      items: items.length,
      review: reviewCount,
      demo: usedDemo,
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

function itemsOf(extracted: unknown): NormalizedItem[] {
  if (Array.isArray(extracted)) return extracted as NormalizedItem[];
  const obj = extracted as { items?: NormalizedItem[] };
  return Array.isArray(obj?.items) ? obj.items : [];
}

/**
 * Aplica os itens aprovados: cria products + grupos/opções NOMEADOS + variantes
 * com `source = 'pdf'`. Preserva a relação grupo→valor→preço.
 */
export async function applyImportJob(args: {
  jobId: string;
  companyId: string;
  approved: number[];
  edits?: Record<number, Partial<NormalizedItem>>;
}): Promise<{ created: number }> {
  const admin = createAdminClient();
  const { data: job } = await admin
    .from("catalog_import_jobs")
    .select("*")
    .eq("id", args.jobId)
    .eq("company_id", args.companyId)
    .single();
  if (!job) throw new Error("job não encontrado");

  const all = itemsOf(job.extracted_items);
  let created = 0;

  for (const idx of args.approved) {
    const item: NormalizedItem = { ...all[idx], ...(args.edits?.[idx] ?? {}) };
    if (!item?.name) continue;

    const { data: product, error: pErr } = await admin
      .from("products")
      .insert({
        company_id: args.companyId,
        name: item.name,
        kind: item.kind === "service" ? "service" : "product",
        description: item.description,
        source: "pdf",
        needs_review: item.needsReview,
      })
      .select("id")
      .single();
    if (pErr || !product) continue;

    // grupos nomeados: prioriza item.variationGroups; senão infere das variantes
    const groupNames = item.variationGroups.length
      ? item.variationGroups.map((g) => g.name)
      : [
          ...new Set(
            item.variants.flatMap((v) => Object.keys(v.optionsByGroup)),
          ),
        ];

    // groupName → { groupId, valueLabel → optionId }
    const groupMap = new Map<string, { id: string; options: Map<string, string> }>();
    for (const [gi, gName] of groupNames.entries()) {
      const { data: group } = await admin
        .from("product_variation_groups")
        .insert({
          company_id: args.companyId,
          product_id: product.id,
          name: gName,
          sort_order: gi,
        })
        .select("id")
        .single();
      if (!group) continue;
      const values =
        item.variationGroups.find((g) => g.name === gName)?.values ??
        [
          ...new Set(
            item.variants
              .map((v) => v.optionsByGroup[gName])
              .filter((x): x is string => !!x),
          ),
        ];
      const optMap = new Map<string, string>();
      for (const [oi, val] of values.entries()) {
        const { data: opt } = await admin
          .from("product_variation_options")
          .insert({
            company_id: args.companyId,
            group_id: group.id,
            value: val,
            sort_order: oi,
          })
          .select("id")
          .single();
        if (opt) optMap.set(val, opt.id);
      }
      groupMap.set(gName, { id: group.id, options: optMap });
    }

    for (const [vi, v] of item.variants.entries()) {
      const optionIds = Object.entries(v.optionsByGroup)
        .map(([g, val]) => groupMap.get(g)?.options.get(val))
        .filter((x): x is string => !!x);
      await admin.from("product_variants").insert({
        company_id: args.companyId,
        product_id: product.id,
        sku: v.sku,
        option_ids: optionIds,
        attributes: { ...item.attributes, ...v.attributes } as unknown as Json,
        price_kind: v.priceKind,
        price: v.price,
        price_tiers: v.priceTiers
          ? (v.priceTiers.map((t) => ({ min_qty: t.minQty, price: t.price })) as unknown as Json)
          : null,
        min_quantity: v.minQuantity,
        lead_time_days: v.leadTimeDays,
        source: "pdf",
        needs_review: item.needsReview,
        sort_order: vi,
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
    .update({
      status: "connected",
      products_count: created,
      last_sync_at: new Date().toISOString(),
    })
    .eq("company_id", args.companyId)
    .eq("kind", "pdf");
  await logCatalogEvent(args.companyId, "pdf_applied", { job: args.jobId, created });

  return { created };
}
