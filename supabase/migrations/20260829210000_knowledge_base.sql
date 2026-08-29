-- Base de conhecimento da empresa (usada pelos agentes de IA)
create table public.knowledge_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  title text not null,
  category text not null default 'geral',
  content text not null,
  tags text[] not null default '{}',
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index knowledge_entries_company_idx on public.knowledge_entries (company_id, is_active);
create trigger knowledge_entries_updated_at before update on public.knowledge_entries
  for each row execute function public.set_updated_at();
select public.apply_tenant_rls('public.knowledge_entries');
