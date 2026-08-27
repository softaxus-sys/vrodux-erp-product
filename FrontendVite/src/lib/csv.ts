// Tiny dependency-free CSV toolkit (RFC-4180-ish): quote handling, embedded
// commas/newlines, and a browser download helper.

/** Serialize an array of objects to CSV text. Columns come from `headers`. */
export function toCsv<T extends Record<string, unknown>>(rows: T[], headers: (keyof T)[]): string {
  const head = headers.map(h => csvCell(String(h))).join(",");
  const body = rows.map(r => headers.map(h => csvCell(formatCell(r[h]))).join(",")).join("\r\n");
  return body ? `${head}\r\n${body}` : head;
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}

function csvCell(s: string): string {
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Parse CSV text → array of row objects keyed by the header row. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows = parseRows(text.replace(/^﻿/, "")); // strip BOM
  if (rows.length === 0) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1)
    .filter(r => r.some(c => c.trim() !== ""))
    .map(r => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = (r[i] ?? "").trim(); });
      return obj;
    });
}

/** Raw grid, no header handling — for callers that scan every cell rather than named columns. */
export function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(cell); cell = "";
    } else if (c === "\n") {
      row.push(cell); cell = ""; rows.push(row); row = [];
    } else if (c === "\r") {
      // handled by \n; ignore lone CR
    } else {
      cell += c;
    }
  }
  if (cell !== "" || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

/** Trigger a browser download of `content` as a file. */
export function downloadFile(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob(["﻿" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Reading ───────────────────────────────────────────────────────────────────

/** CSV/TXT directly; Excel via SheetJS, lazy-loaded so it never bloats the main bundle. */
export async function parseDelimitedFile(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt")) return parseRows(await file.text());

  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false, defval: "", raw: false });
  return rows
    .map((r) => (Array.isArray(r) ? r.map((c) => (c == null ? "" : String(c))) : []))
    .filter((r) => r.some((cell) => String(cell).trim() !== ""));
}

/**
 * Pull every email address out of a parsed sheet, wherever it happens to sit.
 *
 * Column position and header wording vary between exports, so this looks for an "@" in the value
 * rather than trusting a header — the same list works whether the email is column B or column D,
 * with or without a header row.
 */
export function extractEmails(rows: string[][]): string[] {
  const found: string[] = [];
  for (const row of rows) {
    for (const cell of row) {
      const v = String(cell ?? "").trim().toLowerCase().replace(/^[<"']+|[>"']+$/g, "");
      if (v.includes("@") && v.includes(".") && !v.includes(" ")) found.push(v);
    }
  }
  return [...new Set(found)];
}
