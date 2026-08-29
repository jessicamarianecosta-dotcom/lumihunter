-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 005: campanhas, templates, conversas, mensagens (WhatsApp + e-mail)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Templates de mensagem ─────────────────────────────────────────────────
create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  channel channel_type not null,
  subject text,                          -- e-mail
  preheader text,                        -- e-mail
  body text not null,                    -- pode conter {{variaveis}}
  cta text,
  is_ai_generated boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger message_templates_updated_at before update on public.message_templates
  for each row execute function public.set_updated_at();
select public.apply_tenant_rls('public.message_templates');

-- ── Campanhas ─────────────────────────────────────────────────────────────
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  goal text,
  product_id uuid references public.products (id) on delete set null,
  icp_id uuid references public.icp_profiles (id) on delete set null,
  channel channel_type not null default 'whatsapp',
  segment text,
  city text,
  target_count integer default 0,
  status campaign_status not null default 'draft',
  template_id uuid references public.message_templates (id) on delete set null,
  followup_sequence_id uuid,             -- FK adicionada na migration 006
  created_by uuid references auth.users (id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index campaigns_company_status_idx on public.campaigns (company_id, status);
create trigger campaigns_updated_at before update on public.campaigns
  for each row execute function public.set_updated_at();
select public.apply_tenant_rls('public.campaigns');

-- ── Alvos da campanha ─────────────────────────────────────────────────────
create table public.campaign_targets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  step integer not null default 0,
  status text not null default 'pending',  -- pending | sent | replied | skipped | opted_out
  next_action_at timestamptz,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, lead_id)
);
create index campaign_targets_due_idx on public.campaign_targets (next_action_at) where status = 'pending';
create trigger campaign_targets_updated_at before update on public.campaign_targets
  for each row execute function public.set_updated_at();
select public.apply_tenant_rls('public.campaign_targets');

-- ── Conversas (uma por lead+canal) ────────────────────────────────────────
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  channel channel_type not null,
  external_id text,                      -- ex: wa_id / thread id
  status conversation_status not null default 'open',
  ai_classification text,                -- interested | not_now | not_interested | question | complaint
  ai_summary text,
  last_message_at timestamptz,
  last_message_preview text,
  unread_count integer not null default 0,
  assigned_to uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id, channel)
);
create index conversations_company_idx on public.conversations (company_id, last_message_at desc);
create trigger conversations_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();
select public.apply_tenant_rls('public.conversations');

-- ── Mensagens ─────────────────────────────────────────────────────────────
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  campaign_id uuid references public.campaigns (id) on delete set null,
  channel channel_type not null,
  direction message_direction not null,
  status message_status not null default 'queued',
  subject text,
  body text,
  attachments jsonb default '[]'::jsonb,
  provider_message_id text,
  error text,
  sent_by uuid references auth.users (id) on delete set null,
  scheduled_for timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);
create index messages_queue_idx on public.messages (scheduled_for) where status = 'queued';
create index messages_provider_idx on public.messages (provider_message_id);
select public.apply_tenant_rls('public.messages');

-- Atualiza a conversa quando entra mensagem nova
create or replace function public.touch_conversation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations c set
    last_message_at = coalesce(new.sent_at, new.created_at),
    last_message_preview = left(coalesce(new.body, new.subject, ''), 160),
    unread_count = case when new.direction = 'inbound' then c.unread_count + 1 else c.unread_count end,
    updated_at = now()
  where c.id = new.conversation_id;
  return new;
end;
$$;
create trigger messages_touch_conversation after insert on public.messages
  for each row execute function public.touch_conversation();
