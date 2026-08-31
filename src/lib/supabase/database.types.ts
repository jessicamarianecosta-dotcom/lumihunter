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
export type Product = Tables<"products">;
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
