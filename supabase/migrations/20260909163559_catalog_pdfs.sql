-- Catálogo PDF flexível: um PDF pode servir só para ENVIO, só para IMPORTAR
-- produtos, ou os dois. Independente do módulo de produtos estruturados.
-- Aplicada em produção via MCP (versão 20260909163559).

create table public.catalog_pdfs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  file_path text not null,                 -- bucket 'catalogs', pasta <company_id>/
  file_name text not null,
  file_size bigint,
  use_for_sending boolean not null default true,
  is_default boolean not null default false,
  import_job_id uuid references public.catalog_import_jobs (id) on delete set null,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index catalog_pdfs_one_default on public.catalog_pdfs (company_id) where is_default;
create index catalog_pdfs_company_idx on public.catalog_pdfs (company_id, created_at desc);
create trigger catalog_pdfs_updated_at before update on public.catalog_pdfs
  for each row execute function public.set_updated_at();
select public.apply_tenant_rls('public.catalog_pdfs');

alter table public.campaigns
  add column if not exists outreach_catalog_pdf_id uuid references public.catalog_pdfs (id) on delete set null;
