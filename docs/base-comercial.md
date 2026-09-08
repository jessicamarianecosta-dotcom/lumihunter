# Base Comercial — Produtos & Serviços consultável pelos agentes

> Status: **em produção**. Migration `20260908210000_base_comercial.sql`
> aplicada; tipos regerados (`database.generated.ts`); o client tipado isolado
> `src/lib/catalog/db.ts` foi removido — a camada usa `createAdminClient()`.
> Análise técnica do Precy+: `docs/precy-integracao.md`.

## Objetivo

Transformar o módulo Produtos & Serviços numa base que os agentes de IA
consultam **antes** de responder qualquer coisa sobre produto, preço, material,
gramatura, medida, acabamento, quantidade, prazo ou disponibilidade — para que
a IA **nunca invente** informação comercial.

Três fontes possíveis, por empresa:

| Prioridade | Fonte | Estado |
| --- | --- | --- |
| 1 (maior) | `precy_online` — catálogo externo Precy+ | **interface + mock** (conexão real pendente de decisão) |
| 2 | `pdf` — catálogo PDF importado pela empresa | estrutura pronta; processamento vem na Etapa 3 |
| 3 | `manual` — cadastro no LumiHunter | já existia; agora com proveniência |

Conflito **direto** de preço → vence a fonte de maior prioridade. Campos
**complementares** de uma fonte de menor prioridade **não são apagados**
(ver `mergeProductSources` em `src/lib/catalog/resolve.ts`).

## Estrutura de dados (migration `20260908210000_base_comercial.sql`)

- `products` ganha: `source`, `external_source`, `external_id`, `external_url`,
  `last_synced_at`, `needs_review`, `search_text` (coluna gerada p/ busca).
- `catalog_sources` — 1 linha por fonte por empresa (status, arquivo, URL,
  contadores de sync, `config` jsonb — credenciais vão para o Vault, nunca aqui).
- `product_variation_groups` → `product_variation_options` → `product_variants`
  (+ `option_ids[]` e `attributes` jsonb). Modelo flexível: os grupos são livres
  ("Papel", "Sabor", "Fragrância", "Material"), então serve gráfica, confeitaria,
  velas, artesanato etc.
- `product_variants` suporta preço `fixed | per_unit | per_quantity | quote`
  (com `price_tiers` jsonb para faixas de quantidade).
- `catalog_import_jobs` — histórico + prévia dos itens extraídos de PDF, para
  revisão antes de virarem produtos definitivos.
- `catalog_events` — observabilidade (sem dados sensíveis).
- RPC `search_commercial_catalog(company_id, query, limit)` — busca textual
  trigram + ilike, sem acento (`pg_trgm` + `unaccent`).

Todas as tabelas novas são company-scoped e usam `apply_tenant_rls` — mesmo
isolamento das tabelas existentes.

## Camada `src/lib/catalog/`

| Arquivo | Papel |
| --- | --- |
| `types.ts` | `CommercialProduct`, `CommercialVariant`, `SearchOutcome` (FOUND / PARTIAL / AMBIGUOUS / NOT_FOUND / SOURCE_UNAVAILABLE), interface `CatalogProvider` |
| `db.ts` | client Supabase tipado só para as tabelas novas (isola os tipos até regerar `database.generated.ts`) |
| `resolve.ts` | funções **puras**: prioridade de fontes, conflito de preço, merge, classificação semântica da busca |
| `search.ts` | `searchCatalog()` — lê o banco, monta `CommercialProduct`, classifica |
| `providers/mock.ts` | `MockCatalogProvider` — **não é integração real**, nunca ativo em produção |
| `index.ts` | `buildCommercialContext()` (texto pronto p/ prompt) + `ANTI_INVENTION_RULE` |

Os agentes de IA importam **apenas** de `src/lib/catalog` — nunca falam com uma
fonte direto.

## Precy+ — o que a análise técnica encontrou (Fase 0)

`https://precyplus.com.br/loja/lumilife` é um Next.js que lê o **PostgREST do
Supabase do Precy+** direto do navegador, com anon key pública, RLS filtrando
`is_published_catalog=true`. Tabelas: `products` (+ `catalog_*`),
`product_images`, `product_variation_groups`/`_options`, `product_variants`,
`product_variation_dependencies`. IDs são UUID estáveis.

**Decisão atual:** implementar só a interface + mock. A conexão real (usar o
anon key público deles ou pedir um endpoint dedicado) fica para uma etapa
posterior, após confirmação.

## Interface (Etapa 2)

`/produtos` → seção **"Fontes do catálogo"** (`src/components/produtos/catalog-sources.tsx`):
- **Cadastro manual** — contador.
- **Catálogo PDF** — `PdfImportDialog`: upload (valida MIME/tamanho, `CATALOG_PDF_MAX_MB`),
  guarda em `catalogs/<company_id>/`, cria `catalog_import_jobs`, extrai
  (`src/lib/catalog/pdf.ts` — Anthropic com leitura nativa de PDF; sem chave =
  extração de exemplo para o fluxo de revisão), **prévia com checkbox por item**
  (itens ambíguos marcados "revisar" e desmarcados por padrão), "Importar" cria
  products + variações + variantes com `source='pdf'`.
- **Catálogo online (Precy+)** — `PrecySourceCard`: campo de URL (salva em
  `catalog_sources`), **Testar conexão** (`/api/catalog/precy/test`),
  **Sincronizar** (`/api/catalog/precy/sync` — responde 501 "confirmação pendente"
  até `PRECY_ENABLED`), **Abrir catálogo**.

Se a migration não estiver aplicada, a seção mostra um aviso em vez de quebrar.

Rotas: `POST /api/catalog/pdf/upload`, `GET|POST /api/catalog/pdf/jobs/[id]`,
`POST /api/catalog/precy/{test,sync}`.

## Extração de PDF estruturada (Etapa 3) — `src/lib/catalog/extract.ts`

- Schema **zod** (`ExtractionSchema`) para a saída do modelo. Saída fora do
  schema → job vai para `error`, **nada é importado**.
- Prompt exige: `attributes` do produto (chaves naturais do ramo — não força
  "gramatura" onde é "peso"), `variationGroups` nomeados (ex.: "Gramatura",
  "Impressão"), `variants` com `options` grupo→valor **e** preço, e tabela de
  quantidade do mesmo item como `priceKind:"per_quantity"` + `priceTiers`
  (não vira N produtos).
- `normalizeItem` força `needsReview` mesmo com JSON válido quando: variante sem
  preço e não-`quote`; grupo declarado sem variante associada; produto sem
  variação. Nunca inventa a relação.
- `applyImportJob` cria **grupos/opções nomeados** (não mais um único "Opções")
  preservando grupo→valor→preço; grava `price_tiers` em `product_variants`.
- Sem chave de IA: `demoExtraction()` — sintética, marcada como tal na UI de
  revisão ("não represente como catálogo real").
- Tela de revisão mostra atributos, grupos de variação, cada variante com preço
  (fixo ou tiers) e quantidade mínima; itens `review` desmarcados por padrão.

## Base Comercial ↔ agentes (Etapa 5)

**Agente ligado: Sales Coach** (`src/lib/anthropic/agents/sales-coach.ts`) — é o
único agente conversacional/atendimento. Hunter/Qualifier/Copywriter são de
prospecção e ficam fora deste escopo.

Fluxo: última mensagem do lead → se parece pergunta comercial
(`COMMERCIAL_HINT`) → `buildCommercialContext({companyId, message})`:
`deriveCommercialQuery` (puro) extrai termo + especificações → `searchCatalog`
(filtra `company_id`) → `renderCommercialContext(outcome)` (puro, compacto, só os
≤4 produtos relevantes, não despeja o catálogo).

- O bloco "BASE COMERCIAL" entra no `userPrompt` e o `ANTI_INVENTION_RULE` entra
  no `system` **só quando há contexto comercial**.
- `SearchOutcome.kind` guia o tom: FOUND / PARTIAL (pergunta só o que falta) /
  AMBIGUOUS (mostra opções, não escolhe) / NOT_FOUND ("vou verificar") /
  SOURCE_UNAVAILABLE ("encaminhar para atendimento"). O `kind` volta em
  `SalesCoachResult.catalog_outcome`.
- Modo demo respeita a mesma regra (sugestões condicionadas ao `outcome`).
- Base indisponível (migration não aplicada) → o agente segue **sem** a seção,
  como antes.

Prioridade de fontes (precy > pdf > manual), conflito de preço e merge sem
apagar complementares: `src/lib/catalog/resolve.ts` (puro, testado).

## Migration (já aplicada)

`20260908210000_base_comercial.sql` — só aditiva:
- `products` +`source`/`external_source`/`external_id`/`external_url`/
  `last_synced_at`/`needs_review`/`search_text` (coluna simples mantida pelo
  trigger `products_search_text_sync`; backfill feito).
- Extensões `pg_trgm` e `unaccent` no schema `extensions`.
- Tabelas `catalog_sources`, `product_variation_groups`, `_options`,
  `product_variants`, `catalog_import_jobs`, `catalog_events` — RLS via
  `apply_tenant_rls` (4 políticas cada, `company_id`).
- RPC `search_commercial_catalog(company_id, query, limit)` — `security invoker`,
  `SET search_path = public, extensions`, busca por palavras (sem acento) +
  bônus trigram. Verificado: `Cartão de visita` ranqueia no topo; isolamento
  entre empresas OK (0 vazamento cross-tenant).
