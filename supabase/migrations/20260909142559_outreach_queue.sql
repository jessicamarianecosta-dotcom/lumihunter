-- Fase 2 — fila de prospecção por WhatsApp (preparação + envio controlado)
-- Aplicada em produção via MCP (versão 20260909142559).

-- ── Configuração de abordagem por campanha ────────────────────────────────
alter table public.campaigns
  add column if not exists outreach_status text not null default 'idle',       -- idle | running | paused
  add column if not exists outreach_daily_limit integer not null default 20,
  add column if not exists outreach_window_start text not null default '09:00',
  add column if not exists outreach_window_end text not null default '18:00',
  add column if not exists outreach_min_interval_seconds integer not null default 30,
  add column if not exists outreach_timezone text not null default 'America/Sao_Paulo',
  add column if not exists outreach_base_message text,
  add column if not exists outreach_personalize_ai boolean not null default true,
  add column if not exists outreach_send_catalog boolean not null default true,
  add column if not exists outreach_catalog_product_id uuid references public.products (id) on delete set null,
  add column if not exists outreach_consecutive_errors integer not null default 0,
  add column if not exists outreach_last_sent_at timestamptz,
  add column if not exists outreach_started_at timestamptz;

-- ── Fila de envio ────────────────────────────────────────────────────────
create table public.outreach_queue (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  campaign_target_id uuid not null references public.campaign_targets (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,

  -- draft -> ready -> scheduled -> sending -> sent -> delivered -> read
  --                                         \-> failed / opted_out / skipped / cancelled / replied
  status text not null default 'draft',
  message_body text,
  personalized_by text,                    -- ai | base | manual
  catalog_included boolean not null default false,

  scheduled_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  replied_at timestamptz,
  failed_at timestamptz,
  failure_code text,
  failure_reason text,
  attempt_count integer not null default 0,
  last_attempt_at timestamptz,

  provider_message_id text,
  catalog_message_id text,

  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (campaign_target_id)
);
create index outreach_queue_campaign_status_idx on public.outreach_queue (campaign_id, status);
create index outreach_queue_company_idx on public.outreach_queue (company_id);
create index outreach_queue_lead_idx on public.outreach_queue (lead_id);
create index outreach_queue_provider_msg_idx on public.outreach_queue (provider_message_id);
create index outreach_queue_due_idx on public.outreach_queue (scheduled_at)
  where status in ('ready', 'scheduled');

create trigger outreach_queue_updated_at before update on public.outreach_queue
  for each row execute function public.set_updated_at();
select public.apply_tenant_rls('public.outreach_queue');
