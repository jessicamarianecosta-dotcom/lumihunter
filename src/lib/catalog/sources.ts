/**
 * Base Comercial — leitura/escrita das fontes de catálogo (server-side).
 *
 * Tolerante ao estado "migration ainda não aplicada": se as tabelas não
 * existirem, retorna `ready: false` em vez de estourar, para a UI mostrar um
 * aviso claro em vez de quebrar.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  CatalogEvent,
  CatalogImportJob,
  CatalogSource,
  CatalogSourceKind,
  Json,
} from "@/lib/supabase/database.types";

export interface CatalogOverview {
  ready: boolean;
  manualCount: number;
  sources: CatalogSource[];
  jobs: CatalogImportJob[];
}

export function isMissingRelation(err: unknown): boolean {
  const msg = (err as { message?: string; code?: string })?.message ?? "";
  const code = (err as { code?: string })?.code ?? "";
  return (
    code === "42P01" ||
    /relation .* does not exist/i.test(msg) ||
    /Could not find the table/i.test(msg) ||
    /SUPABASE_SERVICE_ROLE_KEY/i.test(msg)
  );
}

export async function getCatalogOverview(companyId: string): Promise<CatalogOverview> {
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    // sem service-role key configurada → Base Comercial indisponível, sem quebrar
    return { ready: false, manualCount: 0, sources: [], jobs: [] };
  }
  try {
    const [{ data: sources }, { data: jobs }, { count }] = await Promise.all([
      admin
        .from("catalog_sources")
        .select("*")
        .eq("company_id", companyId)
        .order("kind"),
      admin
        .from("catalog_import_jobs")
        .select("*")
        .eq("company_id", companyId)
        .in("status", ["pending", "processing", "review", "error"])
        .order("created_at", { ascending: false }),
      admin
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("source", "manual"),
    ]);
    return {
      ready: true,
      manualCount: count ?? 0,
      sources: (sources ?? []) as CatalogSource[],
      jobs: (jobs ?? []) as CatalogImportJob[],
    };
  } catch (err) {
    // Qualquer falha ao ler a Base Comercial (tabela ausente, credencial, rede)
    // → a UI mostra o aviso em vez de derrubar a página de Produtos.
    if (!isMissingRelation(err)) {
      console.error("[catalog] getCatalogOverview falhou:", err);
    }
    return { ready: false, manualCount: 0, sources: [], jobs: [] };
  }
}

export function findSource(
  sources: CatalogSource[],
  kind: CatalogSourceKind,
): CatalogSource | null {
  return sources.find((s) => s.kind === kind) ?? null;
}

export async function upsertSource(args: {
  companyId: string;
  kind: CatalogSourceKind;
  patch: Partial<CatalogSource>;
  createdBy?: string | null;
}): Promise<CatalogSource> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("catalog_sources")
    .upsert(
      {
        company_id: args.companyId,
        kind: args.kind,
        created_by: args.createdBy ?? null,
        ...args.patch,
      },
      { onConflict: "company_id,kind" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as CatalogSource;
}

export async function removeSource(companyId: string, kind: CatalogSourceKind) {
  const admin = createAdminClient();
  await admin
    .from("catalog_sources")
    .delete()
    .eq("company_id", companyId)
    .eq("kind", kind);
}

export async function logCatalogEvent(
  companyId: string,
  kind: string,
  payload: Json = {},
): Promise<void> {
  try {
    await createAdminClient().from("catalog_events").insert({
      company_id: companyId,
      kind,
      payload,
    });
  } catch {
    /* observabilidade nunca bloqueia */
  }
}

export type { CatalogEvent };
