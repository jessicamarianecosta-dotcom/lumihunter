# Arquitetura de WhatsApp — multi-provider

O LumiHunter não fala diretamente com nenhum BSP (Business Solution Provider)
de WhatsApp. Toda a lógica de negócio (leads, conversas, mensagens, dashboard,
frontend) chama uma camada de abstração; o provider por trás dela é só
transporte.

```
LumiHunter (leads, conversas, campanhas, frontend)
        ↓
WhatsAppService            src/lib/whatsapp/service.ts
        ↓
WhatsAppProvider (interface)  src/lib/whatsapp/types.ts
        ↓
   ┌─────────────┬──────────────┐
   │             │
MetaCloudApiProvider     YCloudProvider
providers/meta-cloud-api.ts   providers/ycloud.ts
   │             │
Meta Graph API        YCloud API
```

## Por que isso importa

Nenhum outro arquivo do projeto (rotas de API, agentes, frontend) importa
`providers/meta-cloud-api.ts` ou `providers/ycloud.ts` diretamente — todos
chamam funções de `src/lib/whatsapp/service.ts`:

- `sendMessage(companyId, { to, body })` — envia uma mensagem de texto.
- `healthCheck(companyId)` — testa a conexão real (usado pelo botão "Testar
  conexão" em Configurações).
- `validateWebhookHandshake(providerId, params)` / `parseIncomingWebhook(providerId, payload)`
  — usados pelas rotas de webhook (uma por provider).

Trocar de provider é uma configuração (`active_provider` salvo no banco, ou
`WHATSAPP_PROVIDER` no ambiente como fallback), nunca uma mudança de código
nos módulos de leads/conversas/campanhas.

## Onde a config de cada provider fica guardada

Reaproveita a tabela `integrations` já existente (nenhuma tabela nova):
uma linha com `provider = 'whatsapp'` por empresa, `config` (jsonb) assim:

```json
{
  "active_provider": "ycloud",
  "access_token": "...",          // campos do Meta, sem mudança de nome
  "phone_number_id": "...",
  "business_account_id": "...",
  "api_version": "v21.0",
  "ycloud": {
    "api_key": "...",
    "webhook_secret": "..."
  }
}
```

Os campos do Meta continuam exatamente como antes (compatibilidade com a
integração que já existia); o YCloud vive num objeto irmão, para nunca
misturar credenciais dos dois provedores.

## Banco de dados

`messages` e `conversations` já tinham colunas agnósticas de provider:
`provider_message_id`, `status` (enum `queued|sent|delivered|read|failed|bounced|received`),
`external_id`. Foi adicionada só uma coluna nova, aditiva e nullable:
`provider text` (em ambas as tabelas), para registrar qual BSP tratou aquele
registro — não é usada para decidir comportamento, só para auditoria/histórico.

## Status de mensagem — mapeamento

Cada provider mapeia seus próprios estados para o enum padronizado do
LumiHunter (`queued|sent|delivered|read|failed`) dentro do seu próprio
`parseWebhook()`. O restante do sistema só vê o estado padronizado — se o
YCloud usar nomes diferentes de status, o mapeamento fica isolado dentro de
`providers/ycloud.ts`, sem vazar para o resto do código.

## Webhooks — uma rota por provider

- Meta: `/api/whatsapp/webhook` (já existia, inalterado no comportamento —
  só passou a chamar `WhatsAppService` em vez de `lib/integrations/whatsapp.ts`
  diretamente).
- YCloud: `/api/webhooks/whatsapp/ycloud` (nova, estrutura pronta).

Cada BSP é registrado com sua própria URL de webhook no respectivo painel —
por isso rotas separadas em vez de uma rota "adivinhando" o formato do
payload por provider.

## Status atual de cada provider

| Provider | Enviar mensagem | Receber webhook | Status |
|---|---|---|---|
| **Meta Cloud API** | ✅ implementado (reaproveita `lib/integrations/whatsapp.ts`, já testado) | ✅ implementado | Pronto para uso real |
| **YCloud** | ⚠️ estrutura pronta, chamada real pendente | ⚠️ estrutura pronta, parsing pendente | Aguardando confirmação da documentação oficial do YCloud |

Ver `docs/WHATSAPP.md` para os detalhes operacionais (como testar, como
diagnosticar, como fazer rollback).

## Como ativar o YCloud de verdade

1. Confirme na documentação/dashboard do YCloud (`docs.ycloud.com` ou
   equivalente, não acessível a partir deste ambiente de desenvolvimento):
   - Endpoint + verbo HTTP para enviar mensagem de texto.
   - Header/mecanismo de autenticação.
   - Formato exato do corpo da requisição de envio.
   - Formato exato do payload de webhook (mensagem recebida e status).
   - Como o webhook é assinado/validado.
2. Implemente esses 5 itens em `src/lib/whatsapp/providers/ycloud.ts` —
   apenas esse arquivo muda.
3. Configure a URL de webhook `https://lumihunter.vercel.app/api/webhooks/whatsapp/ycloud`
   no painel do YCloud.
4. Em Configurações → WhatsApp, cole a API Key do YCloud e defina o provider
   ativo como "YCloud".
5. Teste com o botão "Testar conexão".

Nenhum outro módulo do LumiHunter precisa mudar.

## Como ativar futuramente a Meta Cloud API "pura" (sem Coexistência)

Já está pronto — é só trocar o "Provider ativo" de volta para "Meta Cloud
API" em Configurações e preencher Phone Number ID / Access Token / Business
Account ID (o card já existe na tela). Nenhuma mudança de código necessária.

## Rollback

Se o YCloud apresentar problema em produção, trocar "Provider ativo" de
volta para "Meta Cloud API" em Configurações resolve imediatamente — sem
deploy, sem editar código. É por isso que essa arquitetura existe.
