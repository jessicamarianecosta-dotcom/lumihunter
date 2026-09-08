# Base Comercial — Produtos & Serviços consultável pelos agentes

> Status: **Etapa 1** (estrutura de dados + camada de consulta). As migrations
> ainda **não foram aplicadas** — ver "Aplicar" no fim.

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

## Aplicar (quando aprovado)

```bash
# 1. revisar supabase/migrations/20260908210000_base_comercial.sql
# 2. aplicar
npm run db:push
# 3. regerar tipos e remover o bloco manual de database.types.ts / o db.ts isolado
npm run db:types
```

Pontos a validar ao aplicar: operador `%` do `pg_trgm` e `unaccent` schema-
qualificados dentro da RPC `security invoker` (search_path do papel `authenticated`
no Supabase inclui `extensions`, então deve funcionar; confirmar).
