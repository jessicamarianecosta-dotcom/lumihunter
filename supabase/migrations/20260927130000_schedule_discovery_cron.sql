-- A migração 20260910120000_discovery_escala.sql já continha o bloco que
-- agenda este pg_cron, mas ele nunca chegou a rodar em produção (o secret
-- do Vault ainda não existia no momento em que essa migração foi aplicada,
-- então o `do $$ ... $$` saiu pelo `return` antecipado sem agendar nada).
-- Resultado prático: campanhas de descoberta em escala ficavam paradas por
-- horas — só avançavam 1x/dia, no cron diário do Vercel Hobby
-- (/api/cron/followups) — em vez de continuar automaticamente a cada poucos
-- minutos até atingir a meta de leads válidos.
--
-- `lumihunter_cron_secret` já existe no Vault deste projeto (criado junto
-- com o pg_cron de outreach). Reagenda aqui, idempotente.
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
        headers := jsonb_build_object('Authorization', 'Bearer %s'),
        timeout_milliseconds := 25000
      );$job$, v_secret)
  );
end $$;
