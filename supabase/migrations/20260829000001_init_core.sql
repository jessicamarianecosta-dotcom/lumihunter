-- ═══════════════════════════════════════════════════════════════════════════
-- LumiHunter AI — Migration 001: núcleo multi-tenant, empresas, usuários, RBAC
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ── Enums ──────────────────────────────────────────────────────────────────
create type member_role as enum ('owner', 'admin', 'sales', 'marketing', 'finance', 'viewer');
create type plan_tier as enum ('free', 'starter', 'pro', 'business');
create type channel_type as enum ('whatsapp', 'email', 'instagram', 'call', 'manual');
create type lead_status as enum ('new', 'qualified', 'contacted', 'replied', 'interested', 'quoted', 'negotiation', 'won', 'lost');
create type task_status as enum ('open', 'doing', 'done', 'cancelled');
create type conversation_status as enum ('open', 'pending', 'closed');
create type message_direction as enum ('inbound', 'outbound');
create type message_status as enum ('queued', 'sent', 'delivered', 'read', 'failed', 'bounced', 'received');
create type campaign_status as enum ('draft', 'active', 'paused', 'completed', 'archived');
create type automation_trigger as enum ('lead_created', 'lead_replied', 'lead_no_reply', 'lead_won', 'lead_lost', 'stage_changed', 'task_due');
create type ai_agent_kind as enum ('hunter', 'qualifier', 'copywriter', 'sales_coach', 'analyst');

-- ── updated_at trigger helper ──────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── companies (tenant raiz) ────────────────────────────────────────────────
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  cnpj text,
  city text,
  state text,
  segment text,
  description text,
  website text,
  instagram text,
  commercial_whatsapp text,
  commercial_email citext,
  logo_url text,
  brand_color text default '#F5C518',
  plan plan_tier not null default 'free',
  onboarding_completed boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger companies_updated_at before update on public.companies
  for each row execute function public.set_updated_at();

-- ── profiles (1:1 com auth.users) ──────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  phone text,
  locale text default 'pt-BR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ── company_members (N:N usuário <-> empresa, com papel) ───────────────────
create table public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role member_role not null default 'viewer',
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);
create index company_members_user_idx on public.company_members (user_id);
create index company_members_company_idx on public.company_members (company_id);

-- ── novo usuário: cria profile automaticamente ─────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════════════════
-- HELPERS DE AUTORIZAÇÃO (usados por todas as policies RLS)
-- ═══════════════════════════════════════════════════════════════════════════

-- Empresas às quais o usuário atual pertence
create or replace function public.auth_company_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select company_id from public.company_members where user_id = auth.uid();
$$;

-- Papel do usuário atual numa empresa
create or replace function public.auth_role(target_company uuid)
returns member_role language sql stable security definer set search_path = public as $$
  select role from public.company_members
  where user_id = auth.uid() and company_id = target_company;
$$;

-- Usuário pode escrever? (tudo menos viewer)
create or replace function public.auth_can_write(target_company uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role from public.company_members
     where user_id = auth.uid() and company_id = target_company) <> 'viewer',
    false
  );
$$;

-- Usuário é owner/admin?
create or replace function public.auth_is_admin(target_company uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role from public.company_members
     where user_id = auth.uid() and company_id = target_company) in ('owner', 'admin'),
    false
  );
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS: companies / profiles / company_members
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.company_members enable row level security;

create policy "companies: membros leem" on public.companies
  for select using (id in (select public.auth_company_ids()));
create policy "companies: qualquer autenticado cria" on public.companies
  for insert with check (auth.uid() = created_by);
create policy "companies: admin atualiza" on public.companies
  for update using (public.auth_is_admin(id)) with check (public.auth_is_admin(id));
create policy "companies: owner deleta" on public.companies
  for delete using (public.auth_role(id) = 'owner');

create policy "profiles: dono lê" on public.profiles
  for select using (id = auth.uid());
create policy "profiles: colegas de empresa leem" on public.profiles
  for select using (
    exists (
      select 1 from public.company_members m1
      join public.company_members m2 on m1.company_id = m2.company_id
      where m1.user_id = auth.uid() and m2.user_id = public.profiles.id
    )
  );
create policy "profiles: dono edita" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles: dono insere" on public.profiles
  for insert with check (id = auth.uid());

create policy "members: leitura na própria empresa" on public.company_members
  for select using (company_id in (select public.auth_company_ids()));
-- primeiro membro (owner) pode ser criado pelo próprio usuário; demais só admin
create policy "members: bootstrap ou admin insere" on public.company_members
  for insert with check (
    (user_id = auth.uid() and role = 'owner'
      and not exists (select 1 from public.company_members where company_id = company_members.company_id))
    or public.auth_is_admin(company_id)
  );
create policy "members: admin atualiza" on public.company_members
  for update using (public.auth_is_admin(company_id)) with check (public.auth_is_admin(company_id));
create policy "members: admin remove" on public.company_members
  for delete using (public.auth_is_admin(company_id) and role <> 'owner');

-- ── RPC: criar empresa + vincular criador como owner (atômico) ─────────────
create or replace function public.create_company(
  p_name text,
  p_segment text default null,
  p_city text default null,
  p_state text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_company_id uuid;
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;

  insert into public.companies (name, segment, city, state, created_by)
  values (p_name, p_segment, p_city, p_state, auth.uid())
  returning id into v_company_id;

  insert into public.company_members (company_id, user_id, role)
  values (v_company_id, auth.uid(), 'owner');

  return v_company_id;
end;
$$;
