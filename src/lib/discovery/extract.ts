/**
 * Normalização dos resultados brutos → empresa candidata. Funções puras.
 *
 * REGRA: só usa o que está no resultado (título, URL, trecho). Nunca inventa
 * nome, telefone, cidade, site. Campo sem evidência = null.
 */
import { normalizePhoneBR } from "@/lib/utils";
import type { RawDiscoveryHit } from "./types";

// ── Domínios que NÃO são o site de uma empresa-alvo ────────────────────────
const SOCIAL_HOSTS = ["instagram.com", "facebook.com", "linkedin.com", "twitter.com", "x.com", "youtube.com", "tiktok.com", "wa.me", "api.whatsapp.com"];

const CONTENT_OR_DIRECTORY_HOSTS = [
  // notícias / conteúdo
  "g1.globo.com", "globo.com", "uol.com.br", "terra.com.br", "r7.com", "estadao.com.br",
  "folha.uol.com.br", "metropoles.com", "gazetadopovo.com.br", "bandnews", "ig.com.br",
  "wikipedia.org", "medium.com", "blogspot.com", "wordpress.com", "substack.com",
  // diretórios / agregadores / marketplaces
  "telelistas.net", "apontador.com.br", "guiamais.com.br", "solutudo.com.br",
  "encontracuritiba.com.br", "hotfrog.com.br", "econodata.com.br", "cnpj.biz",
  "consultasocio.com", "empresascnpj", "reclameaqui.com.br", "mercadolivre.com.br",
  "elo7.com.br", "olx.com.br", "shopee.com.br", "amazon.com", "magazineluiza.com.br",
  "tripadvisor.com", "ifood.com.br", "yelp.com", "foursquare.com",
  "indeed.com", "catho.com.br", "vagas.com.br", "glassdoor",
  "gov.br", "jus.br", "sebrae.com.br", "jusbrasil.com.br",
  "booking.com", "airbnb.com", "google.com", "bing.com",
];

const LISTICLE_RE =
  /^(top\s*)?\d+\s+(melhores|dicas|passos|motivos|ideias|maneiras|formas|marcas|empresas|lojas)/i;
const GUIDE_RE =
  /\b(como fazer|o que é|passo a passo|guia (completo|definitivo|de)|tutorial|significado de|conheça|saiba mais|vale a pena|review|resenha|melhores \d)\b/i;

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function hostMatches(host: string, list: string[]): boolean {
  return list.some((h) => host === h || host.endsWith(`.${h}`) || host.includes(h));
}

export interface ExtractResult {
  ok: boolean;
  reason?: string;
  company?: {
    companyName: string;
    description: string | null;
    city: string | null;
    state: string | null;
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
    website: string | null;
    instagram: string | null;
    address: string | null;
  };
}

// ── UF / cidade ───────────────────────────────────────────────────────────
const UF_RE =
  /\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/;

function findCity(text: string, regions: string[]): { city: string | null; state: string | null } {
  const lower = text.toLowerCase();
  for (const region of regions) {
    // "Curitiba e Região Metropolitana" → tenta "Curitiba"
    const main = region.split(/\s+e\s+|,|\//)[0].trim();
    if (main.length > 2 && lower.includes(main.toLowerCase())) {
      const ufMatch = text.match(UF_RE);
      return { city: main, state: ufMatch ? ufMatch[1] : null };
    }
  }
  // "Cidade/UF" ou "Cidade - UF" no texto
  const m = text.match(/([A-ZÀ-Ú][a-zà-ú]+(?:\s[A-ZÀ-Ú][a-zà-ú]+)?)\s*[-/–]\s*(A[CLPM]|BA|CE|DF|ES|GO|M[ATSG]|P[ARBEI]|R[JNSOR]|S[PCE]|TO)\b/);
  if (m) return { city: m[1], state: m[2] };
  return { city: null, state: null };
}

// ── Telefone / WhatsApp ───────────────────────────────────────────────────
const PHONE_RE = /(?:\+?55\s?)?(?:\(?\d{2}\)?[\s.-]?)?(?:9\s?)?\d{4}[\s.-]?\d{4}/g;

function findPhones(text: string): { phone: string | null; whatsapp: string | null } {
  const matches = Array.from(text.matchAll(PHONE_RE))
    .map((m) => normalizePhoneBR(m[0]))
    .filter((p): p is string => !!p);
  if (matches.length === 0) return { phone: null, whatsapp: null };
  const lower = text.toLowerCase();
  const looksWhatsapp = /whats\s?app|wa\.me|api\.whatsapp|chame no zap|fale no zap/.test(lower);
  const first = matches[0];
  return looksWhatsapp ? { phone: null, whatsapp: first } : { phone: first, whatsapp: null };
}

function findEmail(text: string): string | null {
  const m = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  return m ? m[0].toLowerCase() : null;
}

// ── Nome da empresa a partir do título ────────────────────────────────────
function cleanName(title: string): string {
  let n = title.split(/[|•·–—]| - /)[0].trim();
  n = n.replace(
    /\b(loja oficial|site oficial|página inicial|home|contato|sobre nós|catálogo|produtos)\b/gi,
    "",
  );
  n = n.replace(/["'“”]/g, "").replace(/\s+/g, " ").trim();
  return n;
}

/**
 * Decide se um resultado é uma EMPRESA e extrai os campos disponíveis.
 * `regions` = regiões da campanha (para reconhecer a cidade).
 */
export function extractCompany(hit: RawDiscoveryHit, regions: string[]): ExtractResult {
  const host = hostOf(hit.url);
  const text = `${hit.title}\n${hit.content}\n${hit.rawContent ?? ""}`;

  if (!host) return { ok: false, reason: "URL inválida" };
  if (hostMatches(host, CONTENT_OR_DIRECTORY_HOSTS))
    return { ok: false, reason: `Fonte de conteúdo/diretório (${host})` };
  if (LISTICLE_RE.test(hit.title.trim()))
    return { ok: false, reason: "Título de lista/artigo" };
  if (GUIDE_RE.test(hit.title) && !hostMatches(host, SOCIAL_HOSTS))
    return { ok: false, reason: "Conteúdo editorial (guia/tutorial)" };

  const isSocial = hostMatches(host, SOCIAL_HOSTS);
  const isInstagram = host.includes("instagram.com");

  const name = cleanName(hit.title);
  if (!name || name.length < 2) return { ok: false, reason: "Sem nome identificável" };

  const { city, state } = findCity(text, regions);
  const { phone, whatsapp } = findPhones(text);
  const email = findEmail(text);

  let website: string | null = null;
  let instagram: string | null = null;
  if (isInstagram) {
    instagram = hit.url;
  } else if (!isSocial) {
    try {
      website = new URL(hit.url).origin;
    } catch {
      website = null;
    }
  }
  // instagram citado no texto de um site próprio
  if (!instagram) {
    const ig = text.match(/instagram\.com\/([a-z0-9_.]+)/i);
    if (ig) instagram = `https://instagram.com/${ig[1]}`;
  }

  const description = hit.content ? hit.content.slice(0, 280) : null;

  return {
    ok: true,
    company: {
      companyName: name.slice(0, 120),
      description,
      city,
      state,
      phone,
      whatsapp,
      email,
      website,
      instagram,
      address: null,
    },
  };
}
