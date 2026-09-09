/**
 * Classificação de um resultado de busca. Funções puras.
 *
 * `result_type` é um HARD FILTER: só `business` pode virar lead. Tudo o mais
 * (evento, associação, órgão público, diretório, lista, artigo, portal de
 * empreendedorismo) é descartado antes de qualquer score.
 */
import { hostOf } from "./extract";
import type { BusinessType, ResultType } from "./types";

// ── Sinais por categoria (título + conteúdo, minúsculo) ────────────────────
const GOVERNMENT = [
  "secretaria municipal", "secretaria de", "prefeitura", "governo do estado",
  "governo municipal", "ministério", "câmara municipal", "câmara de vereadores",
  "sala do empreendedor", "casa do empreendedor", "espaço do empreendedor",
  "sebrae", "junta comercial", "receita federal", "detran", "ibge",
];
const ASSOCIATION = [
  "associação", "associacao", "sindicato", "federação", "federacao",
  "cooperativa", "conselho regional", "conselho de classe", "aciar", "acip",
  "câmara de dirigentes", "cdl ", "instituto ", "fundação", "fundacao", "ong ",
];
const EVENT = [
  "feira", "feirinha", "feiarte", "expo", "exposição", "exposicao", "festival",
  "mostra de", "salão de", "salao de", "encontro de", "workshop", "palestra",
  "inscrições abertas", "inscricoes abertas", "programação", "programacao",
  "edição 20", "edicao 20", "1ª edição", "2ª edição", "evento",
];
const COMMUNITY = [
  "espaço empreendedor", "espaco empreendedor", "mais negócios", "mais negocios",
  "hub de", "comunidade de", "rede de empreendedores", "portal do empreendedor",
  "coworking", "aceleradora", "incubadora", "movimento ", "clube de",
  "grupo de empreendedores",
];
const DIRECTORY = [
  "guia de empresas", "guia comercial", "lista de empresas", "encontre empresas",
  "catálogo de empresas", "catalogo de empresas", "empresas em ", "cnpj de",
  "telefone e endereço de", "onde encontrar",
];
const ARTICLE = [
  "como fazer", "o que é", "o que e", "passo a passo", "guia completo",
  "guia definitivo", "tutorial", "dicas para", "saiba como", "entenda",
  "significado de", "vale a pena", "resenha", "review", "blog", "notícia",
  "noticia", "por que ", "confira ", "veja como",
];
const LISTICLE_RE =
  /^(top\s*)?\d+\s+(melhores|piores|dicas|passos|motivos|ideias|maneiras|formas|marcas|empresas|lojas|padarias|confeitarias|restaurantes|opções|opcoes)/i;

const CONTENT_HOSTS = [
  "g1.globo.com", "globo.com", "uol.com.br", "terra.com.br", "r7.com",
  "estadao.com.br", "folha.uol.com.br", "metropoles.com", "gazetadopovo.com.br",
  "wikipedia.org", "medium.com", "blogspot.com", "wordpress.com", "substack.com",
  "tripadvisor.com", "reclameaqui.com.br", "jusbrasil.com.br",
];
const DIRECTORY_HOSTS = [
  "telelistas.net", "apontador.com.br", "guiamais.com.br", "solutudo.com.br",
  "encontracuritiba.com.br", "hotfrog.com.br", "econodata.com.br", "cnpj.biz",
  "consultasocio.com", "empresascnpj", "guiafacil", "listou", "boavista",
];
const MARKETPLACE_HOSTS = [
  "mercadolivre.com.br", "elo7.com.br", "olx.com.br", "shopee.com.br",
  "amazon.com", "magazineluiza.com.br", "americanas.com", "ifood.com.br",
];
const SOCIAL_HOSTS = [
  "instagram.com", "facebook.com", "linkedin.com", "twitter.com", "x.com",
  "youtube.com", "tiktok.com",
];

function has(text: string, list: string[]): boolean {
  return list.some((s) => text.includes(s));
}
function hostIn(host: string, list: string[]): boolean {
  return list.some((h) => host === h || host.endsWith(`.${h}`) || host.includes(h));
}

export interface Classification {
  resultType: ResultType;
  businessType: BusinessType;
  sourceQuality: number;
  reason: string;
}

export function classifyResult(hit: {
  title: string;
  url: string;
  content: string;
}): Classification {
  const host = hostOf(hit.url);
  const title = hit.title.toLowerCase().trim();
  const text = `${title}\n${hit.content}`.toLowerCase();

  // ── HARD: categorias que nunca são lead ────────────────────────────────
  if (host.endsWith(".gov.br") || host.endsWith(".jus.br") || has(text, GOVERNMENT))
    return notBusiness("government", "Órgão público / programa governamental");
  if (LISTICLE_RE.test(title) || has(text, DIRECTORY) || hostIn(host, DIRECTORY_HOSTS))
    return notBusiness("directory", "Lista / diretório de empresas");
  if (has(text, EVENT))
    return notBusiness("event", "Evento / feira");
  if (has(text, ASSOCIATION))
    return notBusiness("association", "Associação / sindicato / instituto");
  if (has(text, COMMUNITY))
    return notBusiness("community", "Comunidade / portal de empreendedorismo");
  if (hostIn(host, CONTENT_HOSTS) || has(title, ARTICLE))
    return notBusiness("article", "Conteúdo editorial / notícia / blog");
  if (hostIn(host, MARKETPLACE_HOSTS))
    return notBusiness("directory", "Página de marketplace genérico");

  // ── É um negócio: que tipo? ────────────────────────────────────────────
  const businessType = detectBusinessType(text);
  const isSocial = hostIn(host, SOCIAL_HOSTS);
  const ownDomain = host && !isSocial && !hostIn(host, [...CONTENT_HOSTS, ...DIRECTORY_HOSTS]);

  let sourceQuality = 50;
  if (ownDomain) sourceQuality = 100;
  else if (host.includes("instagram.com") || host.includes("facebook.com")) sourceQuality = 70;
  else if (isSocial) sourceQuality = 55;

  return {
    resultType: "business",
    businessType,
    sourceQuality,
    reason: ownDomain
      ? "Site próprio de um negócio"
      : "Perfil comercial em rede social",
  };
}

function notBusiness(resultType: ResultType, reason: string): Classification {
  return { resultType, businessType: "unknown", sourceQuality: 10, reason };
}

// ── Concorrente / fornecedor do mesmo produto ────────────────────────────
const SUPPLIER_VERBS = [
  "fabricamos", "produzimos", "confeccionamos", "imprimimos", "orçamento de",
  "orcamento de", "sob encomenda", "trabalhamos com impressão",
  "trabalhamos com impressao", "especializada em impressão", "produção de",
  "producao de", "gráfica especializada", "grafica especializada",
  "fábrica de", "fabrica de", "fornecemos", "atacado de",
];

export interface CompetitorCheck {
  competitor: boolean;
  reason?: string;
}

/**
 * `excludedProfiles` vem do perfil de comprador (derivado do produto): quem
 * FABRICA/VENDE o mesmo produto. Se o resultado bate com isso como atividade
 * principal, é concorrente/fornecedor — nunca vira lead.
 */
export function detectCompetitor(
  hit: { title: string; url: string; content: string },
  excludedProfiles: string[],
  productKeywords: string[],
): CompetitorCheck {
  const title = norm(hit.title);
  const text = norm(`${hit.title} ${hit.content}`.slice(0, 400));
  const host = norm(hostOf(hit.url));

  const ex = excludedProfiles.map(norm).filter((s) => s.length > 3);
  const pk = productKeywords.map(norm).filter((s) => s.length > 3);

  // perfil de exclusão no título ou no domínio = concorrente direto
  const hitInTitle = ex.find((e) => title.includes(e) || host.includes(e.replace(/\s+/g, "")));
  if (hitInTitle)
    return { competitor: true, reason: `Perfil de fornecedor/concorrente ("${hitInTitle}")` };

  // keyword do produto + verbo de fornecedor no texto = concorrente
  const kwHit = pk.find((k) => text.includes(k));
  const verbHit = SUPPLIER_VERBS.map(norm).find((v) => text.includes(v));
  if (kwHit && verbHit)
    return {
      competitor: true,
      reason: `Oferece o mesmo produto como serviço ("${verbHit} ... ${kwHit}")`,
    };

  return { competitor: false };
}

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const BUSINESS_TYPE_HINTS: [BusinessType, string[]][] = [
  ["confectionery", ["confeitaria", "confeitaria", "doceria", "doces", "bolo", "brigadeiro", "cupcake", "docinho", "confeiteira", "confeiteiro"]],
  ["bakery", ["padaria", "panificadora", "pães", "paes", "panificação"]],
  ["soap_brand", ["saboaria", "sabonete", "sabão artesanal", "sabao artesanal"]],
  ["candle_brand", ["vela artesanal", "velas artesanais", "vela aromática", "velas aromaticas", "aromatizador"]],
  ["cosmetics_brand", ["cosmético", "cosmetico", "maquiagem", "skincare", "perfumaria", "beleza natural", "dermocosm"]],
  ["restaurant", ["restaurante", "lanchonete", "hamburgueria", "pizzaria", "bar ", "bistrô", "bistro", "cafeteria", "café "]],
  ["manufacturer", ["fábrica", "fabrica", "fabricante", "indústria", "industria", "confecção", "confeccao"]],
  ["artisan_business", ["ateliê", "atelie", "artesanal", "artesanato", "feito à mão", "feito a mao", "handmade", "artesã", "artesao"]],
  ["store", ["loja", "boutique", "empório", "emporio", "mercearia", "papelaria"]],
  ["brand", ["marca de", "nossa marca", "linha própria", "linha propria"]],
];

function detectBusinessType(text: string): BusinessType {
  for (const [type, hints] of BUSINESS_TYPE_HINTS) {
    if (has(text, hints)) return type;
  }
  return "company";
}
