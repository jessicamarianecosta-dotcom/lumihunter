-- Fase 1 (qualidade v3) — comprador ≠ fornecedor; WhatsApp obrigatório no canal WhatsApp
-- Aplicada em produção via MCP (versão 20260909130834).
alter table public.lead_discoveries
  add column if not exists buyer_fit_score integer,
  add column if not exists competitor boolean not null default false,
  add column if not exists whatsapp_verified boolean not null default false,
  add column if not exists channel_requirement text,
  add column if not exists discard_reason text;

create index if not exists lead_discoveries_prospectable_idx
  on public.lead_discoveries (campaign_id, whatsapp_verified, status);
