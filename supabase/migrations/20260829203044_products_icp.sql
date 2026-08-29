-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 003: catálogo (categorias, produtos) e Perfil de Cliente Ideal (ICP)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Categorias de produto ──────────────────────────────────────────────────
create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  slug text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);
create trigger product_categories_updated_at before update on public.product_categories
  for each row execute function public.set_updated_at();
select public.apply_tenant_rls('public.product_categories');

-- ── Produtos / serviços ────────────────────────────────────────────────────
create table public.products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  category_id uuid references public.product_categories (id) on delete set null,
  name text not null,
  kind text not null default 'product',            -- product | service
  description text,
  price_start numeric(12,2),
  price_avg numeric(12,2),
  min_quantity integer,
  lead_time_days integer,
  cities_served text[] default '{}',
  keywords text[] default '{}',
  applications text[] default '{}',
  ideal_audience text,
  use_cases text[] default '{}',
  example_buyers text[] default '{}',
  tags text[] default '{}',
  photo_urls text[] default '{}',
  catalog_pdf_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_company_idx on public.products (company_id);
create index products_active_idx on public.products (company_id, is_active);
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();
select public.apply_tenant_rls('public.products');

-- ── Perfil de Cliente Ideal (ICP) ──────────────────────────────────────────
create table public.icp_profiles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  description text,
  states text[] default '{}',
  cities text[] default '{}',
  regions text[] default '{}',
  segments text[] default '{}',
  company_sizes text[] default '{}',               -- MEI, pequena, média, grande
  headcount_min integer,
  headcount_max integer,
  revenue_band text,
  keywords text[] default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index icp_profiles_company_idx on public.icp_profiles (company_id);
create trigger icp_profiles_updated_at before update on public.icp_profiles
  for each row execute function public.set_updated_at();
select public.apply_tenant_rls('public.icp_profiles');

-- Liga ICP <-> produtos que esse perfil compraria
create table public.icp_products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  icp_id uuid not null references public.icp_profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (icp_id, product_id)
);
select public.apply_tenant_rls('public.icp_products');
