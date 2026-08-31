/**
 * Enriquecimento de empresa por CNPJ via BrasilAPI (dados públicos da Receita).
 * Sem chave, com fallback silencioso.
 */

export interface CnpjData {
  cnpj: string;
  legal_name: string | null;
  trade_name: string | null;
  segment: string | null;
  status: string | null;
  opened_at: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipcode: string | null;
  phone: string | null;
  email: string | null;
  main_activity: string | null;
}

export function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}

export function isValidCnpj(v: string) {
  return onlyDigits(v).length === 14;
}

interface BrasilApiCnpj {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  cnae_fiscal_descricao?: string;
  descricao_situacao_cadastral?: string;
  data_inicio_atividade?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  ddd_telefone_1?: string;
  email?: string;
}

export async function fetchCnpj(raw: string): Promise<CnpjData | null> {
  const cnpj = onlyDigits(raw);
  if (cnpj.length !== 14) return null;

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    const d = (await res.json()) as BrasilApiCnpj;

    const addr = [d.logradouro, d.numero, d.complemento, d.bairro]
      .filter(Boolean)
      .join(", ");

    return {
      cnpj,
      legal_name: d.razao_social ?? null,
      trade_name: d.nome_fantasia || d.razao_social || null,
      segment: d.cnae_fiscal_descricao ?? null,
      status: d.descricao_situacao_cadastral ?? null,
      opened_at: d.data_inicio_atividade ?? null,
      address: addr || null,
      city: d.municipio ?? null,
      state: d.uf ?? null,
      zipcode: d.cep ? onlyDigits(d.cep) : null,
      phone: d.ddd_telefone_1 ? onlyDigits(d.ddd_telefone_1) : null,
      email: d.email ? d.email.toLowerCase() : null,
      main_activity: d.cnae_fiscal_descricao ?? null,
    };
  } catch {
    return null;
  }
}
