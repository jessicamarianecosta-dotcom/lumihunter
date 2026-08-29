# LumiHunter AI

> Seu agente inteligente para encontrar, qualificar e conquistar novos clientes.

CRM + agentes de IA para prospecção B2B, **multi-tenant** (SaaS). O sistema
pesquisa empresas na internet, identifica quais têm potencial de comprar os
produtos cadastrados, organiza os leads em um pipeline, gera mensagens
personalizadas e acompanha todo o funil de vendas.

---

## Stack

| Camada | Tecnologia |
| --- | --- |
| Front-end | Next.js (App Router), React 19, TypeScript, TailwindCSS, componentes shadcn-style, Lucide, Framer Motion |
| Back-end | Next.js Server Actions + Route Handlers |
| Banco | Supabase PostgreSQL (RLS em todas as tabelas) |
| Auth | Supabase Auth (senha, magic link, Google OAuth) |
| Storage / Realtime | Supabase Storage + Realtime |
| IA | Claude API (Anthropic) — agentes Hunter, Qualifier, Copywriter, Analyst |
| E-mail | Resend (opcional nesta fase) |
| WhatsApp | WhatsApp Cloud API oficial da Meta (opcional nesta fase — **nunca** WhatsApp Web) |
| Deploy | Vercel |

> **Nota sobre a versão do Next.js:** o brief pedia Next.js 16. Como a linha 16
> ainda não está disponível de forma estável, o projeto usa a última linha
> estável (Next.js 15 / App Router / React 19). A migração para a 16 será um
> `npm upgrade` quando ela sair — nenhuma API usada aqui é incompatível.

---

## Rodando localmente

### 1. Pré-requisitos
- Node.js 20+
- Um projeto Supabase (grátis serve) — ou a CLI do Supabase para rodar local
- Uma chave da Claude API (`ANTHROPIC_API_KEY`)

### 2. Instalar
```bash
npm install
cp .env.example .env.local
```

Preencha `.env.local` com as chaves do Supabase e da Anthropic. As integrações
de WhatsApp e Resend ficam **desligadas** por padrão (`*_ENABLED=false`) e operam
em **modo simulação** — o sistema registra as mensagens sem enviá-las.

**Modo demo dos agentes de IA:** sem `ANTHROPIC_API_KEY` (ou com
`AI_DEMO_MODE=true`), Hunter, Qualifier, Copywriter e Analyst devolvem respostas
simuladas realistas — **custo zero**. Todo o fluxo (achar leads, dar score,
gerar mensagens, insights) funciona para testar antes de contratar a API.
Ao adicionar a chave, os agentes passam a usar a Claude API automaticamente.

### 3. Aplicar o schema do banco

**Opção A — Supabase CLI (recomendado):**
```bash
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push          # aplica todas as migrations em supabase/migrations
npm run db:types              # regenera src/lib/supabase/database.types.ts
```

**Opção B — SQL Editor:** copie o conteúdo de cada arquivo em
`supabase/migrations/` (na ordem numérica) e execute no SQL Editor do painel.

### 4. Configurar o Auth do Supabase
- **Authentication → URL Configuration:** Site URL `http://localhost:3000`,
  Redirect URLs incluindo `http://localhost:3000/auth/callback`.
- **Authentication → Providers → Google:** ative e informe Client ID/Secret
  (opcional).

### 5. Subir o app
```bash
npm run dev
```
Acesse `http://localhost:3000`, crie sua conta e faça o onboarding.
Para ver o sistema com dados: **Configurações → Criar LumiLife demo**.

---

## Fluxo do produto

1. **Onboarding** — cadastra a empresa e o primeiro produto.
2. **Produtos** — catálogo completo (palavras-chave, aplicações, compradores-exemplo).
3. **ICP** — define regiões, segmentos, porte e palavras-chave do cliente ideal.
4. **Agente Hunter** (`/leads` → "Rodar") — busca empresas públicas que aderem ao
   ICP e cria leads no estágio *Novo Lead*.
5. **Qualifier** (na página do lead) — atribui um **Lead Score 0–100** com a
   explicação dos fatores e recomenda produtos.
6. **Copywriter** — gera a abordagem para WhatsApp, e-mail, Instagram DM e
   ligação, conectando o lead a um produto específico.
7. **Envio** — dispara via WhatsApp Cloud API / Resend (ou simulação) e abre a
   conversa na central.
8. **CRM Kanban** — arraste os leads pelos estágios; o status acompanha.
9. **Campanhas + Follow-up** — sequências que param automaticamente na resposta
   (cron `/api/cron/followups` a cada 15 min na Vercel).
10. **Analyst** (`/relatorios`) — insights automáticos por segmento/cidade/campanha.

---

## Deploy na Vercel

1. Suba o repositório para o GitHub.
2. Em vercel.com → **New Project** → importe o repositório.
3. Defina as variáveis de ambiente (todas as de `.env.example`), incluindo
   `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` e, se for usar o cron
   protegido, `CRON_SECRET`.
4. Ajuste no Supabase Auth a Site URL / Redirect URLs para o domínio da Vercel.
5. Deploy. Cada `push` na branch `main` publica automaticamente; PRs geram
   Preview Deploys. O `vercel.json` já registra o cron de follow-up.

O workflow `.github/workflows/ci.yml` roda lint + build + typecheck em cada push/PR.

---

## Estrutura

```
src/
  app/
    (auth)/            login, signup, forgot-password
    (app)/             área logada: dashboard, leads, conversas, campanhas,
                       produtos, icp, agentes, tarefas, relatorios, config
    api/
      agents/          hunter | qualifier | copywriter | analyst
      messages/send    envio WhatsApp/e-mail
      whatsapp/webhook  recebimento (Meta)
      resend/webhook    eventos de e-mail
      cron/followups    fila de follow-up
    auth/              actions + callback OAuth
    onboarding/
  components/          ui/ (design system) + app/ + auth/ + leads/
  lib/
    supabase/          client | server | admin | middleware | types
    anthropic/         client + agents/ (hunter, qualifier, copywriter, analyst)
    integrations/      whatsapp | resend
    search/            provedor de busca web do Hunter (serper | tavily | mock)
    auth/context.ts    sessão + empresa ativa (multi-tenant)
supabase/
  migrations/          schema completo, RLS, triggers, views, storage, seed RPC
docs/                  arquitetura, banco, deploy, manuais
```

---

## Segurança

- **RLS em todas as tabelas** — políticas geradas por `public.apply_tenant_rls()`
  a partir de `company_id` e do papel do usuário (`owner/admin/sales/marketing/finance/viewer`).
- O cliente `service-role` (`src/lib/supabase/admin.ts`) só é usado em rotas de
  servidor (webhooks, cron, agentes) — nunca no browser.
- Blacklist / opt-out e registro de consentimento (LGPD) integrados ao envio.
- Cron protegido por `CRON_SECRET`.

---

## O que já está pronto x próximos passos

**Pronto:** multi-tenant + RLS, auth completa, onboarding, catálogo, ICP,
Hunter, Qualifier, Copywriter, Analyst, CRM Kanban, página do lead, conversas,
campanhas, tarefas, dashboard, envio WhatsApp/e-mail com webhooks, follow-up por
cron, painel de agentes com custo de IA, seed LumiLife, tema claro/escuro, CI.

**Próximos passos** (estrutura já preparada): painel de conexão de integrações
por empresa via Supabase Vault, exportação PDF/Excel/CSV, command palette e busca
global, cobrança Stripe, Google Calendar, editor visual de automações,
importação CSV de produtos/leads. Ver `docs/roadmap.md`.

Licença: [MIT](LICENSE).
