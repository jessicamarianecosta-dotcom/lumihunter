# Banco de dados — LumiHunter AI

Postgres (Supabase). Migrations em `supabase/migrations/`, aplicadas em ordem.

## Migrations

| Arquivo | Conteúdo |
| --- | --- |
| `...000001_init_core.sql` | extensões, enums, `companies`, `profiles`, `company_members`, trigger de novo usuário, helpers de autorização, RPC `create_company` |
| `...000002_tenant_rls_helper.sql` | `apply_tenant_rls(regclass)` — gerador de políticas padrão |
| `...000003_products_icp.sql` | `product_categories`, `products`, `icp_profiles`, `icp_products` |
| `...000004_leads_pipeline.sql` | `pipeline_stages` (+ seed automático), `leads`, `lead_contacts`, `lead_tags`, `lead_stage_history` (+ trigger), `activities` |
| `...000005_campaigns_conversations.sql` | `message_templates`, `campaigns`, `campaign_targets`, `conversations`, `messages` (+ trigger `touch_conversation`) |
| `...000006_tasks_automations_ai.sql` | `tasks`, `notes`, `followup_sequences`, `automations`, `automation_runs`, `ai_agents` (+ seed), `ai_runs`, `integrations`, `blacklist`, `consents`, `subscriptions` (+ seed) |
| `...000007_views_storage_realtime.sql` | views `dashboard_metrics`, `pipeline_summary`, `leads_by_city`; buckets de Storage + políticas; publicação Realtime |
| `...000008_seed_lumilife_rpc.sql` | RPC `seed_lumilife()` — cria a empresa demo com catálogo e ICP |

## Enums principais

`member_role`, `plan_tier`, `channel_type`, `lead_status`, `task_status`,
`conversation_status`, `message_direction`, `message_status`, `campaign_status`,
`automation_trigger`, `ai_agent_kind`.

## Relacionamentos (resumo)

```
companies 1─┬─* company_members *─1 auth.users
            ├─* products *─1 product_categories
            ├─* icp_profiles ─* icp_products *─ products
            ├─* pipeline_stages 1─* leads
            │                        ├─* lead_contacts
            │                        ├─* lead_tags
            │                        ├─* lead_stage_history
            │                        ├─* activities / notes / tasks
            │                        └─1 conversations 1─* messages
            ├─* campaigns 1─* campaign_targets *─1 leads
            ├─* followup_sequences
            ├─* automations 1─* automation_runs
            ├─* ai_agents / ai_runs
            ├─1 subscriptions
            └─* integrations / blacklist / consents
```

## Triggers e automações no banco

- `set_updated_at` em todas as tabelas com `updated_at`.
- `handle_new_user` → cria `profiles` ao criar `auth.users`.
- `seed_pipeline_stages`, `seed_ai_agents`, `seed_subscription` → disparam ao
  criar uma `companies`.
- `log_lead_stage_change` → grava `lead_stage_history` a cada troca de estágio.
- `touch_conversation` → atualiza preview / `last_message_at` / `unread_count`.

## RLS

Habilitada em 100% das tabelas. Padrão via `apply_tenant_rls`; exceções
(`companies`, `profiles`, `company_members`, `integrations`, `subscriptions`)
têm políticas explícitas — ver `000001` e `000006`.

## Regenerar tipos TypeScript

```bash
npm run db:types    # supabase gen types typescript --linked > src/lib/supabase/database.types.ts
```
O arquivo versionado é uma versão inicial mantida à mão; substitua-o pela saída
real do comando após linkar o projeto.
