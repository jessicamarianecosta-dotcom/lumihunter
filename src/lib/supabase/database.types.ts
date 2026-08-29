/**
 * Tipos do banco — versão inicial mantida à mão.
 * Regenere a partir do projeto real com:  npm run db:types
 * (requer `supabase link --project-ref <ref>`)
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type MemberRole =
  | "owner"
  | "admin"
  | "sales"
  | "marketing"
  | "finance"
  | "viewer";
export type PlanTier = "free" | "starter" | "pro" | "business";
export type ChannelType = "whatsapp" | "email" | "instagram" | "call" | "manual";
export type LeadStatus =
  | "new"
  | "qualified"
  | "contacted"
  | "replied"
  | "interested"
  | "quoted"
  | "negotiation"
  | "won"
  | "lost";
export type TaskStatus = "open" | "doing" | "done" | "cancelled";
export type ConversationStatus = "open" | "pending" | "closed";
export type MessageDirection = "inbound" | "outbound";
export type MessageStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "bounced"
  | "received";
export type CampaignStatus =
  | "draft"
  | "active"
  | "paused"
  | "completed"
  | "archived";
export type AiAgentKind =
  | "hunter"
  | "qualifier"
  | "copywriter"
  | "sales_coach"
  | "analyst";

/** Mapeia a interface para um type-literal (ganha index signature implícita),
 *  necessário para satisfazer o GenericTable do supabase-js. */
type Obj<T> = { [K in keyof T]: T[K] };

interface TableShape<Row> {
  Row: Obj<Row>;
  Insert: Partial<Obj<Row>>;
  Update: Partial<Obj<Row>>;
  Relationships: [];
}

export interface Company {
  id: string;
  name: string;
  legal_name: string | null;
  cnpj: string | null;
  city: string | null;
  state: string | null;
  segment: string | null;
  description: string | null;
  website: string | null;
  instagram: string | null;
  commercial_whatsapp: string | null;
  commercial_email: string | null;
  logo_url: string | null;
  brand_color: string | null;
  plan: PlanTier;
  onboarding_completed: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  locale: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyMember {
  id: string;
  company_id: string;
  user_id: string;
  role: MemberRole;
  invited_by: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  company_id: string;
  category_id: string | null;
  name: string;
  kind: string;
  description: string | null;
  price_start: number | null;
  price_avg: number | null;
  min_quantity: number | null;
  lead_time_days: number | null;
  cities_served: string[];
  keywords: string[];
  applications: string[];
  ideal_audience: string | null;
  use_cases: string[];
  example_buyers: string[];
  tags: string[];
  photo_urls: string[];
  catalog_pdf_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface IcpProfile {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  states: string[];
  cities: string[];
  regions: string[];
  segments: string[];
  company_sizes: string[];
  headcount_min: number | null;
  headcount_max: number | null;
  revenue_band: string | null;
  keywords: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PipelineStage {
  id: string;
  company_id: string;
  name: string;
  slug: string;
  position: number;
  is_won: boolean;
  is_lost: boolean;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  company_id: string;
  stage_id: string | null;
  owner_id: string | null;
  status: LeadStatus;
  name: string;
  legal_name: string | null;
  segment: string | null;
  description: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  zipcode: string | null;
  latitude: number | null;
  longitude: number | null;
  google_maps_url: string | null;
  google_rating: number | null;
  google_reviews_count: number | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
  products_sold: string[];
  notes: string | null;
  source: string;
  discovered_at: string;
  score: number | null;
  score_reason: string | null;
  score_factors: Json;
  ai_summary: string | null;
  recommended_product_ids: string[];
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  company_id: string;
  lead_id: string;
  channel: ChannelType;
  external_id: string | null;
  status: ConversationStatus;
  ai_classification: string | null;
  ai_summary: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  company_id: string;
  conversation_id: string;
  lead_id: string;
  campaign_id: string | null;
  channel: ChannelType;
  direction: MessageDirection;
  status: MessageStatus;
  subject: string | null;
  body: string | null;
  attachments: Json;
  provider_message_id: string | null;
  error: string | null;
  sent_by: string | null;
  scheduled_for: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
}

export interface Campaign {
  id: string;
  company_id: string;
  name: string;
  goal: string | null;
  product_id: string | null;
  icp_id: string | null;
  channel: ChannelType;
  segment: string | null;
  city: string | null;
  target_count: number;
  status: CampaignStatus;
  template_id: string | null;
  followup_sequence_id: string | null;
  created_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  company_id: string;
  lead_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: string;
  due_at: string | null;
  assignee_id: string | null;
  created_by: string | null;
  completed_at: string | null;
  checklist: Json;
  google_event_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  company_id: string;
  lead_id: string | null;
  actor_id: string | null;
  kind: string;
  title: string | null;
  body: string | null;
  meta: Json;
  created_at: string;
}

export interface AiAgent {
  id: string;
  company_id: string;
  kind: AiAgentKind;
  name: string;
  model: string;
  system_prompt: string | null;
  temperature: number;
  is_active: boolean;
  config: Json;
  created_at: string;
  updated_at: string;
}

export interface AiRun {
  id: string;
  company_id: string;
  agent_kind: AiAgentKind;
  model: string;
  lead_id: string | null;
  campaign_id: string | null;
  input: Json;
  output: Json;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  duration_ms: number | null;
  status: string;
  error: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      companies: TableShape<Company>;
      profiles: TableShape<Profile>;
      company_members: TableShape<CompanyMember>;
      product_categories: TableShape<{
        id: string;
        company_id: string;
        name: string;
        slug: string | null;
        created_at: string;
        updated_at: string;
      }>;
      products: TableShape<Product>;
      icp_profiles: TableShape<IcpProfile>;
      icp_products: TableShape<{
        id: string;
        company_id: string;
        icp_id: string;
        product_id: string;
        created_at: string;
      }>;
      pipeline_stages: TableShape<PipelineStage>;
      leads: TableShape<Lead>;
      lead_contacts: TableShape<{
        id: string;
        company_id: string;
        lead_id: string;
        name: string | null;
        role: string | null;
        phone: string | null;
        whatsapp: string | null;
        email: string | null;
        is_primary: boolean;
        created_at: string;
        updated_at: string;
      }>;
      lead_tags: TableShape<{
        id: string;
        company_id: string;
        lead_id: string;
        tag: string;
        created_at: string;
      }>;
      lead_stage_history: TableShape<{
        id: string;
        company_id: string;
        lead_id: string;
        from_stage_id: string | null;
        to_stage_id: string | null;
        changed_by: string | null;
        changed_at: string;
      }>;
      activities: TableShape<Activity>;
      message_templates: TableShape<{
        id: string;
        company_id: string;
        name: string;
        channel: ChannelType;
        subject: string | null;
        preheader: string | null;
        body: string;
        cta: string | null;
        is_ai_generated: boolean;
        created_by: string | null;
        created_at: string;
        updated_at: string;
      }>;
      campaigns: TableShape<Campaign>;
      campaign_targets: TableShape<{
        id: string;
        company_id: string;
        campaign_id: string;
        lead_id: string;
        step: number;
        status: string;
        next_action_at: string | null;
        last_message_at: string | null;
        created_at: string;
        updated_at: string;
      }>;
      conversations: TableShape<Conversation>;
      messages: TableShape<Message>;
      tasks: TableShape<Task>;
      notes: TableShape<{
        id: string;
        company_id: string;
        lead_id: string | null;
        author_id: string | null;
        body: string;
        created_at: string;
        updated_at: string;
      }>;
      followup_sequences: TableShape<{
        id: string;
        company_id: string;
        name: string;
        channel: ChannelType;
        steps: Json;
        stop_on_reply: boolean;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      }>;
      automations: TableShape<{
        id: string;
        company_id: string;
        name: string;
        trigger: string;
        conditions: Json;
        actions: Json;
        is_active: boolean;
        created_by: string | null;
        created_at: string;
        updated_at: string;
      }>;
      automation_runs: TableShape<{
        id: string;
        company_id: string;
        automation_id: string;
        lead_id: string | null;
        status: string;
        detail: Json;
        created_at: string;
      }>;
      ai_agents: TableShape<AiAgent>;
      ai_runs: TableShape<AiRun>;
      integrations: TableShape<{
        id: string;
        company_id: string;
        provider: string;
        is_connected: boolean;
        config: Json;
        vault_secret_name: string | null;
        connected_by: string | null;
        connected_at: string | null;
        created_at: string;
        updated_at: string;
      }>;
      blacklist: TableShape<{
        id: string;
        company_id: string;
        channel: ChannelType;
        value: string;
        reason: string | null;
        created_at: string;
      }>;
      consents: TableShape<{
        id: string;
        company_id: string;
        lead_id: string | null;
        channel: ChannelType | null;
        kind: string;
        source: string | null;
        detail: Json;
        created_at: string;
      }>;
      subscriptions: TableShape<{
        id: string;
        company_id: string;
        plan: PlanTier;
        status: string;
        stripe_customer_id: string | null;
        stripe_subscription_id: string | null;
        current_period_end: string | null;
        limits: Json;
        created_at: string;
        updated_at: string;
      }>;
    };
    Views: {
      dashboard_metrics: {
        Row: {
          company_id: string;
          leads_total: number;
          leads_qualified: number;
          whatsapp_sent: number;
          emails_sent: number;
          replies_total: number;
          interested_total: number;
          quotes_total: number;
          won_total: number;
          revenue_estimate: number;
        };
        Relationships: [];
      };
      pipeline_summary: {
        Row: {
          company_id: string;
          stage_id: string;
          stage_name: string;
          stage_slug: string;
          position: number;
          lead_count: number;
        };
        Relationships: [];
      };
      leads_by_city: {
        Row: {
          company_id: string;
          city: string;
          state: string | null;
          total: number;
          avg_score: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      create_company: {
        Args: {
          p_name: string;
          p_segment?: string | null;
          p_city?: string | null;
          p_state?: string | null;
        };
        Returns: string;
      };
      seed_lumilife: { Args: Record<string, never>; Returns: string };
      auth_company_ids: { Args: Record<string, never>; Returns: string[] };
    };
    Enums: {
      member_role: MemberRole;
      plan_tier: PlanTier;
      channel_type: ChannelType;
      lead_status: LeadStatus;
      ai_agent_kind: AiAgentKind;
    };
    CompositeTypes: Record<string, never>;
  };
}
