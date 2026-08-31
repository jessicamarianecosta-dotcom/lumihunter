/** CSV mínimo — suficiente para import/export de leads e produtos. */

/** Parse de CSV (aspas duplas, separador `,` ou `;`, quebras de linha). */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const sep = detectSeparator(clean);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === sep) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

function detectSeparator(text: string): string {
  const firstLine = text.split("\n")[0] ?? "";
  const commas = (firstLine.match(/,/g) ?? []).length;
  const semis = (firstLine.match(/;/g) ?? []).length;
  return semis > commas ? ";" : ",";
}

/** Converte a primeira linha em cabeçalho e devolve objetos. */
export function parseCsvObjects(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (r[i] ?? "").trim();
    });
    return obj;
  });
}

function escapeCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Gera CSV a partir de cabeçalhos + linhas de objetos. */
export function toCsv(
  headers: string[],
  rows: Record<string, unknown>[],
): string {
  const head = headers.map(escapeCell).join(",");
  const body = rows
    .map((r) => headers.map((h) => escapeCell(r[h])).join(","))
    .join("\n");
  return `﻿${head}\n${body}\n`;
}
