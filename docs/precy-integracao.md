# Integração com o catálogo online do Precy+ — análise técnica

> Base: inspeção de `https://precyplus.com.br/loja/lumilife` (HTML, bundles JS,
> tráfego de rede do próprio site). Nenhuma credencial nossa envolvida.

## Plataforma

- **Next.js (App Router)** em `www.precyplus.com.br`. Rotas:
  `/loja/[slug]` (vitrine) e `/loja/[slug]/produto/[productId]`.
- Backend: **Supabase** — projeto `ekynvecruqpuwwrcwtnp` (≠ do LumiHunter).
- Metadata do site: *"Sistema de Gestão e Precificação para Pequenos Negócios"*.

## Como os dados são disponibilizados

| Página | Origem dos dados |
| --- | --- |
| **Vitrine** `/loja/lumilife` | Renderizada **no servidor do Precy+** (RSC streaming). A query "produtos publicados da loja X" **não** aparece no cliente. |
| **Produto** `/loja/lumilife/produto/<uuid>` | Buscado **no navegador**, direto no **PostgREST público do Supabase do Precy+**, com **anon key** embutida no bundle (`_next/static/chunks/9990-*.js`), role `anon`, protegida por **RLS** (`is_published_catalog = true`). |

### Endpoints observados (página de produto)

Todos `GET https://ekynvecruqpuwwrcwtnp.supabase.co/rest/v1/…`, header
`apikey: <anon key>`:

```
products
  ?select=id,name,description,final_price,catalog_starting_price,
          catalog_promo_price,catalog_photos,catalog_lead_time_days,
          catalog_checkout_mode,catalog_category_id
  &id=eq.<uuid>&is_published_catalog=eq.true

product_images
  ?select=id,url,sort_order&product_id=eq.<uuid>&order=sort_order.asc

product_variation_groups
  ?select=id,name,sort_order,
          product_variation_options(id,group_id,value,sort_order)
  &product_id=eq.<uuid>&order=sort_order.asc

product_variants
  ?select=id,sku,price,stock_quantity,lead_time_days,image_id,sort_order,
          product_variant_option_values(option_id,group_id)
  &product_id=eq.<uuid>&is_active=eq.true&order=sort_order.asc

product_variation_dependencies
  ?select=option_id,depends_on_option_id&product_id=eq.<uuid>
```

### Modelo de dados

```
products
  id (uuid, estável)          name, description
  final_price                 preço "cheio"
  catalog_starting_price      "a partir de"
  catalog_promo_price         promoção (quando há)
  catalog_photos (text[])     URLs no Storage
  catalog_lead_time_days      prazo
  catalog_checkout_mode       ex.: "quote" → botão "Solicitar orçamento"
  catalog_category_id         FK categoria (nome não exposto ainda)
  is_published_catalog        RLS: só true é visível ao anon

product_images            id, url, sort_order, product_id
product_variation_groups  id, name ("Acabamento capa"), sort_order, product_id
  product_variation_options  id, group_id, value ("Fosco"|"Brilho"|…), sort_order
product_variants          id, sku, price, stock_quantity, lead_time_days,
                          image_id, sort_order, is_active, product_id
  product_variant_option_values  (variant) option_id, group_id
product_variation_dependencies  product_id, option_id, depends_on_option_id
```

Observado no produto "Caderno A5": 3 opções de acabamento → 3 variantes, 2 com
`price: null` e 1 com `price: 33.00`. Base do produto: R$ 30,00. Fotos no bucket
público `catalog-photos`, path `<owner_id>/<produto_id>/<arquivo>.webp`
(owner da loja LumiLife: `d8849d4d-5d09-4c87-b6df-44d1f0d8b7ad`).

## Estado da integração no LumiHunter

`src/lib/catalog/providers/precy.ts` — **desligado** (`PRECY_ENABLED != true`),
não registrado no registry enquanto `isReal` for false.

| Método | Estado |
| --- | --- |
| `parseStoreSlug(url)` | ✅ |
| `testConnection()` | ✅ valida a URL; com key faz ping no PostgREST |
| `getProduct(externalId)` | ✅ mapeamento pronto (endpoints acima → `ProviderProduct`) |
| `listProducts()` | ⛔ **falta confirmar** como listar os produtos publicados de uma loja (a vitrine é server-side; não há query cliente). |

## O que falta confirmar com o Precy+ antes de ligar o sync real

1. **É suportado** consumir o PostgREST público com a anon key deles a partir de
   outro domínio? (CORS/rate limit). Ou eles preferem um endpoint dedicado?
2. **Listagem por loja**: qual a coluna que liga `products` à loja/dono
   (`user_id`? `store_id`?) e a RLS permite `GET products?<coluna>=eq.<id>&is_published_catalog=eq.true`?
   Ou como resolver `slug → id da loja`.
3. Nome da tabela de **categorias** (`catalog_category_id` → `catalog_categories`?).
4. Existência de **webhooks** de alteração de produto/preço.

Com (1) e (2) respondidos, ligar o sync é: `PRECY_ENABLED=true` +
`PRECY_SUPABASE_ANON_KEY=…` + implementar `listProducts()` (o resto — mapeamento,
upsert por `external_id`, diff — já está pronto na camada `src/lib/catalog`).
