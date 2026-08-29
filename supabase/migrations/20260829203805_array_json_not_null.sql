-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 010: colunas de array/jsonb com default nunca devem ser null
-- (melhora a tipagem gerada e evita checagens redundantes na app)
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.products
  alter column cities_served set not null,
  alter column keywords set not null,
  alter column applications set not null,
  alter column use_cases set not null,
  alter column example_buyers set not null,
  alter column tags set not null,
  alter column photo_urls set not null;

alter table public.icp_profiles
  alter column states set not null,
  alter column cities set not null,
  alter column regions set not null,
  alter column segments set not null,
  alter column company_sizes set not null,
  alter column keywords set not null;

alter table public.leads
  alter column products_sold set not null,
  alter column recommended_product_ids set not null,
  alter column score_factors set not null;

alter table public.activities alter column meta set not null;
alter table public.messages alter column attachments set not null;
alter table public.tasks alter column checklist set not null;
alter table public.followup_sequences alter column steps set not null;
alter table public.automations
  alter column conditions set not null,
  alter column actions set not null;
alter table public.automation_runs alter column detail set not null;
alter table public.ai_agents alter column config set not null;
alter table public.integrations alter column config set not null;
alter table public.consents alter column detail set not null;
alter table public.subscriptions alter column limits set not null;
