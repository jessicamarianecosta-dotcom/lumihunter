-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 007: views de dashboard, storage buckets, realtime
-- ═══════════════════════════════════════════════════════════════════════════

-- ── View: métricas do dashboard por empresa ──────────────────────────────
create or replace view public.dashboard_metrics
with (security_invoker = true) as
select
  c.id as company_id,
  (select count(*) from public.leads l where l.company_id = c.id and not l.is_archived) as leads_total,
  (select count(*) from public.leads l where l.company_id = c.id and l.status <> 'new' and not l.is_archived) as leads_qualified,
  (select count(*) from public.messages m where m.company_id = c.id and m.channel = 'whatsapp' and m.direction = 'outbound') as whatsapp_sent,
  (select count(*) from public.messages m where m.company_id = c.id and m.channel = 'email' and m.direction = 'outbound') as emails_sent,
  (select count(*) from public.messages m where m.company_id = c.id and m.direction = 'inbound') as replies_total,
  (select count(*) from public.leads l where l.company_id = c.id and l.status = 'interested') as interested_total,
  (select count(*) from public.leads l where l.company_id = c.id and l.status = 'quoted') as quotes_total,
  (select count(*) from public.leads l where l.company_id = c.id and l.status = 'won') as won_total,
  (select coalesce(sum(p.price_avg), 0)
     from public.leads l
     left join lateral unnest(l.recommended_product_ids) rp(pid) on true
     left join public.products p on p.id = rp.pid
     where l.company_id = c.id and l.status = 'won') as revenue_estimate
from public.companies c;

-- ── View: contagem de leads por estágio (kanban) ─────────────────────────
create or replace view public.pipeline_summary
with (security_invoker = true) as
select
  s.company_id,
  s.id as stage_id,
  s.name as stage_name,
  s.slug as stage_slug,
  s.position,
  count(l.id) as lead_count
from public.pipeline_stages s
left join public.leads l on l.stage_id = s.id and not l.is_archived
group by s.company_id, s.id, s.name, s.slug, s.position;

-- ── View: leads por cidade (mapa) ───────────────────────────────────────
create or replace view public.leads_by_city
with (security_invoker = true) as
select company_id, city, state, count(*) as total, avg(score)::int as avg_score
from public.leads
where not is_archived and city is not null
group by company_id, city, state;

-- ── Storage buckets ────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values
  ('logos', 'logos', true),
  ('product-photos', 'product-photos', true),
  ('catalogs', 'catalogs', false),
  ('attachments', 'attachments', false)
on conflict (id) do nothing;

-- Política: leitura pública dos buckets públicos
create policy "public read logos" on storage.objects
  for select using (bucket_id in ('logos', 'product-photos'));

-- Política: membros autenticados escrevem/leem nos buckets da própria empresa.
-- Convenção de path: <company_id>/<arquivo>
create policy "members upload company files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('logos', 'product-photos', 'catalogs', 'attachments')
    and (storage.foldername(name))[1]::uuid in (select public.auth_company_ids())
  );
create policy "members read company files" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('catalogs', 'attachments')
    and (storage.foldername(name))[1]::uuid in (select public.auth_company_ids())
  );
create policy "members delete company files" on storage.objects
  for delete to authenticated
  using ((storage.foldername(name))[1]::uuid in (select public.auth_company_ids()));

-- ── Realtime: publica tabelas de colaboração em tempo real ──────────────
alter publication supabase_realtime add table public.leads;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.activities;
