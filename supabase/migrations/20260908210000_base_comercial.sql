-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Base Comercial — fontes de catálogo, variações e busca comercial
--
-- Objetivo: transformar Produtos & Serviços numa base consultável pelos
-- agentes de IA, com três fontes possíveis (manual, PDF, catálogo externo).
--
-- Regras:
--  • NÃO destrói nada. Só adiciona colunas e tabelas.
--  • `products` continua a fonte de verdade de cada produto; as novas tabelas
--    penduram variações, atributos e proveniência.
--  • Toda tabela nova é company-scoped e usa `apply_tenant_rls`.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Extensões de busca textual (schema dedicado, não em public) ────────────
create schema if not exists extensions;
create extension if not exists pg_trgm  with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Normaliza texto para busca: minúsculo + sem acento.
-- STABLE (unaccent é stable). Usado pela RPC e pelo trigger de search_text —
-- NÃO em coluna gerada (Postgres exige imutabilidade lá).
create or replace function public.search_normalize(text)
returns text
language sql
stable
parallel safe
set search_path = public, extensions
as $$ select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce($1, ''))) $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Proveniência em `products`
-- ═══════════════════════════════════════════════════════════════════════════
do $$ begin
  create type public.catalog_source_kind as enum ('manual', 'pdf', 'precy_online');
exception when duplicate_object then null;
end $$;

alter table public.products
  add column if not exists source          public.catalog_source_kind not null default 'manual',
  add column if not exists external_source text,          -- ex.: 'precy'
  add column if not exists external_id     text,          -- id estável na fonte externa
  add column if not exists external_url    text,          -- link do produto na fonte
  add column if not exists last_synced_at  timestamptz,
  add column if not exists needs_review    boolean not null default false;

-- Casamento idempotente de produtos externos (por empresa + fonte + id externo).
create unique index if not exists products_external_uident
  on public.products (company_id, external_source, external_id)
  where external_source is not null and external_id is not null;

-- Busca textual sobre o produto (nome + descrição + palavras-chave + aplicações).
-- Coluna simples mantida por trigger (coluna gerada exigiria função imutável).
alter table public.products
  add column if not exists search_text text;

create or replace function public.products_search_text_sync()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  new.search_text := public.search_normalize(
    coalesce(new.name, '') || ' ' ||
    coalesce(new.description, '') || ' ' ||
    array_to_string(coalesce(new.keywords, '{}'::text[]), ' ') || ' ' ||
    array_to_string(coalesce(new.applications, '{}'::text[]), ' ') || ' ' ||
    array_to_string(coalesce(new.tags, '{}'::text[]), ' ')
  );
  return new;
end;
$$;

drop trigger if exists products_search_text_sync on public.products;
create trigger products_search_text_sync
  before insert or update of name, description, keywords, applications, tags
  on public.products
  for each row execute function public.products_search_text_sync();

-- backfill dos produtos já existentes
update public.products set search_text = public.search_normalize(
  coalesce(name, '') || ' ' ||
  coalesce(description, '') || ' ' ||
  array_to_string(coalesce(keywords, '{}'::text[]), ' ') || ' ' ||
  array_to_string(coalesce(applications, '{}'::text[]), ' ') || ' ' ||
  array_to_string(coalesce(tags, '{}'::text[]), ' ')
);

create index if not exists products_search_trgm
  on public.products using gin (search_text extensions.gin_trgm_ops);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Fontes de catálogo (uma linha por fonte, por empresa)
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.catalog_sources (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  kind          public.catalog_source_kind not null,
  status        text not null default 'disconnected',   -- disconnected|connected|error|processing
  -- PDF
  file_path     text,                                   -- storage: catalogs/<company_id>/...
  file_name     text,
  -- Catálogo externo
  external_url  text,
  -- metadados de sincronização
  products_count    integer not null default 0,
  last_sync_at      timestamptz,
  last_sync_summary jsonb,                               -- {added, updated, removed, price_changed, errors}
  error_message     text,
  -- credenciais (referência ao Vault, NUNCA o segredo em texto puro)
  config        jsonb not null default '{}'::jsonb,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (company_id, kind)
);
create index if not exists catalog_sources_company_idx on public.catalog_sources (company_id);
create trigger catalog_sources_updated_at before update on public.catalog_sources
  for each row execute function public.set_updated_at();
select public.apply_tenant_rls('public.catalog_sources');

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Variações: grupos → opções → variantes
--    Modelo flexível (grupos são livres: "Papel", "Sabor", "Fragrância"…),
--    então serve gráfica, confeitaria, velas, artesanato etc.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.product_variation_groups (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete cascade,
  name        text not null,                            -- "Papel", "Tamanho", "Sabor"
  sort_order  integer not null default 0,
  external_id text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists pvg_product_idx on public.product_variation_groups (product_id);
create trigger pvg_updated_at before update on public.product_variation_groups
  for each row execute function public.set_updated_at();
select public.apply_tenant_rls('public.product_variation_groups');

create table if not exists public.product_variation_options (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  group_id    uuid not null references public.product_variation_groups (id) on delete cascade,
  value       text not null,                            -- "Couché 250g", "Chocolate"
  sort_order  integer not null default 0,
  external_id text,
  created_at  timestamptz not null default now()
);
create index if not exists pvo_group_idx on public.product_variation_options (group_id);
select public.apply_tenant_rls('public.product_variation_options');

create table if not exists public.product_variants (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id) on delete cascade,
  product_id     uuid not null references public.products (id) on delete cascade,
  sku            text,
  -- combinação de opções que define esta variante (array de option ids)
  option_ids     uuid[] not null default '{}',
  -- atributos livres extraídos/estruturados (material, gramatura, medida…)
  attributes     jsonb not null default '{}'::jsonb,
  -- preço
  price_kind     text not null default 'fixed',         -- fixed|per_unit|per_quantity|quote
  price          numeric(12,2),                         -- valor único (fixed/per_unit)
  price_tiers    jsonb,                                 -- [{min_qty, price}] para per_quantity
  currency       text not null default 'BRL',
  min_quantity   integer,
  lead_time_days integer,
  stock_quantity integer,
  notes          text,
  is_active      boolean not null default true,
  needs_review   boolean not null default false,
  source         public.catalog_source_kind not null default 'manual',
  external_id    text,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists pv_product_idx on public.product_variants (product_id);
create index if not exists pv_active_idx on public.product_variants (company_id, is_active);
create trigger pv_updated_at before update on public.product_variants
  for each row execute function public.set_updated_at();
select public.apply_tenant_rls('public.product_variants');

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Jobs de importação de PDF (histórico + prévia para revisão)
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.catalog_import_jobs (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies (id) on delete cascade,
  source_id        uuid references public.catalog_sources (id) on delete set null,
  file_path        text not null,
  file_name        text,
  status           text not null default 'pending',     -- pending|processing|review|applied|error|canceled
  extracted_count  integer not null default 0,
  review_count     integer not null default 0,
  applied_count    integer not null default 0,
  -- itens extraídos, antes de virarem products/variants definitivos
  extracted_items  jsonb not null default '[]'::jsonb,
  error_message    text,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists cij_company_idx on public.catalog_import_jobs (company_id, status);
create trigger cij_updated_at before update on public.catalog_import_jobs
  for each row execute function public.set_updated_at();
select public.apply_tenant_rls('public.catalog_import_jobs');

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Observabilidade — eventos da base comercial (sem dados sensíveis)
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.catalog_events (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  kind        text not null,   -- pdf_uploaded|pdf_processed|sync_started|sync_done|sync_error|search|...
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists catalog_events_company_idx on public.catalog_events (company_id, created_at desc);
select public.apply_tenant_rls('public.catalog_events');

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Busca comercial unificada (produto + variação), tolerante a acento/typo
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.search_commercial_catalog(
  p_company_id uuid,
  p_query      text,
  p_limit      integer default 12
)
returns table (
  product_id   uuid,
  name         text,
  description  text,
  source       public.catalog_source_kind,
  is_active    boolean,
  rank         real
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with q as (
    select
      public.search_normalize(p_query) as norm,
      array(
        select w from unnest(
          string_to_array(public.search_normalize(p_query), ' ')
        ) as w
        where length(w) >= 3
      ) as words
  )
  select
    p.id, p.name, p.description, p.source, p.is_active,
    (
      -- nº de palavras da consulta presentes no texto do produto
      (select count(*) from unnest(q.words) w where p.search_text like '%' || w || '%')::real
      -- + bônus de similaridade trigram (0..1)
      + coalesce(extensions.similarity(p.search_text, q.norm), 0)
    ) as rank
  from public.products p, q
  where p.company_id = p_company_id
    and (
      q.words = array[]::text[]
      or exists (
        select 1 from unnest(q.words) w where p.search_text like '%' || w || '%'
      )
      or p.search_text like '%' || q.norm || '%'
    )
  order by rank desc, p.is_active desc, p.name
  limit greatest(1, least(coalesce(p_limit, 12), 50));
$$;

revoke execute on function public.search_commercial_catalog(uuid, text, integer) from anon;

comment on function public.search_commercial_catalog is
  'Busca textual por palavras (sem acento) + bônus trigram no catálogo de uma empresa. security invoker → RLS de products se aplica.';
