import type { CatalogProvider } from "../types";
import { mockCatalogProvider } from "./mock";
import { precyCatalogProvider } from "./precy";

/**
 * Registry de provedores de catálogo externo.
 *
 * - `precy`: integração REAL (PostgREST público do Precy+). Registrada quando
 *   `precyCatalogProvider.isReal` (padrão: ligado, salvo `PRECY_ENABLED=false`
 *   ou sem anon key). A decisão de CONSULTAR é por empresa: só se a empresa
 *   tiver uma fonte `precy_online` conectada.
 * - `mock`: só quando explicitamente pedido (`provider: "mock"`), nunca tratado
 *   como integração real.
 */
const REGISTRY: Record<string, CatalogProvider> = {
  mock: mockCatalogProvider,
  ...(precyCatalogProvider.isReal ? { precy: precyCatalogProvider } : {}),
};

export function resolveProvider(id: string | null | undefined): CatalogProvider | null {
  if (!id) return null;
  return REGISTRY[id] ?? null;
}

export function hasRealProvider(id: string | null | undefined): boolean {
  const p = resolveProvider(id);
  return !!p && p.isReal;
}

/** Provider para "Testar conexão" na UI — devolve mesmo que não esteja no registry. */
export function providerForTest(id: string | null | undefined): CatalogProvider | null {
  if (id === "precy") return precyCatalogProvider;
  if (id === "mock") return mockCatalogProvider;
  return null;
}

export { mockCatalogProvider, precyCatalogProvider };
