-- A descoberta em escala esgotava o plano inicial de consultas
-- (segmento × bairro × intenção, teto de 240) e marcava a rodada como
-- "exhausted" mesmo estando longe da meta (`max_opportunities`/
-- `target_opportunities`). A quantidade pedida pelo usuário é a quantidade
-- FINAL de leads válidos — o sistema deve continuar expandindo a estratégia
-- de busca (mais segmentos, variações de termo, mais regiões) em vez de
-- parar só porque a primeira lista de consultas acabou.
--
-- Esta coluna guarda o progresso das camadas de expansão já tentadas para
-- uma rodada, para não repetir trabalho nem gerar consultas duplicadas
-- entre chamadas do cron.
alter table public.discovery_runs
  add column if not exists expansion_state jsonb not null default '{}'::jsonb;
comment on column public.discovery_runs.expansion_state is
  'Progresso das camadas de expansão de busca (segmentos extras via IA, teto de bairros, etc.) quando o plano inicial de consultas se esgota antes da meta.';
