-- Fase 1 (qualidade) — prospecção cirúrgica: product fit + classificação de resultado
-- Aplicada em produção via MCP (versão 20260909120335).
alter table public.lead_discoveries
  add column if not exists product_fit_score integer,
  add column if not exists business_fit_score integer,
  add column if not exists result_type text,      -- business | article | directory | event | association | government | community | content | unknown
  add column if not exists business_type text,    -- company | store | brand | manufacturer | bakery | confectionery | cosmetics_brand | soap_brand | candle_brand | artisan_business | restaurant | service_business | other | unknown
  add column if not exists source_quality integer,
  add column if not exists evidence jsonb not null default '[]'::jsonb;

create index if not exists lead_discoveries_product_fit_idx
  on public.lead_discoveries (campaign_id, product_fit_score desc);
