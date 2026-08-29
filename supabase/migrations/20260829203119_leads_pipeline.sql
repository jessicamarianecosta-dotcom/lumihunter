-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 004: leads, contatos, pipeline (kanban), score de IA, timeline
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Estágios do pipeline (customizável por empresa) ────────────────────────
create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  slug text not null,
  position integer not null default 0,
  is_won boolean not null default false,
  is_lost boolean not null default false,
  color text default '#94a3b8',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, slug)
);
create trigger pipeline_stages_updated_at before update on public.pipeline_stages
  for each row execute function public.set_updated_at();
select public.apply_tenant_rls('public.pipeline_stages');

-- Cria os estágios default quando a empresa é criada
create or replace function public.seed_pipeline_stages()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.pipeline_stages (company_id, name, slug, position, is_won, is_lost, color) values
    (new.id, 'Novo Lead',        'new',         0, false, false, '#64748b'),
    (new.id, 'Qualificado',      'qualified',   1, false, false, '#0ea5e9'),
    (new.id, 'Contato iniciado', 'contacted',   2, false, false, '#6366f1'),
    (new.id, 'Respondeu',        'replied',     3, false, false, '#8b5cf6'),
    (new.id, 'Interessado',      'interested',  4, false, false, '#a855f7'),
    (new.id, 'Orçamento enviado','quoted',      5, false, false, '#eab308'),
    (new.id, 'Negociação',       'negotiation', 6, false, false, '#f59e0b'),
    (new.id, 'Cliente',          'won',         7, true,  false, '#22c55e'),
    (new.id, 'Perdido',          'lost',        8, false, true,  '#ef4444');
  return new;
end;
$$;
create trigger companies_seed_stages after insert on public.companies
  for each row execute function public.seed_pipeline_stages();

-- ── Leads (empresas encontradas) ──────────────────────────────────────────
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  stage_id uuid references public.pipeline_stages (id) on delete set null,
  owner_id uuid references auth.users (id) on delete set null,
  status lead_status not null default 'new',

  -- identidade da empresa-alvo
  name text not null,
  legal_name text,
  segment text,
  description text,
  city text,
  state text,
  address text,
  zipcode text,
  latitude double precision,
  longitude double precision,
  google_maps_url text,
  google_rating numeric(2,1),
  google_reviews_count integer,

  -- canais públicos
  phone text,
  whatsapp text,
  email citext,
  website text,
  instagram text,
  facebook text,
  linkedin text,

  -- inteligência
  products_sold text[] default '{}',
  notes text,
  source text default 'hunter',          -- hunter | manual | import | campaign
  discovered_at timestamptz not null default now(),

  -- score de IA (0-100)
  score integer,
  score_reason text,
  score_factors jsonb default '[]'::jsonb,
  ai_summary text,
  recommended_product_ids uuid[] default '{}',

  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_company_stage_idx on public.leads (company_id, stage_id);
create index leads_company_status_idx on public.leads (company_id, status);
create index leads_owner_idx on public.leads (owner_id);
create index leads_score_idx on public.leads (company_id, score desc);
create unique index leads_dedup_idx on public.leads (company_id, lower(coalesce(website, '')), lower(name))
  where website is not null;
create trigger leads_updated_at before update on public.leads
  for each row execute function public.set_updated_at();
select public.apply_tenant_rls('public.leads');

-- ── Contatos do lead (pessoas) ────────────────────────────────────────────
create table public.lead_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  name text,
  role text,
  phone text,
  whatsapp text,
  email citext,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lead_contacts_lead_idx on public.lead_contacts (lead_id);
create trigger lead_contacts_updated_at before update on public.lead_contacts
  for each row execute function public.set_updated_at();
select public.apply_tenant_rls('public.lead_contacts');

-- ── Tags de lead ──────────────────────────────────────────────────────────
create table public.lead_tags (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  tag text not null,
  created_at timestamptz not null default now(),
  unique (lead_id, tag)
);
select public.apply_tenant_rls('public.lead_tags');

-- ── Histórico de mudança de estágio ───────────────────────────────────────
create table public.lead_stage_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  from_stage_id uuid references public.pipeline_stages (id) on delete set null,
  to_stage_id uuid references public.pipeline_stages (id) on delete set null,
  changed_by uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now()
);
create index lead_stage_history_lead_idx on public.lead_stage_history (lead_id);
select public.apply_tenant_rls('public.lead_stage_history');

-- registra automaticamente troca de estágio
create or replace function public.log_lead_stage_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.stage_id is distinct from old.stage_id then
    insert into public.lead_stage_history (company_id, lead_id, from_stage_id, to_stage_id, changed_by)
    values (new.company_id, new.id, old.stage_id, new.stage_id, auth.uid());
  end if;
  return new;
end;
$$;
create trigger leads_log_stage after update on public.leads
  for each row execute function public.log_lead_stage_change();

-- ── Timeline unificada (atividades / auditoria leve) ──────────────────────
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  kind text not null,                    -- note | email | whatsapp | call | task | stage | ai | system
  title text,
  body text,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activities_lead_idx on public.activities (lead_id, created_at desc);
create index activities_company_idx on public.activities (company_id, created_at desc);
select public.apply_tenant_rls('public.activities');
