# Deploy — LumiHunter AI

## 1. Supabase (produção)

1. Crie um projeto em app.supabase.com.
2. Localmente:
   ```bash
   npx supabase login
   npx supabase link --project-ref <REF>
   npx supabase db push
   npm run db:types
   ```
3. **Authentication → URL Configuration**
   - Site URL: `https://<seu-dominio>`
   - Redirect URLs: `https://<seu-dominio>/auth/callback`
4. **Authentication → Providers → Google** (opcional): Client ID/Secret do
   Google Cloud; Authorized redirect URI = `https://<REF>.supabase.co/auth/v1/callback`.
5. **Storage**: os buckets (`logos`, `product-photos`, `catalogs`, `attachments`)
   são criados pela migration `000007`.

## 2. GitHub

```bash
git init
git add .
git commit -m "chore: bootstrap LumiHunter AI"
git branch -M main
git remote add origin git@github.com:<voce>/lumihunter-ai.git
git push -u origin main
```
O CI (`.github/workflows/ci.yml`) roda lint + build + typecheck em cada push/PR.

## 3. Vercel

1. vercel.com → **Add New → Project** → importe o repositório.
2. Framework: Next.js (detectado). Build: `next build` (padrão).
3. **Environment Variables** — adicione todas de `.env.example`:
   - `NEXT_PUBLIC_APP_URL` = `https://<seu-dominio>`
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (Sensitive)
   - `ANTHROPIC_API_KEY` (+ `ANTHROPIC_MODEL_*` se quiser trocar modelos)
   - `HUNTER_SEARCH_PROVIDER` + chave do provedor (`serper`/`tavily`) para busca real
   - `WHATSAPP_*` e `RESEND_*` quando for ligar as integrações
   - `CRON_SECRET` — string aleatória; o cron exige `Authorization: Bearer <CRON_SECRET>`
4. Deploy. `main` → produção; PRs → Preview Deploys.
5. `vercel.json` já registra o cron `/api/cron/followups` a cada 15 min.
6. Domínio: **Settings → Domains** → adicione o customizado.

## 4. Webhooks das integrações

- **WhatsApp (Meta):** App → WhatsApp → Configuration → Callback URL
  `https://<seu-dominio>/api/whatsapp/webhook`, Verify Token = `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
  Assine o campo `messages`.
- **Resend:** Webhooks → Add → `https://<seu-dominio>/api/resend/webhook`,
  eventos `email.*`.

## 5. Checklist pós-deploy

- [ ] Criar conta, completar onboarding
- [ ] `Configurações → Criar LumiLife demo` (opcional)
- [ ] Definir um ICP e rodar o Hunter
- [ ] Qualificar um lead e gerar copy
- [ ] Enviar mensagem (simulação ou real) e conferir em Conversas
- [ ] Conferir custo de IA em Agentes de IA
