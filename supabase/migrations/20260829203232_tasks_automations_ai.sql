-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 006: tarefas, notas, follow-ups, automações, agentes de IA, integrações
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Tarefas ───────────────────────────────────────────────────────────────
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete cascade,
  title text not null,
  description text,
  status task_status not null default 'open',
  priority text not null default 'normal',   -- low | normal | high
  due_at timestamptz,
  assignee_id uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  completed_at timestamptz,
  checklist jsonb default '[]'::jsonb,
  google_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_company_status_idx on public.tasks (company_id, status);
create index tasks_assignee_due_idx on public.tasks (assignee_id, due_at);
create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();
select public.apply_tenant_rls('public.tasks');

-- ── Notas internas ────────────────────────────────────────────────────────
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notes_lead_idx on public.notes (lead_id, created_at desc);
create trigger notes_updated_at before update on public.notes
  for each row execute function public.set_updated_at();
select public.apply_tenant_rls('public.notes');

-- ── Sequências de follow-up ───────────────────────────────────────────────
create table public.followup_sequences (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  channel channel_type not null default 'whatsapp',
  -- steps: [{ "day": 1, "template_id": "...", "prompt": "..." }, ...]
  steps jsonb not null default '[]'::jsonb,
  stop_on_reply boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger followup_sequences_updated_at before update on public.followup_sequences
  for each row execute function public.set_updated_at();
select public.apply_tenant_rls('public.followup_sequences');

alter table public.campaigns
  add constraint campaigns_followup_fk
  foreign key (followup_sequence_id) references public.followup_sequences (id) on delete set null;

-- ── Automações (motor de regras) ─────────────────────────────────────────
create table public.automations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  trigger automation_trigger not null,
  -- conditions: [{ "field": "...", "op": "eq", "value": ... }]
  conditions jsonb not null default '[]'::jsonb,
  -- actions: [{ "type": "create_task" | "move_stage" | "start_followup" | "notify" | "add_tag", "params": {} }]
  actions jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger automations_updated_at before update on public.automations
  for each row execute function public.set_updated_at();
select public.apply_tenant_rls('public.automations');

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  automation_id uuid not null references public.automations (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  status text not null default 'success',   -- success | error | skipped
  detail jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index automation_runs_idx on public.automation_runs (automation_id, created_at desc);
select public.apply_tenant_rls('public.automation_runs');

-- ── Agentes de IA (config por empresa) ──────────────────────────────────
create table public.ai_agents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  kind ai_agent_kind not null,
  name text not null,
  model text not null default 'claude-sonnet-5',
  system_prompt text,
  temperature numeric(3,2) not null default 0.7,
  is_active boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, kind)
);
create trigger ai_agents_updated_at before update on public.ai_agents
  for each row execute function public.set_updated_at();
select public.apply_tenant_rls('public.ai_agents');

-- seed dos 5 agentes quando a empresa é criada
create or replace function public.seed_ai_agents()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.ai_agents (company_id, kind, name) values
    (new.id, 'hunter',      'Hunter — Prospecção'),
    (new.id, 'qualifier',   'Qualifier — Lead Score'),
    (new.id, 'copywriter',  'Copywriter — Mensagens'),
    (new.id, 'sales_coach', 'Sales Coach — Respostas'),
    (new.id, 'analyst',     'Analyst — Insights');
  return new;
end;
$$;
create trigger companies_seed_agents after insert on public.companies
  for each row execute function public.seed_ai_agents();

-- ── Logs / custo de execuções de IA ─────────────────────────────────────
create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  agent_kind ai_agent_kind not null,
  model text not null,
  lead_id uuid references public.leads (id) on delete set null,
  campaign_id uuid references public.campaigns (id) on delete set null,
  input jsonb,
  output jsonb,
  input_tokens integer default 0,
  output_tokens integer default 0,
  cost_usd numeric(10,6) default 0,
  duration_ms integer,
  status text not null default 'success',
  error text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index ai_runs_company_idx on public.ai_runs (company_id, created_at desc);
select public.apply_tenant_rls('public.ai_runs');

-- ── Integrações (credenciais por empresa) ───────────────────────────────
-- Guarde tokens sensíveis via Supabase Vault em produção; aqui referenciamos por nome.
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  provider text not null,               -- whatsapp | resend | google | stripe
  is_connected boolean not null default false,
  config jsonb not null default '{}'::jsonb,   -- ids não-secretos (phone_number_id, from_email...)
  vault_secret_name text,               -- nome do segredo no Vault
  connected_by uuid references auth.users (id) on delete set null,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, provider)
);
create trigger integrations_updated_at before update on public.integrations
  for each row execute function public.set_updated_at();
alter table public.integrations enable row level security;
create policy "integrations: membros leem" on public.integrations
  for select using (company_id in (select public.auth_company_ids()));
create policy "integrations: admin gerencia" on public.integrations
  for all using (public.auth_is_admin(company_id)) with check (public.auth_is_admin(company_id));

-- ── Blacklist / opt-out (LGPD) ─────────────────────────────────────────
create table public.blacklist (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  channel channel_type not null,
  value text not null,                  -- telefone ou e-mail normalizado
  reason text,
  created_at timestamptz not null default now(),
  unique (company_id, channel, value)
);
select public.apply_tenant_rls('public.blacklist');

-- ── Consentimentos (LGPD) ─────────────────────────────────────────────
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete cascade,
  channel channel_type,
  kind text not null,                   -- opt_in | opt_out | data_request | data_deletion
  source text,
  detail jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
select public.apply_tenant_rls('public.consents');

-- ── Assinatura / plano (preparado p/ Stripe, sem cobrança) ─────────────
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade unique,
  plan plan_tier not null default 'free',
  status text not null default 'active',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  -- limites do plano (usados pela app)
  limits jsonb not null default '{"leads": 100, "ai_runs_month": 200, "messages_month": 200, "seats": 2}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();
alter table public.subscriptions enable row level security;
create policy "subs: membros leem" on public.subscriptions
  for select using (company_id in (select public.auth_company_ids()));
create policy "subs: admin gerencia" on public.subscriptions
  for all using (public.auth_is_admin(company_id)) with check (public.auth_is_admin(company_id));

create or replace function public.seed_subscription()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.subscriptions (company_id, plan) values (new.id, 'free')
  on conflict (company_id) do nothing;
  return new;
end;
$$;
create trigger companies_seed_subscription after insert on public.companies
  for each row execute function public.seed_subscription();
