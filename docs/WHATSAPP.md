# WhatsApp no LumiHunter

## Visão geral do fluxo

```
Hunter encontra empresa → Lead criado → aparece em Leads & CRM
        ↓
Usuário abre o lead → clica em "WhatsApp" → escreve mensagem → Enviar
        ↓
WhatsAppService.sendMessage(companyId, { to, body })   [backend]
        ↓
Provider ativo (Meta ou YCloud) → número conectado → Lead
```

```
Lead responde no WhatsApp
        ↓
Provider → Webhook (/api/whatsapp/webhook ou /api/webhooks/whatsapp/ycloud)
        ↓
Mensagem registrada, conversa atualizada, lead marcado como "replied"
        ↓
Resposta aparece em Conversas
```

## Coexistência (número da LumiLife: +55 41 9587-2303)

O app WhatsApp Business continua funcionando normalmente no celular. O
YCloud opera em modo Coexistência — o LumiHunter só recebe eventos via
webhook e envia mensagens via API; nada nessa integração desconecta,
migra ou substitui o número, nem altera a configuração de Coexistência já
feita no painel da Meta/YCloud.

## Janela de 24 horas e templates

O WhatsApp só permite mensagem de texto livre dentro de 24h da última
mensagem do cliente. Fora dessa janela, é necessário um template aprovado.
Se o provider retornar erro de política/template/janela/qualidade/bloqueio,
o `SendMessageResult.error` carrega a mensagem — trate-a como definitiva
(não tente reenviar automaticamente) e mostre ao usuário exatamente o que o
provider respondeu, sem mascarar como sucesso.

## Testando

1. Configurações → WhatsApp → escolha o provider ativo.
2. Preencha as credenciais do provider escolhido.
3. Clique em "Testar conexão" — faz uma chamada real (não só confere se o
   campo está preenchido).
4. Abra um lead com WhatsApp cadastrado → clique em "WhatsApp" → envie uma
   mensagem de teste.
5. Confira em Conversas se o status mudou (queued → sent → delivered → read).
6. Responda pelo celular (no número conectado) e confira se a resposta
   aparece no LumiHunter.

## Diagnóstico

| Sintoma | Onde olhar |
|---|---|
| "Testar conexão" falha | Credenciais erradas/expiradas, ou provider errado selecionado |
| Envio sempre "simulado" | Nenhuma credencial configurada para o provider ativo — não é bug, é o fallback seguro |
| Webhook não chega | Confira a URL exata registrada no painel do provider e o verify token |
| Mensagem duplicada | `provider_message_id` já existe — o webhook é idempotente por esse campo |
| Status não atualiza | Confirme que o provider está enviando eventos de status (`sent/delivered/read/failed`) e que o mapeamento em `providers/<provider>.ts` cobre esses nomes |

## Segurança

- Nenhuma credencial (`access_token`, `api_key`, `webhook_secret`) é enviada
  ao navegador — as telas de Configurações mostram só uma versão mascarada
  (`sk-••••••••1234`).
- Todas as chamadas ao provider acontecem no backend (rotas de API/Server
  Actions), nunca no frontend.
- Credenciais ficam na tabela `integrations` (por empresa) ou em variáveis
  de ambiente como fallback — nunca no código-fonte.

## Rollback

Trocar "Provider ativo" em Configurações volta o sistema para o outro
provider imediatamente, sem deploy. Ver `docs/WHATSAPP_PROVIDERS.md` para a
arquitetura completa e como ativar/migrar cada provider.
