-- ═══════════════════════════════════════════════════════════════════════════
-- Fase 1 — Prospecção por campanha: campanha como instrução + staging de leads
-- Aplicada em produção via MCP (versão 20260909105824).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Campanha: instrução de prospecção (produto + público + região) ─────────
alter table public.campaigns
  add column if not exists product_text text,
  add column if not exists audience_text text,
  add column if not exists regions text[] not null default '{}',
  add column if not exists last_discovery_at timestamptz;

-- ── lead_discoveries: staging de empresas descobertas (antes de virar lead) ─
create table if not exists public.lead_discoveries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,

  -- identidade da empresa-alvo (só o que a fonte informou)
  company_name text not null,
  legal_name text,
  segment text,
  description text,
  city text,
  state text,
  country text default 'BR',
  address text,

  -- canais públicos
  phone text,
  whatsapp text,
  email citext,
  website text,
  instagram text,

  -- proveniência
  source text not null default 'tavily',
  source_url text,
  discovery_query text,
  raw jsonb not null default '{}'::jsonb,

  -- deduplicação (domínio > telefone > nome+cidade)
  dedupe_key text not null,

  -- qualificação
  score integer,
  qualification text,                       -- high | medium | low
  qualification_reason text,
  qualification_signals jsonb not null default '[]'::jsonb,
  qualified_by text,                         -- heuristic | ai
  recommended_approach text,

  -- ciclo de vida (Fase 1: discovered -> qualified -> approved | rejected)
  status text not null default 'discovered',
  lead_id uuid references public.leads (id) on delete set null,
  approved_at timestamptz,
  approved_by uuid references auth.users (id) on delete set null,
  rejected_at timestamptz,

  discovered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (campaign_id, dedupe_key)
);
create index lead_discoveries_campaign_status_idx on public.lead_discoveries (campaign_id, status);
create index lead_discoveries_company_idx on public.lead_discoveries (company_id);
create index lead_discoveries_score_idx on public.lead_discoveries (campaign_id, score desc);
create index lead_discoveries_lead_idx on public.lead_discoveries (lead_id);

create trigger lead_discoveries_updated_at before update on public.lead_discoveries
  for each row execute function public.set_updated_at();

select public.apply_tenant_rls('public.lead_discoveries');
