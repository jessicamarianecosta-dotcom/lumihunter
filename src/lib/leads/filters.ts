export type LeadsView = "kanban" | "list";

export type LeadsSort =
  | "score_desc"
  | "score_asc"
  | "recent"
  | "oldest"
  | "name_asc"
  | "name_desc";

export const SORT_OPTIONS: { value: LeadsSort; label: string }[] = [
  { value: "score_desc", label: "Maior score" },
  { value: "score_asc", label: "Menor score" },
  { value: "recent", label: "Mais recentes" },
  { value: "oldest", label: "Mais antigos" },
  { value: "name_asc", label: "Nome A–Z" },
  { value: "name_desc", label: "Nome Z–A" },
];

export const DEFAULT_SORT: LeadsSort = "score_desc";

export interface LeadsFilters {
  q: string;
  stageId: string;
  scoreMin: number;
  scoreMax: number;
  segment: string;
  city: string;
  state: string;
  source: string;
  discoveredFrom: string;
  discoveredTo: string;
  hasWhatsapp: boolean;
  hasEmail: boolean;
  sort: LeadsSort;
}

export const EMPTY_FILTERS: LeadsFilters = {
  q: "",
  stageId: "",
  scoreMin: 0,
  scoreMax: 100,
  segment: "",
  city: "",
  state: "",
  source: "",
  discoveredFrom: "",
  discoveredTo: "",
  hasWhatsapp: false,
  hasEmail: false,
  sort: DEFAULT_SORT,
};

type SearchParamsInput = Record<string, string | string[] | undefined>;

function str(params: SearchParamsInput, key: string): string {
  const v = params[key];
  return typeof v === "string" ? v : "";
}

export function parseLeadsFilters(params: SearchParamsInput): LeadsFilters {
  const scoreMinRaw = Number(str(params, "scoreMin"));
  const scoreMaxRaw = Number(str(params, "scoreMax"));
  const sort = str(params, "sort") as LeadsSort;
  return {
    q: str(params, "q"),
    stageId: str(params, "stage"),
    scoreMin: Number.isFinite(scoreMinRaw) && str(params, "scoreMin") ? scoreMinRaw : 0,
    scoreMax: Number.isFinite(scoreMaxRaw) && str(params, "scoreMax") ? scoreMaxRaw : 100,
    segment: str(params, "segment"),
    city: str(params, "city"),
    state: str(params, "state"),
    source: str(params, "source"),
    discoveredFrom: str(params, "from"),
    discoveredTo: str(params, "to"),
    hasWhatsapp: str(params, "whatsapp") === "1",
    hasEmail: str(params, "email") === "1",
    sort: SORT_OPTIONS.some((o) => o.value === sort) ? sort : DEFAULT_SORT,
  };
}

export function parseLeadsView(params: SearchParamsInput, fallback: LeadsView): LeadsView {
  const v = str(params, "view");
  return v === "kanban" || v === "list" ? v : fallback;
}

/** Monta os searchParams equivalentes a um conjunto de filtros (para navegação/URL). */
export function filtersToSearchParams(
  filters: LeadsFilters,
  extra: { view?: LeadsView } = {},
): URLSearchParams {
  const p = new URLSearchParams();
  if (extra.view) p.set("view", extra.view);
  if (filters.q) p.set("q", filters.q);
  if (filters.stageId) p.set("stage", filters.stageId);
  if (filters.scoreMin > 0) p.set("scoreMin", String(filters.scoreMin));
  if (filters.scoreMax < 100) p.set("scoreMax", String(filters.scoreMax));
  if (filters.segment) p.set("segment", filters.segment);
  if (filters.city) p.set("city", filters.city);
  if (filters.state) p.set("state", filters.state);
  if (filters.source) p.set("source", filters.source);
  if (filters.discoveredFrom) p.set("from", filters.discoveredFrom);
  if (filters.discoveredTo) p.set("to", filters.discoveredTo);
  if (filters.hasWhatsapp) p.set("whatsapp", "1");
  if (filters.hasEmail) p.set("email", "1");
  if (filters.sort !== DEFAULT_SORT) p.set("sort", filters.sort);
  return p;
}

/** Conta quantos filtros "avançados" estão ativos (sem contar busca nem ordenação). */
export function countActiveFilters(filters: LeadsFilters): number {
  let n = 0;
  if (filters.stageId) n++;
  if (filters.scoreMin > 0 || filters.scoreMax < 100) n++;
  if (filters.segment) n++;
  if (filters.city) n++;
  if (filters.state) n++;
  if (filters.source) n++;
  if (filters.discoveredFrom || filters.discoveredTo) n++;
  if (filters.hasWhatsapp) n++;
  if (filters.hasEmail) n++;
  return n;
}
