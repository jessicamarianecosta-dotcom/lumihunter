/**
 * MockCatalogProvider — placeholder para desenvolvimento e testes.
 *
 * ⚠️  NÃO é uma integração real. Nunca deve ser retornado pelo registry em
 * produção. A análise técnica de `https://precyplus.com.br/loja/lumilife`
 * (Fase 0) mostrou que o Precy+ expõe os produtos via PostgREST público do
 * Supabase, mas a decisão do projeto foi implementar apenas a interface +
 * este mock por ora, e conectar a fonte real depois.
 */
import type {
  CatalogProvider,
  CatalogProviderConfig,
  ProviderProduct,
} from "../types";

const FIXTURE: ProviderProduct[] = [
  {
    externalId: "mock-cartao-visita",
    name: "Cartão de visita",
    url: null,
    description: "Cartão de visita impresso, arte pronta.",
    category: "Gráfica",
    basePrice: 35,
    startingPrice: null,
    promoPrice: null,
    leadTimeDays: 3,
    checkoutMode: "quote",
    photoUrls: [],
    variationGroups: [
      {
        externalId: "g-papel",
        name: "Papel",
        options: [
          { externalId: "o-couche250", value: "Couché 250g" },
          { externalId: "o-couche300", value: "Couché 300g" },
        ],
      },
      {
        externalId: "g-impressao",
        name: "Impressão",
        options: [
          { externalId: "o-frente", value: "Frente" },
          { externalId: "o-fv", value: "Frente e verso" },
        ],
      },
    ],
    variants: [
      {
        externalId: "v-1",
        sku: "CV-C250-FV-100",
        price: 39,
        stockQuantity: null,
        leadTimeDays: 3,
        optionExternalIds: ["o-couche250", "o-fv"],
      },
      {
        externalId: "v-2",
        sku: "CV-C250-F-100",
        price: 32,
        stockQuantity: null,
        leadTimeDays: 3,
        optionExternalIds: ["o-couche250", "o-frente"],
      },
    ],
  },
];

export const mockCatalogProvider: CatalogProvider = {
  id: "mock",
  isReal: false,

  async testConnection(_config: CatalogProviderConfig) {
    return {
      ok: false,
      message:
        "Provedor mock: sem conexão real. A sincronização automática com o catálogo online depende de uma integração oficial ou método suportado pelo Precy+.",
    };
  },

  async listProducts(_config: CatalogProviderConfig) {
    return structuredClone(FIXTURE);
  },

  async getProduct(_config: CatalogProviderConfig, externalId: string) {
    return structuredClone(FIXTURE.find((p) => p.externalId === externalId) ?? null);
  },
};
