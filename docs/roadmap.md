# Roadmap — LumiHunter AI

## Entregue nesta fase (fundação)

- Multi-tenant + RLS em todas as tabelas + RBAC (6 papéis)
- Auth: senha, magic link, Google, recuperação, callback OAuth
- Onboarding (empresa + primeiro produto)
- Catálogo de produtos; Perfil de Cliente Ideal (ICP)
- Agentes de IA: Hunter, Qualifier, Copywriter, Analyst (Claude API) + log de custo
- Provedor de busca web plugável (serper / tavily / mock)
- CRM Kanban com drag-and-drop; página do lead com timeline, notas, score
- Conversas (central WhatsApp + e-mail)
- Campanhas + fila de follow-up por cron (para na resposta)
- Tarefas
- Dashboard executivo + Relatórios com Analyst
- Envio WhatsApp Cloud API / Resend (com modo simulação) + webhooks de entrada
- Blacklist / opt-out / consentimentos (LGPD)
- Tema claro/escuro automático; design system shadcn-style
- Seed opcional da LumiLife (RPC)
- CI (GitHub Actions) + `vercel.json` (cron) + `.env.example` + MIT

## Próximas etapas

### Curto prazo
- [ ] Painel de conexão de integrações **por empresa** com Supabase Vault
      (hoje as credenciais vêm do ambiente)
- [ ] Regenerar `database.types.ts` a partir do projeto real e remover a versão manual
- [ ] Templates de mensagem na UI + variáveis `{{empresa}}`, `{{cidade}}`
- [ ] Sales Coach (agente de resposta) na central de conversas
- [ ] Convite de membros por e-mail + tela de equipe

### Médio prazo
- [ ] Command Palette (⌘K) + busca global
- [ ] Editor visual de automações (gatilho → condição → ação)
- [ ] Importação CSV de produtos e leads
- [ ] Exportação de relatórios PDF / Excel / CSV
- [ ] Google Calendar (tarefas ↔ eventos)
- [ ] Mapa real de leads por cidade (geocoding)
- [ ] Realtime no Kanban e nas conversas (assinaturas client)

### Longo prazo
- [ ] Cobrança com Stripe (estrutura de `subscriptions` + limites já existe)
- [ ] Enriquecimento de leads (CNPJ, porte, faturamento)
- [ ] App mobile / PWA
- [ ] Multi-idioma
