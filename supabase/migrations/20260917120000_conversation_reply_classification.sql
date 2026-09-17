-- Tela "Conversas" — classificação de resposta automática vs. humana.
--
-- Até aqui QUALQUER mensagem recebida (mesmo um "fora do horário de
-- atendimento" automático) virava outreach_state='replied' e
-- needs_attention=true. Isso inflava "Precisa de você" com respostas de bot.
--
-- Agora o webhook classifica cada mensagem recebida (heurística de padrões,
-- ver src/lib/outreach/reply-classifier.ts) em resposta automática/humana e,
-- para humanas, em interessado/sem interesse/neutro. needs_attention só liga
-- para resposta humana que não é claramente "sem interesse". Uma resposta
-- humana posterior a uma automática sempre prevalece (outreach_state
-- 'auto_replied' tem rank menor que 'replied' em resolveOutreachState).
alter table public.conversations
  add column if not exists last_reply_kind text check (last_reply_kind in ('auto', 'human')),
  add column if not exists interest_status text check (interest_status in ('interested', 'not_interested'));

comment on column public.conversations.last_reply_kind is
  'Última resposta recebida: auto (bot/ausência) ou human. NULL = ainda sem resposta.';
comment on column public.conversations.interest_status is
  'Classificação da última resposta humana: interested|not_interested. NULL = ainda não classificado.';

alter table public.messages
  add column if not exists reply_kind text check (reply_kind in ('auto', 'human')),
  add column if not exists interest text check (interest in ('interested', 'not_interested', 'neutral'));

comment on column public.messages.reply_kind is
  'Só para mensagens inbound: auto (bot/ausência) ou human, via heurística de padrões.';
comment on column public.messages.interest is
  'Só para mensagens inbound humanas: interested|not_interested|neutral.';
