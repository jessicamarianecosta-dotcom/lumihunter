-- Lista completa de leads na tela de Prospecção: uma view que já junta
-- lead_discoveries (empresa encontrada) com o estado real de abordagem
-- (outreach_queue, o mais recente por lead) e de conversa (needs_attention,
-- interesse). Sem isso a tela só teria contadores — o pedido explícito é
-- "quero conseguir ver a lista completa, com status por lead".
create or replace view public.lead_discovery_status
with (security_invoker = true) as
select
  ld.id as discovery_id,
  ld.company_id,
  ld.campaign_id,
  ld.discovery_run_id,
  ld.company_name,
  ld.segment,
  ld.city,
  ld.state,
  ld.whatsapp,
  ld.email,
  ld.instagram,
  ld.website,
  ld.whatsapp_verified,
  ld.product_match_name,
  ld.product_match_reason,
  ld.status as discovery_status,
  ld.lead_id,
  ld.created_at,
  oq.id as outreach_queue_id,
  oq.status as outreach_status,
  oq.failure_reason,
  oq.sent_at,
  oq.delivered_at,
  oq.read_at,
  oq.replied_at,
  conv.id as conversation_id,
  conv.needs_attention,
  conv.interest_status,
  conv.last_reply_kind,
  -- status único e legível para a lista/filtro — nesta ordem de prioridade
  case
    when conv.needs_attention then 'needs_attention'
    when oq.status = 'opted_out' then 'opted_out'
    when oq.status = 'replied' then 'replied'
    when oq.status = 'read' then 'read'
    when oq.status = 'delivered' then 'delivered'
    when oq.status = 'sent' then 'sent'
    when oq.status = 'sending' then 'sending'
    when oq.status = 'failed' then 'failed'
    when oq.status = 'skipped' then 'skipped'
    when oq.status in ('ready', 'scheduled') then 'queued'
    when ld.status = 'approved' then 'queued'
    when ld.status = 'qualified' then 'awaiting'
    else 'awaiting'
  end as lead_status
from public.lead_discoveries ld
left join lateral (
  select oq2.*
  from public.outreach_queue oq2
  where oq2.lead_id = ld.lead_id
  order by oq2.created_at desc
  limit 1
) oq on ld.lead_id is not null
left join public.conversations conv on conv.lead_id = ld.lead_id and conv.channel = 'whatsapp';

comment on view public.lead_discovery_status is
  'Lista de leads da tela de Prospecção: empresa + segmento + WhatsApp + oportunidade + status real de abordagem/conversa, num único SELECT.';

create index if not exists lead_discoveries_lead_id_idx on public.lead_discoveries (lead_id);
