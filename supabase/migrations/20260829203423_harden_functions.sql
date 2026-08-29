-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 009: hardening — search_path fixo e revogação de EXECUTE
-- (recomendações do database linter do Supabase)
-- ═══════════════════════════════════════════════════════════════════════════

alter function public.set_updated_at() set search_path = public;
alter function public.apply_tenant_rls(regclass) set search_path = public;

-- funções de trigger: não devem ser chamáveis via API REST
revoke all on function public.set_updated_at() from anon, authenticated, public;
revoke all on function public.handle_new_user() from anon, authenticated, public;
revoke all on function public.touch_conversation() from anon, authenticated, public;
revoke all on function public.log_lead_stage_change() from anon, authenticated, public;
revoke all on function public.seed_pipeline_stages() from anon, authenticated, public;
revoke all on function public.seed_ai_agents() from anon, authenticated, public;
revoke all on function public.seed_subscription() from anon, authenticated, public;
revoke all on function public.apply_tenant_rls(regclass) from anon, authenticated, public;

-- helpers de autorização: só o role authenticated precisa executar (via policies)
revoke all on function public.auth_company_ids() from anon, public;
revoke all on function public.auth_role(uuid) from anon, public;
revoke all on function public.auth_can_write(uuid) from anon, public;
revoke all on function public.auth_is_admin(uuid) from anon, public;
grant execute on function public.auth_company_ids() to authenticated;
grant execute on function public.auth_role(uuid) to authenticated;
grant execute on function public.auth_can_write(uuid) to authenticated;
grant execute on function public.auth_is_admin(uuid) to authenticated;

revoke all on function public.create_company(text, text, text, text) from anon, public;
grant execute on function public.create_company(text, text, text, text) to authenticated;
