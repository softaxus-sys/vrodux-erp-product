import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { UploadCloud, FileSpreadsheet, X, Loader2, CheckCircle2, AlertTriangle, ArrowRight, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parseDelimitedFile, buildImportTemplate, downloadFile } from "@/lib/csv";

/**
 * A three-stage spreadsheet importer — upload, map columns, review the result — driven entirely by a
 * field spec, so a new import is a table of fields rather than another copy of this file.
 *
 * The CRM lead importer predates this and still has its own copy; it works and is in production, so
 * it was left alone rather than migrated as a side effect of adding another importer. If a third
 * import appears, that is the moment to move it onto this.
 */

export interface ImportField<K extends string> {
  key: K;
  label: string;
  /** Blocks the import until at least one of the fields marked required is mapped. */
  required?: boolean;
  /**
   * Marks a numeric column. Spreadsheets carry formatted numbers — "AED 1,200.00", "1 200" — which
   * the API binds as a number and would reject outright, failing the whole batch rather than the
   * cell. These are cleaned before sending, and dropped if what remains is not a number.
   */
  numeric?: boolean;
  /** Normalised header fragments that auto-map to this field. */
  synonyms: string[];
  /**
   * Example value for this column in the downloadable template. Worth filling in wherever the
   * expected format is not obvious from the label — a date, a status word, a unit of measure —
   * since the sample file is the only place the user ever sees what "good" looks like.
   */
  sample?: string;
}

/** What the server reports back. Skipped is not a failure — it is "this one already existed". */
export interface ImportOutcome {
  created: number;
  skipped: number;
  failed: number;
  problems: { row: number; message: string }[];
  /** Anything the tallies do not cover, e.g. how many buildings an import also created. */
  note?: string;
}

interface Props<K extends string> {
  open: boolean;
  onClose: () => void;
  title: string;
  /** One line under the title saying what a row of this file is. */
  description: string;
  fields: ImportField<K>[];
  /** Rows are sent in chunks; the caller talks to its own endpoint. */
  onImport: (rows: Record<K, string>[]) => Promise<ImportOutcome>;
  /** Rows per request. Keep at or under the server's cap. */
  chunkSize?: number;
  /** Plural noun for the thing being imported, e.g. "properties". */
  noun: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Turns a spreadsheet number into something the API can bind: strips currency symbols, thousands
 * separators and spaces. Returns null when nothing numeric is left, so the caller omits the field
 * and the server default applies — far better than failing the whole batch over one odd cell.
 */
function cleanNumber(raw: string): string | null {
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  return Number.isFinite(Number(cleaned)) ? cleaned : null;
}

export function SpreadsheetImportModal<K extends string>(props: Props<K>) {
  return createPortal(
    <AnimatePresence>
      {props.open && <Inner {...props} />}
    </AnimatePresence>,
    document.body,
  );
}

function Inner<K extends string>({
  onClose, title, description, fields, onImport, chunkSize = 500, noun,
}: Props<K>) {
  const [rows, setRows]       = React.useState<string[][]>([]);
  const [fileName, setFile]   = React.useState("");
  const [mapping, setMapping] = React.useState<(K | "")[]>([]);
  const [busy, setBusy]       = React.useState(false);
  const [progress, setProg]   = React.useState("");
  const [result, setResult]   = React.useState<ImportOutcome | null>(null);

  const headers = rows[0] ?? [];
  const body    = React.useMemo(() => rows.slice(1), [rows]);

  const autoDetect = React.useCallback((header: string): K | "" => {
    const h = norm(header);
    if (!h) return "";
    // Exact match wins outright; only then fall back to a contains match, or "name" would claim
    // "property name" before the more specific field had a chance.
    for (const f of fields) if (f.synonyms.some(s => norm(s) === h)) return f.key;
    for (const f of fields) if (f.synonyms.some(s => h.includes(norm(s)))) return f.key;
    return "";
  }, [fields]);

  const handleFile = async (file: File) => {
    try {
      const parsed = await parseDelimitedFile(file);
      if (parsed.length < 2) {
        toast.error("That file has no rows under its header.");
        return;
      }
      setRows(parsed);
      setFile(file.name);
      setMapping(parsed[0].map(autoDetect));
      setResult(null);
    } catch {
      toast.error("Could not read that file. CSV and Excel (.xlsx) are supported.");
    }
  };

  const numericKeys = React.useMemo(
    () => new Set(fields.filter(f => f.numeric).map(f => f.key)),
    [fields],
  );

  const mapped = new Set(mapping.filter(Boolean) as K[]);
  const requiredFields = fields.filter(f => f.required);
  const hasRequired = requiredFields.length === 0 || requiredFields.some(f => mapped.has(f.key));

  // Rows with nothing in any required column are skipped client-side rather than sent and counted
  // as failures — a trailing blank line in a spreadsheet is not an error worth reporting.
  const importable = React.useMemo(() => {
    if (!hasRequired) return [];
    return body
      .map((cells, index) => ({ cells, index }))
      .filter(({ cells }) =>
        requiredFields.length === 0 ||
        requiredFields.some(f => {
          const i = mapping.indexOf(f.key);
          return i >= 0 && String(cells[i] ?? "").trim() !== "";
        }));
  }, [body, mapping, hasRequired, requiredFields]);

  const run = async () => {
    setBusy(true);
    const total: ImportOutcome = { created: 0, skipped: 0, failed: 0, problems: [] };

    try {
      for (let start = 0; start < importable.length; start += chunkSize) {
        const slice = importable.slice(start, start + chunkSize);
        setProg(`Importing ${start + 1}–${Math.min(start + chunkSize, importable.length)} of ${importable.length}…`);

        const payload = slice.map(({ cells }) => {
          const obj = {} as Record<K, string>;
          mapping.forEach((key, i) => {
            if (!key) return;
            const raw = String(cells[i] ?? "").trim();
            // An empty cell means "not provided", so it is left out entirely rather than sent as an
            // empty string — which the API would reject for a number and store as "" for text.
            if (raw === "") return;
            const value = numericKeys.has(key) ? cleanNumber(raw) : raw;
            if (value !== null) obj[key] = value;
          });
          return obj;
        });

        const res = await onImport(payload);
        total.created += res.created;
        // The last chunk wins: the note is a running statement about the whole import.
        if (res.note) total.note = res.note;
        total.skipped += res.skipped;
        total.failed  += res.failed;
        // Row numbers come back relative to the chunk, so shift them into the file's own numbering
        // or every problem after the first chunk would point at the wrong line.
        // The server indexes within the chunk it was sent, so translate back to the row this came
        // from in the actual file — blank rows we filtered out would otherwise shift every number.
        total.problems.push(...res.problems.map(p => ({
          ...p,
          row: slice[p.row]?.index ?? p.row + start,
        })));
      }
      setResult(total);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The import failed.");
    } finally {
      setBusy(false);
      setProg("");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
        onClick={e => e.stopPropagation()}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col"
      >
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div>
            <h2 className="font-bold">{title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* ── Stage 3: what happened ── */}
          {result ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Tile label="Created"  value={result.created} cls="text-success" />
                <Tile label="Skipped"  value={result.skipped} cls="text-warning" />
                <Tile label="Failed"   value={result.failed}  cls="text-destructive" />
              </div>

              {result.note && (
                <p className="text-xs text-muted-foreground">{result.note}</p>
              )}

              {result.skipped > 0 && (
                <p className="text-xs text-muted-foreground">
                  Skipped rows already existed — re-running a corrected file only adds what is missing.
                </p>
              )}

              {result.problems.length > 0 && (
                <div className="border border-border rounded-xl overflow-hidden">
                  <p className="text-xs font-semibold px-3 py-2 bg-muted/40 border-b border-border">
                    Rows needing attention
                  </p>
                  <div className="max-h-56 overflow-y-auto divide-y divide-border/50">
                    {result.problems.map((p, i) => (
                      <div key={i} className="px-3 py-2 text-xs flex gap-3">
                        {/* +2: the header line, and spreadsheets count from 1. */}
                        <span className="font-mono text-muted-foreground shrink-0">Row {p.row + 2}</span>
                        <span>{p.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : rows.length === 0 ? (
            /* ── Stage 1: pick a file ── */
            <div className="space-y-3">
              <label className="border-2 border-dashed border-border rounded-2xl p-10 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/50 transition-colors">
                <UploadCloud className="h-9 w-9 text-muted-foreground" />
                <p className="text-sm font-medium">Choose a CSV or Excel file</p>
                <p className="text-xs text-muted-foreground">The first row must be your column headings.</p>
                <input
                  type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
                />
              </label>

              {/* Deliberately OUTSIDE the label: nested inside it, clicking the download would also
                  trigger the file picker. */}
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <span>Not sure what the file should look like?</span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  onClick={() => downloadFile(
                    `${noun.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-import-template.csv`,
                    buildImportTemplate(fields))}>
                  <Download className="h-3.5 w-3.5" />
                  Download a sample file
                </button>
              </div>
            </div>
          ) : (
            /* ── Stage 2: map the columns ── */
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <FileSpreadsheet className="h-4 w-4 text-success shrink-0" />
                <span className="font-medium truncate">{fileName}</span>
                <span className="text-muted-foreground text-xs shrink-0">· {body.length} rows</span>
              </div>

              {!hasRequired && (
                <div className="flex gap-2 items-start bg-warning/10 border border-warning/30 rounded-xl p-3 text-xs">
                  <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <span>
                    Map a column to {requiredFields.map(f => f.label).join(" or ")} before importing —
                    without it there is nothing to identify a {noun.replace(/s$/, "")} by.
                  </span>
                </div>
              )}

              <div className="border border-border rounded-xl overflow-hidden">
                <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center px-3 py-2 bg-muted/40 border-b border-border text-xs font-semibold">
                  <span>Column in your file</span><span /><span>Import as</span>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-border/50">
                  {headers.map((h, i) => (
                    <div key={i} className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm truncate">{h || <span className="text-muted-foreground italic">(no heading)</span>}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{body[0]?.[i] ?? ""}</p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      <select
                        className="bg-card border border-border rounded-lg h-8 px-2 text-sm"
                        value={mapping[i] ?? ""}
                        onChange={e => setMapping(m => m.map((v, j) => (j === i ? (e.target.value as K | "") : v)))}
                      >
                        <option value="">Ignore this column</option>
                        {fields.map(f => (
                          <option
                            key={f.key} value={f.key}
                            /* Already used elsewhere — two columns cannot feed one field. */
                            disabled={mapped.has(f.key) && mapping[i] !== f.key}
                          >
                            {f.label}{f.required ? " *" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                {importable.length} of {body.length} rows will be imported.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 p-5 border-t border-border">
          <span className="text-xs text-muted-foreground">{progress}</span>
          <div className="flex gap-2">
            {result ? (
              <Button size="sm" onClick={onClose}>
                <CheckCircle2 className="h-3.5 w-3.5 me-1.5" /> Done
              </Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
                <Button
                  size="sm" onClick={run}
                  disabled={busy || rows.length === 0 || !hasRequired || importable.length === 0}
                >
                  {busy && <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />}
                  Import {importable.length > 0 ? importable.length : ""} {noun}
                </Button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Tile({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="border border-border rounded-xl p-3 text-center">
      <p className={cn("text-2xl font-bold", cls)}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
