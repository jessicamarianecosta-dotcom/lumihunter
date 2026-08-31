-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: rate limiting + convites de time por e-mail
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Rate limiting (janela deslizante simples, tocado só pelo service role) ──
create table public.rate_limits (
  key text primary key,
  count integer not null default 0,
  window_start timestamptz not null default now()
);
alter table public.rate_limits enable row level security;
-- sem policies: nenhum acesso via anon/authenticated; apenas service role

create or replace function public.rate_limit_hit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  insert into public.rate_limits (key, count, window_start)
  values (p_key, 1, now())
  on conflict (key) do update
    set count = case
          when rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
          then 1 else rate_limits.count + 1 end,
        window_start = case
          when rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
          then now() else rate_limits.window_start end
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

-- limpeza de linhas antigas (rodar via cron ou manualmente)
create or replace function public.rate_limits_gc()
returns void language sql security definer set search_path = public as $$
  delete from public.rate_limits where window_start < now() - interval '1 day';
$$;

-- ── Convites de time ──────────────────────────────────────────────────────
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  email citext not null,
  role member_role not null default 'sales',
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  unique (company_id, email)
);
create index invitations_email_idx on public.invitations (email) where accepted_at is null;

alter table public.invitations enable row level security;

create policy "invitations: admin lê" on public.invitations
  for select using (public.auth_is_admin(company_id));
create policy "invitations: admin cria" on public.invitations
  for insert with check (public.auth_is_admin(company_id) and role <> 'owner');
create policy "invitations: admin atualiza" on public.invitations
  for update using (public.auth_is_admin(company_id)) with check (public.auth_is_admin(company_id));
create policy "invitations: admin remove" on public.invitations
  for delete using (public.auth_is_admin(company_id));

-- Aceite do convite: valida token + e-mail do usuário logado, cria o vínculo.
create or replace function public.accept_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_inv public.invitations;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;

  select email into v_email from auth.users where id = auth.uid();

  select * into v_inv from public.invitations
  where token = p_token
    and accepted_at is null
    and expires_at > now();

  if v_inv.id is null then
    raise exception 'convite inválido ou expirado';
  end if;

  if lower(v_inv.email) <> lower(v_email) then
    raise exception 'este convite é para outro e-mail';
  end if;

  insert into public.company_members (company_id, user_id, role, invited_by)
  values (v_inv.company_id, auth.uid(), v_inv.role, v_inv.invited_by)
  on conflict (company_id, user_id) do nothing;

  update public.invitations set accepted_at = now() where id = v_inv.id;

  return v_inv.company_id;
end;
$$;
