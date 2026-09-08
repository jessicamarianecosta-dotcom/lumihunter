import type { CatalogProvider } from "../types";
import { mockCatalogProvider } from "./mock";

/**
 * Registry de provedores de catálogo externo.
 *
 * Enquanto não houver um provedor REAL confirmado, `resolveProvider` devolve o
 * mock apenas quando explicitamente pedido (`CATALOG_PROVIDER=mock` ou config
 * da fonte com `provider: "mock"`), e `null` caso contrário — para que nenhuma
 * rota trate o mock como integração de verdade sem intenção.
 */
const REGISTRY: Record<string, CatalogProvider> = {
  mock: mockCatalogProvider,
  // precy: precyCatalogProvider,  // adicionar quando a conexão real for aprovada
};

export function resolveProvider(id: string | null | undefined): CatalogProvider | null {
  if (!id) return null;
  return REGISTRY[id] ?? null;
}

export function hasRealProvider(id: string | null | undefined): boolean {
  const p = resolveProvider(id);
  return !!p && p.isReal;
}

export { mockCatalogProvider };
