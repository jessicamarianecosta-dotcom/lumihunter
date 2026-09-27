-- Unifica o secret usado pelos dois pg_cron jobs (`drain-outreach-queue` e
-- `lumihunter-discovery`) no mesmo valor já usado em produção desde a Fase 2
-- (`cron_outreach_secret`). Antes, `lumihunter-discovery` usava um secret
-- diferente (`lumihunter_cron_secret`), então não havia um único valor que
-- pudesse ser configurado como `CRON_SECRET` na Vercel sem quebrar um dos
-- dois crons.
--
-- Com os dois usando o mesmo secret, a env var `CRON_SECRET` (adicionada na
-- Vercel com o MESMO valor de `cron_outreach_secret`, sem tocar em nenhuma
-- credencial de negócio como WhatsApp/OpenAI/Tavily) passa a validar as
-- chamadas de cron sem quebrar nada que já estava funcionando.
do $$
declare
  v_secret text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    return;
  end if;
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'cron_outreach_secret' limit 1;
  if v_secret is null then
    raise notice 'Vault sem cron_outreach_secret — nada a fazer';
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
