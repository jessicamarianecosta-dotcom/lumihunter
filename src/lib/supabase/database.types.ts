/**
 * Tipos do banco.
 * `database.generated.ts` é gerado do projeto real:
 *   npm run db:types   (supabase gen types typescript --linked)
 * Este arquivo re-exporta e adiciona aliases de conveniência usados pela app.
 */
import type { Database as GenDatabase, Json as GenJson } from "./database.generated";

export type Database = GenDatabase;
export type Json = GenJson;

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];
export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T];

// ── Enums ────────────────────────────────────────────────────────────────
export type MemberRole = Enums<"member_role">;
export type PlanTier = Enums<"plan_tier">;
export type ChannelType = Enums<"channel_type">;
export type LeadStatus = Enums<"lead_status">;
export type TaskStatus = Enums<"task_status">;
export type ConversationStatus = Enums<"conversation_status">;
export type MessageDirection = Enums<"message_direction">;
export type MessageStatus = Enums<"message_status">;
export type CampaignStatus = Enums<"campaign_status">;
export type AiAgentKind = Enums<"ai_agent_kind">;

// ── Aliases de linha ─────────────────────────────────────────────────────
export type Company = Tables<"companies">;
export type Profile = Tables<"profiles">;
export type CompanyMember = Tables<"company_members">;
type ProductBase = Tables<"products">;
/** `products` + colunas da Base Comercial (migration 20260908210000). */
export type Product = ProductBase & Partial<ProductCatalogColumns>;
export type IcpProfile = Tables<"icp_profiles">;
export type PipelineStage = Tables<"pipeline_stages">;
export type Lead = Tables<"leads">;
export type Conversation = Tables<"conversations">;
export type Message = Tables<"messages">;
export type Campaign = Tables<"campaigns">;
export type Task = Tables<"tasks">;
export type Activity = Tables<"activities">;
export type AiAgent = Tables<"ai_agents">;
export type AiRun = Tables<"ai_runs">;
export type KnowledgeEntry = Tables<"knowledge_entries">;
export type MessageTemplate = Tables<"message_templates">;
export type Invitation = Tables<"invitations">;

// ═════════════════════════════════════════════════════════════════════════
// Base Comercial — tipos manuais.
// A migration `20260908210000_base_comercial.sql` ainda não foi aplicada; ao
// regerar `database.generated.ts`, estes tipos podem ser substituídos pelos
// gerados. O acesso a estas tabelas usa `catalogAdmin()` em `src/lib/catalog/db`.
// ═════════════════════════════════════════════════════════════════════════
export type CatalogSourceKind = "manual" | "pdf" | "precy_online";
export type PriceKindDb = "fixed" | "per_unit" | "per_quantity" | "quote";

export type ProductCatalogColumns = {
  source: CatalogSourceKind;
  external_source: string | null;
  external_id: string | null;
  external_url: string | null;
  last_synced_at: string | null;
  needs_review: boolean;
  search_text: string | null;
}

export type CatalogSource = {
  id: string;
  company_id: string;
  kind: CatalogSourceKind;
  status: string;
  file_path: string | null;
  file_name: string | null;
  external_url: string | null;
  products_count: number;
  last_sync_at: string | null;
  last_sync_summary: Json | null;
  error_message: string | null;
  config: Json;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ProductVariationGroupRow = {
  id: string;
  company_id: string;
  product_id: string;
  name: string;
  sort_order: number;
  external_id: string | null;
  created_at: string;
  updated_at: string;
}

export type ProductVariationOptionRow = {
  id: string;
  company_id: string;
  group_id: string;
  value: string;
  sort_order: number;
  external_id: string | null;
  created_at: string;
}

export type ProductVariantRow = {
  id: string;
  company_id: string;
  product_id: string;
  sku: string | null;
  option_ids: string[];
  attributes: Json;
  price_kind: PriceKindDb;
  price: number | null;
  price_tiers: Json | null;
  currency: string;
  min_quantity: number | null;
  lead_time_days: number | null;
  stock_quantity: number | null;
  notes: string | null;
  is_active: boolean;
  needs_review: boolean;
  source: CatalogSourceKind;
  external_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type CatalogImportJob = {
  id: string;
  company_id: string;
  source_id: string | null;
  file_path: string;
  file_name: string | null;
  status: string;
  extracted_count: number;
  review_count: number;
  applied_count: number;
  extracted_items: Json;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type CatalogEvent = {
  id: string;
  company_id: string;
  kind: string;
  payload: Json;
  created_at: string;
}

// Aliases legíveis
export type ProductVariationGroup = ProductVariationGroupRow;
export type ProductVariationOption = ProductVariationOptionRow;
export type ProductVariant = ProductVariantRow;
