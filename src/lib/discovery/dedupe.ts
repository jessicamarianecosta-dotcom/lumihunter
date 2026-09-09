/**
 * Deduplicação de empresas descobertas. Função pura.
 *
 * Chave, em ordem de confiança:
 *   1. domínio do site (sem www)
 *   2. telefone/WhatsApp normalizado
 *   3. slug(nome) + "|" + slug(cidade)
 */
import { slugify } from "@/lib/utils";
import { hostOf } from "./extract";

export function dedupeKeyFor(input: {
  website: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  companyName: string;
  city: string | null;
}): string {
  const domain = input.website ? hostOf(input.website) : "";
  if (domain) return `domain:${domain}`;

  const phone = (input.whatsapp ?? input.phone ?? "").replace(/\D/g, "");
  if (phone.length >= 10) return `phone:${phone}`;

  if (input.instagram) {
    const handle = input.instagram
      .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
      .replace(/\/.*$/, "")
      .toLowerCase();
    if (handle) return `ig:${handle}`;
  }

  const name = slugify(input.companyName).split("-").slice(0, 4).join("-");
  const city = input.city ? slugify(input.city) : "";
  return `name:${name}|${city}`;
}

/**
 * Junta duplicados dentro de um lote: mantém o primeiro e completa buracos com
 * os seguintes (não apaga informação legítima).
 */
export function mergeByDedupeKey<
  T extends {
    dedupeKey: string;
    description: string | null;
    city: string | null;
    state: string | null;
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
    website: string | null;
    instagram: string | null;
  },
>(items: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of items) {
    const existing = map.get(item.dedupeKey);
    if (!existing) {
      map.set(item.dedupeKey, item);
      continue;
    }
    map.set(item.dedupeKey, {
      ...existing,
      description: existing.description ?? item.description,
      city: existing.city ?? item.city,
      state: existing.state ?? item.state,
      phone: existing.phone ?? item.phone,
      whatsapp: existing.whatsapp ?? item.whatsapp,
      email: existing.email ?? item.email,
      website: existing.website ?? item.website,
      instagram: existing.instagram ?? item.instagram,
    });
  }
  return [...map.values()];
}
