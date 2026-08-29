# Manuais — LumiHunter AI

## Manual do administrador

### Papéis
| Papel | Pode |
| --- | --- |
| **Proprietário** | tudo, inclusive excluir a empresa e gerenciar o owner |
| **Administrador** | configurações, integrações, equipe, agentes de IA |
| **Comercial / Marketing** | leads, campanhas, conversas, produtos, ICP, tarefas |
| **Financeiro** | leitura + assinatura/plano |
| **Visualização** | somente leitura |

### Configurar a empresa
`Configurações` → dados cadastrais, canais comerciais e cor da marca (usados
pelos agentes nas abordagens).

### Integrações
Nesta fase, WhatsApp Cloud API e Resend são configurados por variáveis de
ambiente (`.env` / Vercel). Enquanto desligados, o sistema **simula** os envios
(registra sem enviar). O status aparece em `Configurações → Integrações`.

### Agentes de IA
`Agentes de IA` → por agente: modelo (`claude-sonnet-5` padrão, `claude-opus-5`
para máxima qualidade, `claude-haiku-4-5` para volume), temperatura, system
prompt customizado e liga/desliga. O custo estimado (USD) das últimas execuções
fica no topo e por agente.

### LGPD
- Opt-out grava em `blacklist` e bloqueia envios naquele canal.
- Consentimentos e solicitações de dados ficam em `consents`.

---

## Manual do usuário (comercial)

1. **Produtos** — cadastre tudo que vende, com palavras-chave, aplicações e
   exemplos de empresas que comprariam. Quanto mais rico, melhor o Hunter.
2. **Cliente ideal (ICP)** — crie um ou mais perfis (regiões, segmentos, porte,
   palavras-chave).
3. **Leads & CRM → Rodar Agente Hunter** — o Hunter busca empresas e cria leads
   em *Novo Lead*. Opcionalmente refine a busca no campo de texto.
4. **Abra um lead**:
   - **Qualificar (score)** — nota 0–100 + explicação + produtos recomendados.
   - **Gerar 1ª abordagem / follow-up** — mensagens para WhatsApp, e-mail,
     Instagram e ligação. Edite o texto e **Enviar WhatsApp / e-mail**.
   - **Nota interna**, **histórico** e troca de **estágio**.
5. **Kanban** — arraste os cartões entre as colunas; o status acompanha.
6. **Campanhas** — crie por canal/segmento/cidade, ative/pause. O follow-up
   automático para quando o lead responde.
7. **Conversas** — central de WhatsApp e e-mail; clique para abrir o lead.
8. **Tarefas** — lembretes com prazo.
9. **Relatórios** — números por segmento + **Insights do Analyst**.

---

## Manual dos agentes de IA

### Hunter
Recebe seu ICP + catálogo, monta consultas de busca (segmento × cidade), lê os
resultados públicos e extrai empresas reais aderentes. **Não inventa contatos** —
campos sem fonte ficam vazios. Deduplica por nome. Rode quando quiser mais leads.

### Qualifier
Avalia um lead contra o ICP e o catálogo. Retorna score 0–100, os fatores que
pesaram (com peso e presença), um resumo da oportunidade e os produtos mais
aderentes. Leads com score ≥ 60 sobem para *Qualificado*.

### Copywriter
Gera a mesma abordagem adaptada a cada canal: WhatsApp (curto, 1 pergunta),
e-mail (assunto + pré-header + corpo), Instagram DM, roteiro de ligação e CTA.
Usa nome, cidade, segmento e sinais públicos do lead + um produto específico.
Tipos: `first_touch`, `followup`, `reply`, `quote`.

### Analyst
Recebe as métricas agregadas (leads, respostas, conversões por segmento/cidade)
e devolve 3–6 insights priorizados: título, observação baseada nos números e
recomendação prática.

Todas as execuções são registradas em `ai_runs` (tokens, custo, duração) e
aparecem em `Agentes de IA`.
