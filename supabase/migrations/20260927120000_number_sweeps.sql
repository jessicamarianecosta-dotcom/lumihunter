-- MÓDULO 2 — envio para lista sequencial de números (DDD + número inicial).
--
-- Gera candidatos sequenciais (41 991111111, 41 991111112, ...) e envia até
-- atingir uma quantidade de ENVIOS EFETIVOS (não de tentativas): número
-- inválido/sem WhatsApp não conta na meta, o worker só avança para o
-- próximo candidato. Reaproveita o mesmo serviço de envio WhatsApp
-- (src/lib/whatsapp/service.ts) e o mesmo classificador de erro
-- (classifyWhatsAppError) já usados pela fila de prospecção por campanha.

create table if not exists public.number_sweeps (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  ddd text not null,
  start_number bigint not null,
  next_number bigint not null,
  quantity_target integer not null check (quantity_target > 0),
  sent_count integer not null default 0,
  attempted_count integer not null default 0,
  invalid_count integer not null default 0,
  skipped_count integer not null default 0,
  failed_count integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'running', 'paused', 'completed')),
  message_templates jsonb not null default '[]'::jsonb,
  next_template_index integer not null default 0,
  catalog_pdf_id uuid references public.catalog_pdfs (id) on delete set null,
  interval_seconds integer not null default 30 check (interval_seconds >= 10),
  window_start time,
  window_end time,
  timezone text not null default 'America/Sao_Paulo',
  last_sent_at timestamptz,
  consecutive_errors integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.number_sweeps is
  'Módulo 2: campanha de envio para números gerados sequencialmente (DDD + número inicial), fora da base de leads.';
comment on column public.number_sweeps.quantity_target is
  'Meta de ENVIOS EFETIVOS (confirmados), não de tentativas.';
comment on column public.number_sweeps.next_number is
  'Cursor: próximo candidato a tentar = ddd + zero-pad(next_number, 9).';

create index if not exists number_sweeps_company_status_idx
  on public.number_sweeps (company_id, status);

create table if not exists public.number_sweep_attempts (
  id uuid primary key default gen_random_uuid(),
  sweep_id uuid not null references public.number_sweeps (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  candidate_number bigint not null,
  phone text not null,
  status text not null check (status in ('sent', 'invalid', 'skipped', 'failed')),
  failure_code text,
  failure_reason text,
  provider_message_id text,
  message_template_used text,
  attempted_at timestamptz not null default now(),
  unique (sweep_id, candidate_number)
);
comment on table public.number_sweep_attempts is
  'Histórico de cada candidato tentado numa sweep — evita repetir o mesmo número.';

create index if not exists number_sweep_attempts_sweep_idx
  on public.number_sweep_attempts (sweep_id, attempted_at desc);

select public.apply_tenant_rls('public.number_sweeps');
select public.apply_tenant_rls('public.number_sweep_attempts');

create trigger number_sweeps_updated_at before update on public.number_sweeps
  for each row execute function public.set_updated_at();
