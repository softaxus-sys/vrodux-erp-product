import { parseDelimitedFile } from "@/lib/csv";

/**
 * Helpers for importing a spreadsheet into a form: read a CSV or Excel file into text cells, and
 * guess which column is which from its heading. Shared so each import screen does not carry its own copy.
 */

export interface SheetField {
  key: string;
  /** Column heading used in the downloadable template. Always English, so a file made from it maps itself. */
  header: string;
  sample: string;
  kind?: "text" | "int" | "number";
  required?: boolean;
  /** Headings (lower-case, letters and digits only) that mean this field. */
  synonyms: string[];
}

export const normHeading = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Reads a spreadsheet into text cells. Excel is read here rather than through `parseDelimitedFile`
 * because that returns dates as Excel displays them ("1/5/25" — month first), which cannot be told
 * apart from a day-first date. Reading the real date value and writing it as yyyy-MM-dd removes the guess.
 */
export async function readSheet(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt")) return parseDelimitedFile(file);

  // Loaded on demand so the (large) spreadsheet library never weighs down the main bundle.
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false, defval: "", raw: true });

  const text = (cell: unknown): string => {
    if (cell instanceof Date) {
      // Shifted to midday first, so a value a few seconds either side of midnight keeps its day.
      const d = new Date(cell.getTime() + 12 * 60 * 60 * 1000);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
    return cell === null || cell === undefined ? "" : String(cell).trim();
  };

  return rows.map(r => (Array.isArray(r) ? r.map(text) : [])).filter(r => r.some(c => c !== ""));
}

/** Each field is offered to one column only: exact heading matches win, then partial ones. */
export function autoMapHeadings(headers: string[], fields: SheetField[]): string[] {
  const mapping = headers.map(() => "");
  const used = new Set<string>();
  const assign = (test: (h: string, synonym: string) => boolean) =>
    headers.forEach((raw, i) => {
      if (mapping[i]) return;
      const h = normHeading(raw);
      if (!h) return;
      const hit = fields.find(f => !used.has(f.key) && f.synonyms.some(s => test(h, s)));
      if (hit) { mapping[i] = hit.key; used.add(hit.key); }
    });

  assign((h, s) => h === s);
  assign((h, s) => s.length >= 4 && h.includes(s));
  return mapping;
}

/** A cell as a number: thousands separators and currency symbols are ignored; anything unreadable is null. */
export function cellNumber(value: string): number | null {
  const v = value.trim();
  if (!v) return null;
  const n = Number(v.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}
