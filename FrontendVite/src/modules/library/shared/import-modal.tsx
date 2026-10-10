import * as React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildImportTemplate, downloadFile, parseDelimitedFile } from "@/lib/csv";
import { useBranches, useImportMembers, useImportTitles, useMembershipTypes } from "@/hooks/library/use-library";
import type { ImportResultDto } from "@/lib/library/library.api";
import { Field, Modal, SELECT } from "./ui";

type Kind = "titles" | "members";
type CellKind = "text" | "int" | "number";

interface ImportField {
  key: string;
  /** Column heading used in the template. Always English, so a file made from it maps itself. */
  header: string;
  sample: string;
  kind?: CellKind;
  required?: boolean;
  /** Headings (lower-case, letters and digits only) that mean this field. */
  synonyms: string[];
}

const TITLE_FIELDS: ImportField[] = [
  { key: "title", header: "Title", sample: "Clean Code", required: true, synonyms: ["title", "booktitle", "bookname", "name"] },
  { key: "subtitle", header: "Subtitle", sample: "A Handbook of Agile Software Craftsmanship", synonyms: ["subtitle"] },
  { key: "authors", header: "Author", sample: "Robert C. Martin", synonyms: ["author", "authors", "writer", "by"] },
  { key: "isbn", header: "ISBN", sample: "9780132350884", synonyms: ["isbn", "isbn13", "isbn10"] },
  { key: "category", header: "Category", sample: "Software", synonyms: ["category", "genre", "subject", "classification", "section"] },
  { key: "publisher", header: "Publisher", sample: "Prentice Hall", synonyms: ["publisher", "publication", "press"] },
  { key: "publicationYear", header: "Year", sample: "2008", kind: "int", synonyms: ["year", "publicationyear", "publishedyear", "yearpublished", "pubyear"] },
  { key: "edition", header: "Edition", sample: "1st", synonyms: ["edition"] },
  { key: "language", header: "Language", sample: "English", synonyms: ["language", "lang"] },
  { key: "materialType", header: "Type", sample: "book", synonyms: ["type", "materialtype", "format", "itemtype"] },
  { key: "branch", header: "Branch", sample: "Main Library", synonyms: ["branch", "location", "library", "site", "campus"] },
  { key: "copies", header: "Copies", sample: "3", kind: "int", synonyms: ["copies", "quantity", "qty", "noofcopies", "numberofcopies", "count"] },
  { key: "barcodes", header: "Barcodes", sample: "", synonyms: ["barcode", "barcodes", "accessionnumber", "accessionno", "accession", "itemid"] },
  { key: "shelfLocation", header: "Shelf", sample: "A-12", synonyms: ["shelf", "shelflocation", "rack", "callnumber", "callno"] },
  { key: "price", header: "Price", sample: "45", kind: "number", synonyms: ["price", "purchaseprice", "amount"] },
  { key: "replacementCost", header: "Replacement Cost", sample: "50", kind: "number", synonyms: ["replacementcost", "cost"] },
  { key: "description", header: "Description", sample: "", synonyms: ["description", "summary", "about", "notes"] },
];

const MEMBER_FIELDS: ImportField[] = [
  { key: "fullName", header: "Name", sample: "Aisha Khan", required: true, synonyms: ["name", "fullname", "membername", "studentname"] },
  { key: "memberNumber", header: "Card Number", sample: "", synonyms: ["cardnumber", "cardno", "membernumber", "memberno", "memberid", "membershipnumber", "membershipno"] },
  { key: "membershipType", header: "Membership Type", sample: "Standard", synonyms: ["membershiptype", "membertype", "type", "category", "plan"] },
  { key: "phone", header: "Phone", sample: "0501234567", synonyms: ["phone", "mobile", "contact", "phonenumber", "mobilenumber", "tel", "telephone", "contactnumber"] },
  { key: "email", header: "Email", sample: "aisha@example.com", synonyms: ["email", "emailaddress", "mail"] },
  { key: "idNumber", header: "ID Number", sample: "", synonyms: ["idnumber", "nationalid", "cnic", "emiratesid", "studentid", "staffid", "rollno", "rollnumber"] },
  { key: "homeBranch", header: "Branch", sample: "Main Library", synonyms: ["branch", "homebranch", "location", "campus"] },
  { key: "joinedOn", header: "Joined", sample: "2025-01-15", synonyms: ["joined", "joinedon", "joindate", "joiningdate", "datejoined", "membersince", "registrationdate"] },
  { key: "expiresOn", header: "Expires", sample: "2026-01-14", synonyms: ["expires", "expireson", "expiry", "expirydate", "validuntil", "validtill"] },
  { key: "address", header: "Address", sample: "", synonyms: ["address"] },
  { key: "status", header: "Status", sample: "active", synonyms: ["status"] },
  { key: "notes", header: "Notes", sample: "", synonyms: ["notes", "remarks", "comment", "comments"] },
];

const CHUNK = 500;   // the API takes at most 1,000 rows a request
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Reads a spreadsheet into text cells. Excel is read here rather than through the shared helper
 * because that one returns dates as Excel displays them ("1/5/25" — month first), which cannot be
 * told apart from a day-first date. Reading the real date value and writing it as yyyy-MM-dd
 * removes the guess.
 */
async function readSheet(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt")) return parseDelimitedFile(file);

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

  return rows
    .map(r => (Array.isArray(r) ? r.map(text) : []))
    .filter(r => r.some(c => c !== ""));
}

/** Each field is offered to one column only: exact heading matches win, then partial ones. */
function autoMap(headers: string[], fields: ImportField[]): string[] {
  const mapping = headers.map(() => "");
  const used = new Set<string>();
  const assign = (test: (h: string, synonym: string) => boolean) =>
    headers.forEach((raw, i) => {
      if (mapping[i]) return;
      const h = norm(raw);
      if (!h) return;
      const hit = fields.find(f => !used.has(f.key) && f.synonyms.some(s => test(h, s)));
      if (hit) { mapping[i] = hit.key; used.add(hit.key); }
    });

  assign((h, s) => h === s);
  assign((h, s) => s.length >= 4 && h.includes(s));
  return mapping;
}

function convert(value: string, kind: CellKind | undefined): string | number | null {
  const v = value.trim();
  if (!v) return null;
  if (kind === "int" || kind === "number") {
    const n = Number(v.replace(/[^0-9.\-]/g, ""));
    if (!Number.isFinite(n)) return null;
    return kind === "int" ? Math.trunc(n) : n;
  }
  return v;
}

function Tile({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={cn("text-xl font-bold mt-0.5 tabular-nums", tone)}>{value}</p>
    </div>
  );
}

/**
 * Upload → match columns → result, for the catalogue or the member list. Matching against what
 * is already in the library happens on the server, so importing the same file twice is safe.
 */
export function ImportModal({ kind, defaultBranchId, onClose }: {
  kind: Kind; defaultBranchId?: string; onClose: () => void;
}) {
  const { t } = useTranslation("library");
  const fields = kind === "titles" ? TITLE_FIELDS : MEMBER_FIELDS;
  const importTitles = useImportTitles();
  const importMembers = useImportMembers();
  const { data: branches = [] } = useBranches(true, kind === "titles");
  const { data: types = [] } = useMembershipTypes(true, kind === "members");

  const [stage, setStage] = React.useState<"upload" | "map" | "result">("upload");
  const [fileName, setFileName] = React.useState("");
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [rows, setRows] = React.useState<string[][]>([]);
  const [mapping, setMapping] = React.useState<string[]>([]);
  const [reading, setReading] = React.useState(false);
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = React.useState<ImportResultDto | null>(null);
  const [branchId, setBranchId] = React.useState(defaultBranchId ?? "");
  const [createBranches, setCreateBranches] = React.useState(true);
  const [typeId, setTypeId] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const branch = branchId || branches[0]?.id || "";
  const type = typeId || types.find(x => x.name === "Standard")?.id || types[0]?.id || "";
  const label = (f: ImportField) => t(`import.field.${kind}.${f.key}`);

  const handleFile = async (file: File) => {
    setReading(true);
    try {
      const grid = await readSheet(file);
      if (grid.length < 2) { toast.error(t("import.needHeader")); return; }
      const hdr = grid[0].map(h => h.trim());
      setFileName(file.name);
      setHeaders(hdr);
      setRows(grid.slice(1));
      setMapping(autoMap(hdr, fields));
      setStage("map");
    } catch (e) {
      toast.error(t("import.couldNotRead", { error: (e as Error).message }));
    } finally {
      setReading(false);
    }
  };

  const template = () => downloadFile(
    kind === "titles" ? "library-catalogue-template.csv" : "library-members-template.csv",
    buildImportTemplate(fields.map(f => ({ label: f.header, sample: f.sample }))));

  // Row numbers are the sheet's own (heading is row 1), so a problem can be found in the file.
  const payload = React.useMemo(() => {
    const out: Record<string, unknown>[] = [];
    rows.forEach((r, i) => {
      const item: Record<string, unknown> = { row: i + 2 };
      let any = false;
      mapping.forEach((key, col) => {
        if (!key) return;
        const value = convert(r[col] ?? "", fields.find(f => f.key === key)?.kind);
        if (value !== null) { item[key] = value; any = true; }
      });
      if (any) out.push(item);
    });
    return out;
  }, [rows, mapping, fields]);

  const missing = fields.filter(f => f.required && !mapping.includes(f.key));
  const running = progress !== null;

  const run = async () => {
    const total: ImportResultDto = { created: 0, existing: 0, copiesAdded: 0, failed: 0, branchesCreated: 0, errors: [] };
    setProgress({ done: 0, total: payload.length });
    try {
      for (let i = 0; i < payload.length; i += CHUNK) {
        const chunk = payload.slice(i, i + CHUNK);
        const res = kind === "titles"
          ? await importTitles.mutateAsync({ rows: chunk, defaultBranchId: branch || null, createBranches })
          : await importMembers.mutateAsync({ rows: chunk, defaultMembershipTypeId: type || null });
        total.created += res.created;
        total.existing += res.existing;
        total.copiesAdded += res.copiesAdded;
        total.failed += res.failed;
        total.branchesCreated += res.branchesCreated;
        total.errors = [...total.errors, ...res.errors].slice(0, 100);
        setProgress({ done: Math.min(i + CHUNK, payload.length), total: payload.length });
      }
      setResult(total);
      setStage("result");
    } catch {
      // The mutation has already reported it. Rows sent before the failure are saved; running
      // the file again picks up where it stopped without duplicating them.
    } finally {
      setProgress(null);
    }
  };

  const reset = () => { setStage("upload"); setRows([]); setHeaders([]); setMapping([]); setResult(null); };

  const footer =
    stage === "map" ? (
      <>
        <Button variant="outline" size="sm" onClick={reset} disabled={running}>{t("import.back")}</Button>
        <Button size="sm" className="gap-1.5" onClick={run} disabled={running || missing.length > 0 || payload.length === 0}>
          {running && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {running ? t("import.progress", progress!) : t("import.run", { count: payload.length })}
        </Button>
      </>
    ) : stage === "result" ? (
      <>
        <Button variant="outline" size="sm" onClick={reset}>{t("import.another")}</Button>
        <Button size="sm" onClick={onClose}>{t("import.done")}</Button>
      </>
    ) : undefined;

  return (
    <Modal title={t(`import.${kind}.title`)} subtitle={stage === "upload" ? undefined : t("import.fileSummary", { file: fileName, count: rows.length })}
      onClose={running ? () => undefined : onClose} size="lg" footer={footer}>

      {stage === "upload" && (
        <>
          <p className="text-sm text-muted-foreground">{t(`import.${kind}.intro`)}</p>
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv,.txt" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ""; }} />
          <button onClick={() => inputRef.current?.click()} disabled={reading}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) void handleFile(f); }}
            className="w-full rounded-xl border-2 border-dashed border-border hover:border-primary/60 hover:bg-muted/20 transition-colors px-6 py-10 text-center">
            {reading ? <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" /> : <UploadCloud className="h-8 w-8 mx-auto text-muted-foreground" />}
            <p className="text-sm font-semibold mt-3">{reading ? t("import.reading") : t("import.drop")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("import.dropHint")}</p>
          </button>
          <button onClick={template} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            <Download className="h-3.5 w-3.5" />{t("import.template")}
          </button>
        </>
      )}

      {stage === "map" && (
        <>
          {kind === "titles" ? (
            <div className="grid sm:grid-cols-2 gap-3 items-start">
              <Field label={t("import.defaultBranch")} hint={t("import.defaultBranchHint")}>
                <select value={branch} onChange={e => setBranchId(e.target.value)} className={SELECT}>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </Field>
              <label className="flex items-start gap-2 text-sm cursor-pointer sm:pt-6">
                <input type="checkbox" className="mt-0.5" checked={createBranches} onChange={e => setCreateBranches(e.target.checked)} />
                <span>{t("import.createBranches")}</span>
              </label>
            </div>
          ) : (
            <Field label={t("import.defaultType")} hint={t("import.defaultTypeHint")} className="sm:max-w-xs">
              <select value={type} onChange={e => setTypeId(e.target.value)} className={SELECT}>
                {types.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </Field>
          )}

          <div className="rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-start font-semibold px-3 py-2">{t("import.column")}</th>
                  <th className="text-start font-semibold px-3 py-2">{t("import.firstValue")}</th>
                  <th className="text-start font-semibold px-3 py-2 w-56">{t("import.goesTo")}</th>
                </tr>
              </thead>
              <tbody>
                {headers.map((h, col) => (
                  <tr key={col} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">
                      <span className="inline-flex items-center gap-1.5"><FileSpreadsheet className="h-3.5 w-3.5 text-muted-foreground" />{h || `#${col + 1}`}</span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[14rem] truncate">{rows.find(r => (r[col] ?? "") !== "")?.[col] ?? "—"}</td>
                    <td className="px-3 py-2">
                      <select value={mapping[col] ?? ""} className={cn(SELECT, "h-8", !mapping[col] && "text-muted-foreground")}
                        onChange={e => setMapping(prev => prev.map((m, i) => (i === col ? e.target.value : m)))}>
                        <option value="">{t("import.ignore")}</option>
                        {fields.map(f => (
                          <option key={f.key} value={f.key} disabled={mapping.includes(f.key) && mapping[col] !== f.key}>
                            {label(f)}{f.required ? " *" : ""}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {missing.length > 0 ? (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-sm px-3 py-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              {t("import.requiredMissing", { field: missing.map(label).join(", ") })}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">{t(`import.${kind}.matching`)}</p>
          )}
        </>
      )}

      {stage === "result" && result && (
        <>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="h-4 w-4 text-success" />{t("import.finished")}
          </p>
          <div className={cn("grid gap-3", kind === "titles" ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3")}>
            <Tile label={t(`import.${kind}.created`)} value={result.created} tone="text-success" />
            {kind === "titles" && <Tile label={t("import.copiesAdded")} value={result.copiesAdded} />}
            <Tile label={t(`import.${kind}.existing`)} value={result.existing} />
            <Tile label={t("import.failed")} value={result.failed} tone={result.failed > 0 ? "text-destructive" : undefined} />
          </div>
          {result.branchesCreated > 0 && <p className="text-sm text-muted-foreground">{t("import.branchesCreated", { count: result.branchesCreated })}</p>}

          {result.errors.length > 0 && (
            <div className="rounded-lg border border-border max-h-64 overflow-y-auto divide-y divide-border">
              {result.errors.map((e, i) => (
                <p key={i} className="px-3 py-2 text-sm">
                  <span className="font-semibold tabular-nums">{t("import.rowLabel", { row: e.row })}</span>
                  <span className="text-muted-foreground"> — {e.message}</span>
                </p>
              ))}
            </div>
          )}
          {result.failed > result.errors.length && (
            <p className="text-xs text-muted-foreground">{t("import.moreErrors", { count: result.failed - result.errors.length })}</p>
          )}
          {result.failed > 0 && <p className="text-xs text-muted-foreground">{t("import.fixAndRerun")}</p>}
        </>
      )}
    </Modal>
  );
}
