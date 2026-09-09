-- Fase 1 (qualidade v4) — gates duros: só empresa individual + comprador +
-- produto concreto do catálogo + WhatsApp confirmado + alto potencial vira lead.
-- Aplicada em produção via MCP (versão 20260909172418).
alter table public.lead_discoveries
  add column if not exists individual_business boolean not null default true,
  add column if not exists product_match_name text,
  add column if not exists product_match_reason text,
  add column if not exists whatsapp_evidence text;
