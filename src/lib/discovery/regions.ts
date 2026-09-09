/**
 * Expansão de região para descoberta em escala. Função pura.
 *
 * "Curitiba" sozinho vira uma consulta e para. Aqui a cidade grande é quebrada
 * em bairros/regiões reais para AUMENTAR O RECALL — cada bairro rende novas
 * empresas individuais que a busca por "cidade" nunca alcança.
 *
 * O mapa cobre as capitais/cidades onde o cliente atua. Cidade fora do mapa:
 * devolve a própria região (sem inventar bairro).
 */

/** Bairros/regiões por cidade — curado, não exaustivo. Chave sem acento, minúscula. */
const CITY_DISTRICTS: Record<string, string[]> = {
  curitiba: [
    "Centro", "Batel", "Água Verde", "Portão", "Boqueirão", "Sítio Cercado",
    "Pinheirinho", "CIC", "Santa Felicidade", "Cabral", "Xaxim", "Hauer",
    "Cajuru", "Bairro Alto", "Boa Vista", "Rebouças", "Bigorrilho", "Uberaba",
  ],
  "sao paulo": [
    "Centro", "Pinheiros", "Vila Mariana", "Moema", "Tatuapé", "Santana",
    "Lapa", "Itaim Bibi", "Mooca", "Butantã", "Santo Amaro", "Vila Prudente",
    "Ipiranga", "Perdizes", "Brooklin", "Barra Funda",
  ],
  "rio de janeiro": [
    "Centro", "Copacabana", "Tijuca", "Barra da Tijuca", "Botafogo", "Méier",
    "Campo Grande", "Bangu", "Madureira", "Ipanema", "Jacarepaguá", "Leblon",
  ],
  "belo horizonte": [
    "Centro", "Savassi", "Barreiro", "Pampulha", "Venda Nova", "Contagem",
    "Cidade Nova", "Buritis", "Santa Efigênia", "Prado",
  ],
  "porto alegre": [
    "Centro Histórico", "Moinhos de Vento", "Cidade Baixa", "Menino Deus",
    "Petrópolis", "Partenon", "Restinga", "Zona Norte", "Cristal",
  ],
  joinville: ["Centro", "América", "Bucarein", "Glória", "Costa e Silva", "Boa Vista", "Vila Nova"],
  londrina: ["Centro", "Gleba Palhano", "Vila Nova", "Zona Sul", "Zona Norte", "Cambé"],
  maringa: ["Centro", "Zona 7", "Novo Centro", "Jardim Alvorada", "Zona Sul"],
  florianopolis: ["Centro", "Trindade", "Ingleses", "Campeche", "Estreito", "Lagoa da Conceição"],
  cascavel: ["Centro", "Região do Lago", "Coqueiral", "Pioneiros Catarinenses", "Brasília"],
};

function normCity(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface RegionUnit {
  /** Termo de região pronto para a consulta, ex.: "Batel, Curitiba". */
  label: string;
  /** Cidade base. */
  city: string;
  /** Bairro/sub-região, quando houver. */
  district: string | null;
}

/**
 * Expande as regiões da campanha. A primeira unidade de cada cidade é sempre a
 * cidade "inteira" (não perde a busca ampla); as seguintes são bairros.
 */
export function expandRegions(regions: string[], maxUnits = 16): RegionUnit[] {
  const units: RegionUnit[] = [];
  const seen = new Set<string>();

  const push = (u: RegionUnit) => {
    const k = normCity(u.label);
    if (seen.has(k)) return;
    seen.add(k);
    units.push(u);
  };

  for (const raw of regions) {
    const city = raw.replace(/\s+/g, " ").trim();
    if (!city) continue;
    // "Bairro, Cidade" informado à mão → respeita
    push({ label: city, city, district: null });

    const districts = CITY_DISTRICTS[normCity(city.split(/[,\/]/)[0])];
    if (districts) {
      for (const d of districts) {
        push({ label: `${d}, ${city}`, city, district: d });
      }
    }
  }

  return units.slice(0, Math.max(1, maxUnits));
}

/** true se a região tem subdivisão conhecida (cidade grande). */
export function hasKnownDistricts(region: string): boolean {
  return !!CITY_DISTRICTS[normCity(region.split(/[,\/]/)[0])];
}
