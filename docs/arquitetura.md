# Arquitetura — LumiHunter AI

## Visão geral

```
Browser ──► Next.js (App Router, Vercel)
              │  Server Components / Server Actions  ──► Supabase (RLS, anon key + JWT do usuário)
              │  Route Handlers (/api/*)             ──► Supabase (service-role, quando confiável)
              │                                      ──► Claude API (agentes)
              │                                      ──► WhatsApp Cloud API / Resend
              ▼
        Supabase: Postgres + Auth + Storage + Realtime
```

## Multi-tenant

- `companies` é a raiz do tenant. `company_members(company_id, user_id, role)`
  liga usuários a empresas com um papel.
- A **empresa ativa** da sessão é resolvida em `src/lib/auth/context.ts` a partir
  do cookie `lh_active_company` (fallback: primeira empresa do usuário).
- Toda tabela de negócio carrega `company_id NOT NULL`. As políticas RLS são
  criadas em massa por `public.apply_tenant_rls('public.<tabela>')`:
  - `SELECT`: `company_id in (select auth_company_ids())`
  - `INSERT/UPDATE/DELETE`: `auth_can_write(company_id)` (qualquer papel ≠ viewer)
- Tabelas sensíveis (`integrations`, `subscriptions`) usam política própria
  restrita a `auth_is_admin(company_id)`.
- Funções auxiliares (`auth_company_ids`, `auth_role`, `auth_can_write`,
  `auth_is_admin`) são `SECURITY DEFINER` e evitam recursão de RLS.

## Camadas de acesso ao banco

| Cliente | Arquivo | Uso | RLS |
| --- | --- | --- | --- |
| Browser | `supabase/client.ts` | componentes client, RPC do usuário | sim |
| Server (SSR) | `supabase/server.ts` | Server Components / Actions | sim (JWT do usuário) |
| Middleware | `supabase/middleware.ts` | refresh de sessão + guarda de rotas | sim |
| Admin | `supabase/admin.ts` | webhooks, cron, agentes | **não (bypass)** |

## Agentes de IA

Cada agente é uma função pura em `src/lib/anthropic/agents/*` que:
1. monta o contexto (catálogo, ICP, lead, métricas);
2. chama `client.messages.create` (modelo configurável por `ai_agents.model`);
3. faz parse de JSON tolerante (`parseJsonFromText`);
4. registra a execução em `ai_runs` (tokens, custo estimado, duração) via
   `logAiRun`.

| Agente | Entrada | Saída | Rota |
| --- | --- | --- | --- |
| Hunter | ICP + catálogo + resultados de busca web | lista de empresas-alvo | `POST /api/agents/hunter` |
| Qualifier | lead + ICP + catálogo | score 0–100 + fatores + produtos | `POST /api/agents/qualifier` |
| Copywriter | empresa + lead + produto + tipo | mensagens por canal | `POST /api/agents/copywriter` |
| Analyst | métricas agregadas | 3–6 insights priorizados | `POST /api/agents/analyst` |

O provedor de busca do Hunter (`src/lib/search`) é plugável:
`serper`, `tavily` ou `mock` (sintético, para dev sem credenciais).

## Mensageria

- **Envio** (`/api/messages/send`): checa blacklist → abre/localiza `conversations`
  → envia por WhatsApp Cloud API ou Resend → grava `messages` → atualiza status do lead.
- **Recebimento WhatsApp** (`/api/whatsapp/webhook`): handshake GET + parse de
  mensagens; casa `phone_number_id` → empresa e telefone → lead.
- **Eventos Resend** (`/api/resend/webhook`): mapeia `email.delivered/opened/bounced`
  para o status da mensagem.
- Sem credenciais, ambos operam em **modo simulação** (registram, não enviam).

## Follow-up

`campaign_targets` guarda o passo atual e `next_action_at`. O cron
`/api/cron/followups` (a cada 15 min via `vercel.json`) processa a fila,
**para na primeira resposta** do lead e agenda o próximo passo.

## Realtime

`leads`, `messages`, `conversations`, `tasks` e `activities` estão na publicação
`supabase_realtime` — pronto para assinaturas no client (kanban colaborativo,
central de conversas ao vivo).
