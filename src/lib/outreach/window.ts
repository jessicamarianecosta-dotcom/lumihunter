/**
 * Janela de horário e intervalo entre envios. Funções puras.
 *
 * O intervalo/janela existem para CONTROLE OPERACIONAL (respeitar limites da
 * API, experiência do usuário) — nunca para simular comportamento humano ou
 * escapar de detecção anti-spam.
 */

/** Minutos desde a meia-noite no fuso `tz` para o instante `nowUtc`. */
export function minutesOfDay(nowUtc: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(nowUtc);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return (h % 24) * 60 + m;
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => Number(n) || 0);
  return h * 60 + m;
}

/** Deslocamento do fuso (em ms) em relação ao UTC no instante dado. */
function tzOffsetMs(nowUtc: Date, tz: string): number {
  const local = new Date(nowUtc.toLocaleString("en-US", { timeZone: tz }));
  const utc = new Date(nowUtc.toLocaleString("en-US", { timeZone: "UTC" }));
  return local.getTime() - utc.getTime();
}

export function withinWindow(
  nowUtc: Date,
  startHHMM: string,
  endHHMM: string,
  tz: string,
): boolean {
  const now = minutesOfDay(nowUtc, tz);
  const start = hhmmToMinutes(startHHMM);
  const end = hhmmToMinutes(endHHMM);
  if (start === end) return true; // janela "sempre"
  if (start < end) return now >= start && now < end;
  // janela que cruza a meia-noite
  return now >= start || now < end;
}

/** Próximo instante (UTC) em que a janela abre. Aproximado — para exibição/agenda. */
export function nextWindowStart(
  nowUtc: Date,
  startHHMM: string,
  endHHMM: string,
  tz: string,
): Date {
  if (withinWindow(nowUtc, startHHMM, endHHMM, tz)) return nowUtc;

  const offset = tzOffsetMs(nowUtc, tz);
  const localNow = new Date(nowUtc.getTime() + offset);
  const start = hhmmToMinutes(startHHMM);

  const candidate = new Date(localNow);
  candidate.setHours(Math.floor(start / 60), start % 60, 0, 0);
  if (candidate.getTime() <= localNow.getTime()) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return new Date(candidate.getTime() - offset);
}

/** true se já passou o intervalo mínimo desde o último envio. */
export function intervalElapsed(
  lastSentAt: string | null,
  minIntervalSeconds: number,
  nowUtc: Date,
): boolean {
  if (!lastSentAt) return true;
  const elapsed = nowUtc.getTime() - new Date(lastSentAt).getTime();
  return elapsed >= minIntervalSeconds * 1000;
}

/** Data local "YYYY-MM-DD" no fuso — usada para contar o limite diário. */
export function localDateKey(nowUtc: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(nowUtc);
}

/** Instante UTC da meia-noite local (início do dia no fuso). Aproximado. */
export function localDayStartUtc(nowUtc: Date, tz: string): Date {
  const offset = tzOffsetMs(nowUtc, tz);
  const local = new Date(nowUtc.getTime() + offset);
  local.setHours(0, 0, 0, 0);
  return new Date(local.getTime() - offset);
}
