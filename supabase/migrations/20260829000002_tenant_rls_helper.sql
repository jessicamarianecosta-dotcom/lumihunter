-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 002: gerador de RLS padrão para tabelas company-scoped
-- Convenção: toda tabela tenant tem coluna `company_id uuid not null`.
--   SELECT  -> qualquer membro da empresa
--   INSERT  -> membros com permissão de escrita (não-viewer)
--   UPDATE  -> membros com permissão de escrita
--   DELETE  -> membros com permissão de escrita
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.apply_tenant_rls(p_table regclass)
returns void language plpgsql as $$
declare
  t text := p_table::text;
begin
  execute format('alter table %s enable row level security', t);

  execute format($f$
    create policy "tenant_select" on %s for select
    using (company_id in (select public.auth_company_ids()))
  $f$, t);

  execute format($f$
    create policy "tenant_insert" on %s for insert
    with check (public.auth_can_write(company_id))
  $f$, t);

  execute format($f$
    create policy "tenant_update" on %s for update
    using (public.auth_can_write(company_id))
    with check (public.auth_can_write(company_id))
  $f$, t);

  execute format($f$
    create policy "tenant_delete" on %s for delete
    using (public.auth_can_write(company_id))
  $f$, t);
end;
$$;
