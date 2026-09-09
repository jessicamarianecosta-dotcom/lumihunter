-- Fase 4 (cont.) — CONVERSAS como centro do acompanhamento de envio.
--
-- A tela "Oportunidades" fica só para descoberta/qualificação/auditoria.
-- O acompanhamento REAL do WhatsApp (na fila → enviado → entregue → lido →
-- respondeu) passa a viver em `conversations`, com estado espelhado a partir da
-- `outreach_queue` e dos webhooks da Meta. Nada é simulado: "entregue"/"lido"
-- só entram com status real do provedor.
-- Aplicada em produção via MCP (versão 20260909185959).
alter table public.conversations
  add column if not exists outreach_state text,
  add column if not exists needs_attention boolean not null default false,
  add column if not exists attention_since timestamptz,
  add column if not exists handled_at timestamptz,
  add column if not exists handled_by uuid,
  add column if not exists last_outbound_at timestamptz,
  add column if not exists last_inbound_at timestamptz,
  add column if not exists outreach_campaign_id uuid references public.campaigns(id) on delete set null,
  add column if not exists catalog_sent boolean not null default false;

comment on column public.conversations.outreach_state is
  'Estado do envio automático espelhado da outreach_queue/webhooks: queued|sending|sent|delivered|read|replied|failed|opted_out. NULL = conversa não iniciada por prospecção.';
comment on column public.conversations.needs_attention is
  'true = o cliente respondeu e a conversa precisa de atendimento humano.';

create index if not exists idx_conversations_needs_attention
  on public.conversations (company_id) where needs_attention;
create index if not exists idx_conversations_outreach_state
  on public.conversations (company_id, outreach_state);
