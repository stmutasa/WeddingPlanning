/**
 * A small RFC 4180 CSV reader. Bank exports and guest lists are the only
 * CSVs this app reads and both are plain; a dependency would buy nothing
 * that these forty lines do not already do (quoted fields, escaped quotes,
 * embedded newlines and commas, CRLF, a BOM).
 */

export function parseCsvRows(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];

    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Rows keyed by the header line's column names. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows = parseCsvRows(text);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cells) => {
    const out: Record<string, string> = {};
    header.forEach((name, i) => {
      out[name] = cells[i] ?? "";
    });
    return out;
  });
}

/** Header names of a CSV, for building a column-mapping UI. */
export function csvHeaders(text: string): string[] {
  const rows = parseCsvRows(text);
  return rows.length > 0 ? rows[0].map((h) => h.trim()) : [];
}

/** Escapes one value for a CSV we write (the expenses export). */
export function csvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  return [header.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\r\n");
}
