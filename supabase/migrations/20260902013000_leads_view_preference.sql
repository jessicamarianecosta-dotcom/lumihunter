-- ═══════════════════════════════════════════════════════════════════════════
-- Preferência de visualização (Kanban/Lista) de Leads & CRM, por usuário
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists leads_view_preference text not null default 'kanban'
    check (leads_view_preference in ('kanban', 'list'));
