alter table public.leads add column if not exists cnpj text;
create index if not exists leads_cnpj_idx on public.leads (company_id, cnpj) where cnpj is not null;
