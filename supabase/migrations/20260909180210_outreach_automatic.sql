-- Fase 4 — PROSPECÇÃO AUTOMÁTICA.
-- Quando `outreach_automatic` = true, um resultado que passa em TODOS os gates
-- (empresa individual compradora · região · não concorrente · WhatsApp comercial
-- confirmado · produto REAL do catálogo compatível) é promovido a lead, tem a
-- mensagem gerada e entra na fila de envio SEM aprovação manual.
-- A fila de envio (janela/limite/intervalo/opt-out/disjuntor) continua igual.
-- Aplicada em produção via MCP (versão 20260909180210).
alter table public.campaigns
  add column if not exists outreach_automatic boolean not null default false;

alter table public.outreach_queue
  add column if not exists auto_enqueued boolean not null default false;

comment on column public.campaigns.outreach_automatic is
  'Fase 4: pesquisa → valida → envia automaticamente, sem etapa de aprovação manual.';
comment on column public.outreach_queue.auto_enqueued is
  'true = item colocado na fila pela prospecção automática (não por aprovação manual).';
