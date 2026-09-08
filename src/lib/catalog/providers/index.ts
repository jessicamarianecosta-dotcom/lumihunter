import type { CatalogProvider } from "../types";
import { mockCatalogProvider } from "./mock";
import { precyCatalogProvider } from "./precy";

/**
 * Registry de provedores de catálogo externo.
 *
 * - `mock`: só quando explicitamente pedido (nunca tratado como integração real).
 * - `precy`: só entra quando `PRECY_ENABLED=true` E o método de acesso ao
 *   catálogo online do Precy+ estiver confirmado (ver `providers/precy.ts`).
 *   Enquanto `isReal` for false, `resolveProvider("precy")` devolve `null`.
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

/** Provider usado só para "Testar conexão" na UI, mesmo antes de habilitar o sync. */
export function providerForTest(id: string | null | undefined): CatalogProvider | null {
  if (id === "precy") return precyCatalogProvider;
  if (id === "mock") return mockCatalogProvider;
  return null;
}

export { mockCatalogProvider, precyCatalogProvider };
