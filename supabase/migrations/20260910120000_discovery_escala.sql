-- FASE A — DESCOBERTA EM ESCALA.
--
-- Antes: cada clique fazia UMA rodada síncrona (~16 queries) e parava. Se a
-- região tinha centenas de compradores, o LumiHunter achava 7 e encerrava.
--
-- Agora: a rodada é um PROCESSO. A primeira leva (batch) roda na hora (o usuário
-- vê resultado imediato + envio automático já dispara). O resto das consultas
-- fica em `pending_queries` e um cron drena batch a batch até:
--   • atingir `target_opportunities` (campanha.max_opportunities), ou
--   • esgotar as consultas úteis, ou
--   • a campanha sair de "ativa".
--
-- `discovery_log` grava o funil consulta a consulta — é onde se descobre
-- EXATAMENTE onde os candidatos se perdem.

-- ── Teto de oportunidades por campanha (critério de parada real) ──────────
alter table public.campaigns
  add column if not exists max_opportunities integer not null default 250;
comment on column public.campaigns.max_opportunities is
  'FASE A: descoberta em escala para de procurar ao atingir este nº de leads válidos.';

-- ── Estado do processo de descoberta na rodada ──────────────────────────
alter table public.discovery_runs
  add column if not exists mode text not null default 'single',            -- single | scale
  add column if not exists scale_status text,                              -- null | active | exhausted | stopped
  add column if not exists batch_count integer not null default 0,
  add column if not exists candidates_count integer not null default 0,    -- leads válidos acumulados na rodada
  add column if not exists target_opportunities integer,
  add column if not exists pending_queries jsonb not null default '[]'::jsonb,
  add column if not exists used_queries jsonb not null default '[]'::jsonb,
  add column if not exists regions_expanded jsonb not null default '[]'::jsonb,
  add column if not exists last_batch_at timestamptz;

comment on column public.discovery_runs.mode is 'single = rodada única (legado). scale = processo em batches.';
comment on column public.discovery_runs.scale_status is 'active = o cron ainda tem consultas a fazer. exhausted/stopped = terminou.';

create index if not exists discovery_runs_scale_active_idx
  on public.discovery_runs (campaign_id)
  where scale_status = 'active';

-- ── Funil consulta a consulta ──────────────────────────────────────────
create table if not exists public.discovery_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  discovery_run_id uuid references public.discovery_runs (id) on delete cascade,
  batch integer not null default 0,
  query text not null,
  source text not null default 'tavily',
  results_returned integer not null default 0,
  new_candidates integer not null default 0,
  duplicates integer not null default 0,
  rejected integer not null default 0,
  reject_breakdown jsonb not null default '{}'::jsonb,
  qualified integer not null default 0,
  whatsapp_found integer not null default 0,
  whatsapp_confirmed integer not null default 0,
  ready_to_send integer not null default 0,
  sent integer not null default 0,
  failed integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists discovery_log_run_idx on public.discovery_log (discovery_run_id, batch);
create index if not exists discovery_log_campaign_idx on public.discovery_log (campaign_id, created_at desc);
select public.apply_tenant_rls('public.discovery_log');

-- ── Agendamento do cron de descoberta (pg_cron + pg_net) ────────────────
-- Contorna o limite do Vercel Hobby (1 cron/dia). O segredo vem do Vault:
--   select vault.create_secret('SEU_CRON_SECRET', 'lumihunter_cron_secret');
-- Se pg_cron/pg_net/vault não estiverem disponíveis, este bloco é ignorado
-- e a descoberta contínua cai no cron diário /api/cron/followups.
do $$
declare
  v_secret text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron ausente — descoberta contínua só via cron diário';
    return;
  end if;
  begin
    select decrypted_secret into v_secret
      from vault.decrypted_secrets where name = 'lumihunter_cron_secret' limit 1;
  exception when others then
    v_secret := null;
  end;
  if v_secret is null then
    raise notice 'Vault sem lumihunter_cron_secret — agende o cron manualmente após criar o segredo';
    return;
  end if;

  perform cron.unschedule('lumihunter-discovery')
    where exists (select 1 from cron.job where jobname = 'lumihunter-discovery');

  perform cron.schedule(
    'lumihunter-discovery',
    '*/3 * * * *',
    format(
      $job$select net.http_get(
        url := 'https://lumihunter.vercel.app/api/cron/discovery',
        headers := jsonb_build_object('Authorization', 'Bearer %s')
      );$job$, v_secret)
  );
end $$;
