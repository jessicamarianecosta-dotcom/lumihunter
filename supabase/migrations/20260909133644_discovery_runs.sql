-- Fase 1 — cada busca de leads é uma RODADA; a tela mostra só a última.
-- Aplicada em produção via MCP (versão 20260909133644).
create table public.discovery_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  status text not null default 'running',        -- running | completed | failed
  queries_count integer not null default 0,
  raw_count integer not null default 0,
  found integer not null default 0,
  prospectable integer not null default 0,
  qualified integer not null default 0,
  competitors integer not null default 0,
  no_whatsapp integer not null default 0,
  discarded integer not null default 0,
  ai_used boolean not null default false,
  buyer_profile_source text,
  buyer_segments jsonb not null default '[]'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index discovery_runs_campaign_idx on public.discovery_runs (campaign_id, created_at desc);
create index discovery_runs_running_idx on public.discovery_runs (campaign_id) where status = 'running';
create trigger discovery_runs_updated_at before update on public.discovery_runs
  for each row execute function public.set_updated_at();
select public.apply_tenant_rls('public.discovery_runs');

-- vincula cada descoberta à sua rodada
alter table public.lead_discoveries
  add column if not exists discovery_run_id uuid references public.discovery_runs (id) on delete set null;
create index lead_discoveries_run_idx on public.lead_discoveries (discovery_run_id);

-- ponteiro da campanha para a rodada exibida
alter table public.campaigns
  add column if not exists current_discovery_run_id uuid references public.discovery_runs (id) on delete set null;

-- unicidade passa a ser por rodada (mesma empresa pode reaparecer noutra rodada)
alter table public.lead_discoveries drop constraint if exists lead_discoveries_campaign_id_dedupe_key_key;
alter table public.lead_discoveries
  add constraint lead_discoveries_run_dedupe_key unique (discovery_run_id, dedupe_key);

-- limpeza única: descobertas antigas sem rodada e nunca aprovadas (lixo de teste)
delete from public.lead_discoveries where discovery_run_id is null and status <> 'approved';
