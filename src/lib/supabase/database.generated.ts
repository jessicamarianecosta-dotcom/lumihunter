export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          actor_id: string | null
          body: string | null
          company_id: string
          created_at: string
          id: string
          kind: string
          lead_id: string | null
          meta: Json
          title: string | null
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          company_id: string
          created_at?: string
          id?: string
          kind: string
          lead_id?: string | null
          meta?: Json
          title?: string | null
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          company_id?: string
          created_at?: string
          id?: string
          kind?: string
          lead_id?: string | null
          meta?: Json
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          company_id: string
          config: Json
          created_at: string
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["ai_agent_kind"]
          model: string
          name: string
          system_prompt: string | null
          temperature: number
          updated_at: string
        }
        Insert: {
          company_id: string
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["ai_agent_kind"]
          model?: string
          name: string
          system_prompt?: string | null
          temperature?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["ai_agent_kind"]
          model?: string
          name?: string
          system_prompt?: string | null
          temperature?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["company_id"]
          },
        ]
      }
      ai_runs: {
        Row: {
          agent_kind: Database["public"]["Enums"]["ai_agent_kind"]
          campaign_id: string | null
          company_id: string
          cost_usd: number | null
          created_at: string
          created_by: string | null
          duration_ms: number | null
          error: string | null
          id: string
          input: Json | null
          input_tokens: number | null
          lead_id: string | null
          model: string
          output: Json | null
          output_tokens: number | null
          status: string
        }
        Insert: {
          agent_kind: Database["public"]["Enums"]["ai_agent_kind"]
          campaign_id?: string | null
          company_id: string
          cost_usd?: number | null
          created_at?: string
          created_by?: string | null
          duration_ms?: number | null
          error?: string | null
          id?: string
          input?: Json | null
          input_tokens?: number | null
          lead_id?: string | null
          model: string
          output?: Json | null
          output_tokens?: number | null
          status?: string
        }
        Update: {
          agent_kind?: Database["public"]["Enums"]["ai_agent_kind"]
          campaign_id?: string | null
          company_id?: string
          cost_usd?: number | null
          created_at?: string
          created_by?: string | null
          duration_ms?: number | null
          error?: string | null
          id?: string
          input?: Json | null
          input_tokens?: number | null
          lead_id?: string | null
          model?: string
          output?: Json | null
          output_tokens?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_runs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "ai_runs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          automation_id: string
          company_id: string
          created_at: string
          detail: Json
          id: string
          lead_id: string | null
          status: string
        }
        Insert: {
          automation_id: string
          company_id: string
          created_at?: string
          detail?: Json
          id?: string
          lead_id?: string | null
          status?: string
        }
        Update: {
          automation_id?: string
          company_id?: string
          created_at?: string
          detail?: Json
          id?: string
          lead_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "automation_runs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          actions: Json
          company_id: string
          conditions: Json
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          trigger: Database["public"]["Enums"]["automation_trigger"]
          updated_at: string
        }
        Insert: {
          actions?: Json
          company_id: string
          conditions?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          trigger: Database["public"]["Enums"]["automation_trigger"]
          updated_at?: string
        }
        Update: {
          actions?: Json
          company_id?: string
          conditions?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          trigger?: Database["public"]["Enums"]["automation_trigger"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["company_id"]
          },
        ]
      }
      blacklist: {
        Row: {
          channel: Database["public"]["Enums"]["channel_type"]
          company_id: string
          created_at: string
          id: string
          reason: string | null
          value: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["channel_type"]
          company_id: string
          created_at?: string
          id?: string
          reason?: string | null
          value: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["channel_type"]
          company_id?: string
          created_at?: string
          id?: string
          reason?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "blacklist_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blacklist_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["company_id"]
          },
        ]
      }
      campaign_targets: {
        Row: {
          campaign_id: string
          company_id: string
          created_at: string
          id: string
          last_message_at: string | null
          lead_id: string
          next_action_at: string | null
          status: string
          step: number
          updated_at: string
        }
        Insert: {
          campaign_id: string
          company_id: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          lead_id: string
          next_action_at?: string | null
          status?: string
          step?: number
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          company_id?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          lead_id?: string
          next_action_at?: string | null
          status?: string
          step?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_targets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_targets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_targets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "campaign_targets_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          channel: Database["public"]["Enums"]["channel_type"]
          city: string | null
          company_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          followup_sequence_id: string | null
          goal: string | null
          icp_id: string | null
          id: string
          name: string
          product_id: string | null
          segment: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          target_count: number | null
          template_id: string | null
          updated_at: string
        }
        Insert: {
          channel?: Database["public"]["Enums"]["channel_type"]
          city?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          followup_sequence_id?: string | null
          goal?: string | null
          icp_id?: string | null
          id?: string
          name: string
          product_id?: string | null
          segment?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          target_count?: number | null
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["channel_type"]
          city?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          followup_sequence_id?: string | null
          goal?: string | null
          icp_id?: string | null
          id?: string
          name?: string
          product_id?: string | null
          segment?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          target_count?: number | null
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "campaigns_followup_fk"
            columns: ["followup_sequence_id"]
            isOneToOne: false
            referencedRelation: "followup_sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_icp_id_fkey"
            columns: ["icp_id"]
            isOneToOne: false
            referencedRelation: "icp_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          brand_color: string | null
          city: string | null
          cnpj: string | null
          commercial_email: string | null
          commercial_whatsapp: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          instagram: string | null
          legal_name: string | null
          logo_url: string | null
          name: string
          onboarding_completed: boolean
          plan: Database["public"]["Enums"]["plan_tier"]
          segment: string | null
          state: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          brand_color?: string | null
          city?: string | null
          cnpj?: string | null
          commercial_email?: string | null
          commercial_whatsapp?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          instagram?: string | null
          legal_name?: string | null
          logo_url?: string | null
          name: string
          onboarding_completed?: boolean
          plan?: Database["public"]["Enums"]["plan_tier"]
          segment?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          brand_color?: string | null
          city?: string | null
          cnpj?: string | null
          commercial_email?: string | null
          commercial_whatsapp?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          instagram?: string | null
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          onboarding_completed?: boolean
          plan?: Database["public"]["Enums"]["plan_tier"]
          segment?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["company_id"]
          },
        ]
      }
      consents: {
        Row: {
          channel: Database["public"]["Enums"]["channel_type"] | null
          company_id: string
          created_at: string
          detail: Json
          id: string
          kind: string
          lead_id: string | null
          source: string | null
        }
        Insert: {
          channel?: Database["public"]["Enums"]["channel_type"] | null
          company_id: string
          created_at?: string
          detail?: Json
          id?: string
          kind: string
          lead_id?: string | null
          source?: string | null
        }
        Update: {
          channel?: Database["public"]["Enums"]["channel_type"] | null
          company_id?: string
          created_at?: string
          detail?: Json
          id?: string
          kind?: string
          lead_id?: string | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "consents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          ai_classification: string | null
          ai_summary: string | null
          assigned_to: string | null
          channel: Database["public"]["Enums"]["channel_type"]
          company_id: string
          created_at: string
          external_id: string | null
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          lead_id: string
          status: Database["public"]["Enums"]["conversation_status"]
          unread_count: number
          updated_at: string
        }
        Insert: {
          ai_classification?: string | null
          ai_summary?: string | null
          assigned_to?: string | null
          channel: Database["public"]["Enums"]["channel_type"]
          company_id: string
          created_at?: string
          external_id?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          lead_id: string
          status?: Database["public"]["Enums"]["conversation_status"]
          unread_count?: number
          updated_at?: string
        }
        Update: {
          ai_classification?: string | null
          ai_summary?: string | null
          assigned_to?: string | null
          channel?: Database["public"]["Enums"]["channel_type"]
          company_id?: string
          created_at?: string
          external_id?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          lead_id?: string
          status?: Database["public"]["Enums"]["conversation_status"]
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_sequences: {
        Row: {
          channel: Database["public"]["Enums"]["channel_type"]
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          steps: Json
          stop_on_reply: boolean
          updated_at: string
        }
        Insert: {
          channel?: Database["public"]["Enums"]["channel_type"]
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          steps?: Json
          stop_on_reply?: boolean
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["channel_type"]
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          steps?: Json
          stop_on_reply?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_sequences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_sequences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["company_id"]
          },
        ]
      }
      icp_products: {
        Row: {
          company_id: string
          created_at: string
          icp_id: string
          id: string
          product_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          icp_id: string
          id?: string
          product_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          icp_id?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "icp_products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "icp_products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "icp_products_icp_id_fkey"
            columns: ["icp_id"]
            isOneToOne: false
            referencedRelation: "icp_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "icp_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      icp_profiles: {
        Row: {
          cities: string[]
          company_id: string
          company_sizes: string[]
          created_at: string
          description: string | null
          headcount_max: number | null
          headcount_min: number | null
          id: string
          is_active: boolean
          keywords: string[]
          name: string
          regions: string[]
          revenue_band: string | null
          segments: string[]
          states: string[]
          updated_at: string
        }
        Insert: {
          cities?: string[]
          company_id: string
          company_sizes?: string[]
          created_at?: string
          description?: string | null
          headcount_max?: number | null
          headcount_min?: number | null
          id?: string
          is_active?: boolean
          keywords?: string[]
          name: string
          regions?: string[]
          revenue_band?: string | null
          segments?: string[]
          states?: string[]
          updated_at?: string
        }
        Update: {
          cities?: string[]
          company_id?: string
          company_sizes?: string[]
          created_at?: string
          description?: string | null
          headcount_max?: number | null
          headcount_min?: number | null
          id?: string
          is_active?: boolean
          keywords?: string[]
          name?: string
          regions?: string[]
          revenue_band?: string | null
          segments?: string[]
          states?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "icp_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "icp_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["company_id"]
          },
        ]
      }
      integrations: {
        Row: {
          company_id: string
          config: Json
          connected_at: string | null
          connected_by: string | null
          created_at: string
          id: string
          is_connected: boolean
          provider: string
          updated_at: string
          vault_secret_name: string | null
        }
        Insert: {
          company_id: string
          config?: Json
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string
          id?: string
          is_connected?: boolean
          provider: string
          updated_at?: string
          vault_secret_name?: string | null
        }
        Update: {
          company_id?: string
          config?: Json
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string
          id?: string
          is_connected?: boolean
          provider?: string
          updated_at?: string
          vault_secret_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["company_id"]
          },
        ]
      }
      lead_contacts: {
        Row: {
          company_id: string
          created_at: string
          email: string | null
          id: string
          is_primary: boolean
          lead_id: string
          name: string | null
          phone: string | null
          role: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          lead_id: string
          name?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          lead_id?: string
          name?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "lead_contacts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_stage_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          company_id: string
          from_stage_id: string | null
          id: string
          lead_id: string
          to_stage_id: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          company_id: string
          from_stage_id?: string | null
          id?: string
          lead_id: string
          to_stage_id?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          company_id?: string
          from_stage_id?: string | null
          id?: string
          lead_id?: string
          to_stage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_stage_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_stage_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "lead_stage_history_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_stage_history_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "lead_stage_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_stage_history_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_stage_history_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["stage_id"]
          },
        ]
      }
      lead_tags: {
        Row: {
          company_id: string
          created_at: string
          id: string
          lead_id: string
          tag: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          lead_id: string
          tag: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          lead_id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tags_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tags_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "lead_tags_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          address: string | null
          ai_summary: string | null
          city: string | null
          company_id: string
          created_at: string
          description: string | null
          discovered_at: string
          email: string | null
          facebook: string | null
          google_maps_url: string | null
          google_rating: number | null
          google_reviews_count: number | null
          id: string
          instagram: string | null
          is_archived: boolean
          latitude: number | null
          legal_name: string | null
          linkedin: string | null
          longitude: number | null
          name: string
          notes: string | null
          owner_id: string | null
          phone: string | null
          products_sold: string[]
          recommended_product_ids: string[]
          score: number | null
          score_factors: Json
          score_reason: string | null
          segment: string | null
          source: string | null
          stage_id: string | null
          state: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
          website: string | null
          whatsapp: string | null
          zipcode: string | null
        }
        Insert: {
          address?: string | null
          ai_summary?: string | null
          city?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          discovered_at?: string
          email?: string | null
          facebook?: string | null
          google_maps_url?: string | null
          google_rating?: number | null
          google_reviews_count?: number | null
          id?: string
          instagram?: string | null
          is_archived?: boolean
          latitude?: number | null
          legal_name?: string | null
          linkedin?: string | null
          longitude?: number | null
          name: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          products_sold?: string[]
          recommended_product_ids?: string[]
          score?: number | null
          score_factors?: Json
          score_reason?: string | null
          segment?: string | null
          source?: string | null
          stage_id?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
          zipcode?: string | null
        }
        Update: {
          address?: string | null
          ai_summary?: string | null
          city?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          discovered_at?: string
          email?: string | null
          facebook?: string | null
          google_maps_url?: string | null
          google_rating?: number | null
          google_reviews_count?: number | null
          id?: string
          instagram?: string | null
          is_archived?: boolean
          latitude?: number | null
          legal_name?: string | null
          linkedin?: string | null
          longitude?: number | null
          name?: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          products_sold?: string[]
          recommended_product_ids?: string[]
          score?: number | null
          score_factors?: Json
          score_reason?: string | null
          segment?: string | null
          source?: string | null
          stage_id?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
          zipcode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "leads_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_summary"
            referencedColumns: ["stage_id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          channel: Database["public"]["Enums"]["channel_type"]
          company_id: string
          created_at: string
          created_by: string | null
          cta: string | null
          id: string
          is_ai_generated: boolean
          name: string
          preheader: string | null
          subject: string | null
          updated_at: string
        }
        Insert: {
          body: string
          channel: Database["public"]["Enums"]["channel_type"]
          company_id: string
          created_at?: string
          created_by?: string | null
          cta?: string | null
          id?: string
          is_ai_generated?: boolean
          name: string
          preheader?: string | null
          subject?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          channel?: Database["public"]["Enums"]["channel_type"]
          company_id?: string
          created_at?: string
          created_by?: string | null
          cta?: string | null
          id?: string
          is_ai_generated?: boolean
          name?: string
          preheader?: string | null
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["company_id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json
          body: string | null
          campaign_id: string | null
          channel: Database["public"]["Enums"]["channel_type"]
          company_id: string
          conversation_id: string
          created_at: string
          delivered_at: string | null
          direction: Database["public"]["Enums"]["message_direction"]
          error: string | null
          id: string
          lead_id: string
          provider_message_id: string | null
          read_at: string | null
          scheduled_for: string | null
          sent_at: string | null
          sent_by: string | null
          status: Database["public"]["Enums"]["message_status"]
          subject: string | null
        }
        Insert: {
          attachments?: Json
          body?: string | null
          campaign_id?: string | null
          channel: Database["public"]["Enums"]["channel_type"]
          company_id: string
          conversation_id: string
          created_at?: string
          delivered_at?: string | null
          direction: Database["public"]["Enums"]["message_direction"]
          error?: string | null
          id?: string
          lead_id: string
          provider_message_id?: string | null
          read_at?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          subject?: string | null
        }
        Update: {
          attachments?: Json
          body?: string | null
          campaign_id?: string | null
          channel?: Database["public"]["Enums"]["channel_type"]
          company_id?: string
          conversation_id?: string
          created_at?: string
          delivered_at?: string | null
          direction?: Database["public"]["Enums"]["message_direction"]
          error?: string | null
          id?: string
          lead_id?: string
          provider_message_id?: string | null
          read_at?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          author_id: string | null
          body: string
          company_id: string
          created_at: string
          id: string
          lead_id: string | null
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          company_id: string
          created_at?: string
          id?: string
          lead_id?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          company_id?: string
          created_at?: string
          id?: string
          lead_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          color: string | null
          company_id: string
          created_at: string
          id: string
          is_lost: boolean
          is_won: boolean
          name: string
          position: number
          slug: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          company_id: string
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name: string
          position?: number
          slug: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          company_id?: string
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name?: string
          position?: number
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["company_id"]
          },
        ]
      }
      product_categories: {
        Row: {
          company_id: string
          created_at: string
          id: string
          name: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          name: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          slug?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["company_id"]
          },
        ]
      }
      products: {
        Row: {
          applications: string[]
          catalog_pdf_url: string | null
          category_id: string | null
          cities_served: string[]
          company_id: string
          created_at: string
          description: string | null
          example_buyers: string[]
          id: string
          ideal_audience: string | null
          is_active: boolean
          keywords: string[]
          kind: string
          lead_time_days: number | null
          min_quantity: number | null
          name: string
          photo_urls: string[]
          price_avg: number | null
          price_start: number | null
          tags: string[]
          updated_at: string
          use_cases: string[]
        }
        Insert: {
          applications?: string[]
          catalog_pdf_url?: string | null
          category_id?: string | null
          cities_served?: string[]
          company_id: string
          created_at?: string
          description?: string | null
          example_buyers?: string[]
          id?: string
          ideal_audience?: string | null
          is_active?: boolean
          keywords?: string[]
          kind?: string
          lead_time_days?: number | null
          min_quantity?: number | null
          name: string
          photo_urls?: string[]
          price_avg?: number | null
          price_start?: number | null
          tags?: string[]
          updated_at?: string
          use_cases?: string[]
        }
        Update: {
          applications?: string[]
          catalog_pdf_url?: string | null
          category_id?: string | null
          cities_served?: string[]
          company_id?: string
          created_at?: string
          description?: string | null
          example_buyers?: string[]
          id?: string
          ideal_audience?: string | null
          is_active?: boolean
          keywords?: string[]
          kind?: string
          lead_time_days?: number | null
          min_quantity?: number | null
          name?: string
          photo_urls?: string[]
          price_avg?: number | null
          price_start?: number | null
          tags?: string[]
          updated_at?: string
          use_cases?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["company_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          locale: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          locale?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          locale?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          company_id: string
          created_at: string
          current_period_end: string | null
          id: string
          limits: Json
          plan: Database["public"]["Enums"]["plan_tier"]
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          current_period_end?: string | null
          id?: string
          limits?: Json
          plan?: Database["public"]["Enums"]["plan_tier"]
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          current_period_end?: string | null
          id?: string
          limits?: Json
          plan?: Database["public"]["Enums"]["plan_tier"]
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["company_id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          checklist: Json
          company_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string | null
          google_event_id: string | null
          id: string
          lead_id: string | null
          priority: string
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          checklist?: Json
          company_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          google_event_id?: string | null
          id?: string
          lead_id?: string | null
          priority?: string
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          checklist?: Json
          company_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          google_event_id?: string | null
          id?: string
          lead_id?: string | null
          priority?: string
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      dashboard_metrics: {
        Row: {
          company_id: string | null
          emails_sent: number | null
          interested_total: number | null
          leads_qualified: number | null
          leads_total: number | null
          quotes_total: number | null
          replies_total: number | null
          revenue_estimate: number | null
          whatsapp_sent: number | null
          won_total: number | null
        }
        Insert: {
          company_id?: string | null
          emails_sent?: never
          interested_total?: never
          leads_qualified?: never
          leads_total?: never
          quotes_total?: never
          replies_total?: never
          revenue_estimate?: never
          whatsapp_sent?: never
          won_total?: never
        }
        Update: {
          company_id?: string | null
          emails_sent?: never
          interested_total?: never
          leads_qualified?: never
          leads_total?: never
          quotes_total?: never
          replies_total?: never
          revenue_estimate?: never
          whatsapp_sent?: never
          won_total?: never
        }
        Relationships: []
      }
      leads_by_city: {
        Row: {
          avg_score: number | null
          city: string | null
          company_id: string | null
          state: string | null
          total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["company_id"]
          },
        ]
      }
      pipeline_summary: {
        Row: {
          company_id: string | null
          lead_count: number | null
          position: number | null
          stage_id: string | null
          stage_name: string | null
          stage_slug: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["company_id"]
          },
        ]
      }
    }
    Functions: {
      apply_tenant_rls: { Args: { p_table: unknown }; Returns: undefined }
      auth_can_write: { Args: { target_company: string }; Returns: boolean }
      auth_company_ids: { Args: never; Returns: string[] }
      auth_is_admin: { Args: { target_company: string }; Returns: boolean }
      auth_role: {
        Args: { target_company: string }
        Returns: Database["public"]["Enums"]["member_role"]
      }
      create_company: {
        Args: {
          p_city?: string
          p_name: string
          p_segment?: string
          p_state?: string
        }
        Returns: string
      }
      seed_lumilife: { Args: never; Returns: string }
    }
    Enums: {
      ai_agent_kind:
        | "hunter"
        | "qualifier"
        | "copywriter"
        | "sales_coach"
        | "analyst"
      automation_trigger:
        | "lead_created"
        | "lead_replied"
        | "lead_no_reply"
        | "lead_won"
        | "lead_lost"
        | "stage_changed"
        | "task_due"
      campaign_status: "draft" | "active" | "paused" | "completed" | "archived"
      channel_type: "whatsapp" | "email" | "instagram" | "call" | "manual"
      conversation_status: "open" | "pending" | "closed"
      lead_status:
        | "new"
        | "qualified"
        | "contacted"
        | "replied"
        | "interested"
        | "quoted"
        | "negotiation"
        | "won"
        | "lost"
      member_role:
        | "owner"
        | "admin"
        | "sales"
        | "marketing"
        | "finance"
        | "viewer"
      message_direction: "inbound" | "outbound"
      message_status:
        | "queued"
        | "sent"
        | "delivered"
        | "read"
        | "failed"
        | "bounced"
        | "received"
      plan_tier: "free" | "starter" | "pro" | "business"
      task_status: "open" | "doing" | "done" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      ai_agent_kind: [
        "hunter",
        "qualifier",
        "copywriter",
        "sales_coach",
        "analyst",
      ],
      automation_trigger: [
        "lead_created",
        "lead_replied",
        "lead_no_reply",
        "lead_won",
        "lead_lost",
        "stage_changed",
        "task_due",
      ],
      campaign_status: ["draft", "active", "paused", "completed", "archived"],
      channel_type: ["whatsapp", "email", "instagram", "call", "manual"],
      conversation_status: ["open", "pending", "closed"],
      lead_status: [
        "new",
        "qualified",
        "contacted",
        "replied",
        "interested",
        "quoted",
        "negotiation",
        "won",
        "lost",
      ],
      member_role: [
        "owner",
        "admin",
        "sales",
        "marketing",
        "finance",
        "viewer",
      ],
      message_direction: ["inbound", "outbound"],
      message_status: [
        "queued",
        "sent",
        "delivered",
        "read",
        "failed",
        "bounced",
        "received",
      ],
      plan_tier: ["free", "starter", "pro", "business"],
      task_status: ["open", "doing", "done", "cancelled"],
    },
  },
} as const
