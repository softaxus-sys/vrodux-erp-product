import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { UploadCloud, FileSpreadsheet, X, Loader2, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useImportLeads } from "@/hooks/crm/use-crm";
import {
  IMPORT_TARGET_FIELDS, type ImportTargetField, type ImportLeadInput, type ImportLeadsResult,
} from "@/lib/crm/crm.api";

// ── Column auto-detection (mirrors the backend GenericInboundProvider synonyms) ──
const FIELD_SYNONYMS: Record<ImportTargetField, string[]> = {
  firstName: ["firstname", "first", "fname", "givenname"],
  lastName:  ["lastname", "last", "lname", "familyname", "surname"],
  fullName:  ["fullname", "name", "contactname", "leadname"],
  email:     ["email", "emailaddress", "mail", "e mail"],
  phone:     ["phone", "phonenumber", "mobile", "tel", "telephone", "contactnumber", "cell"],
  company:   ["company", "companyname", "organization", "organisation", "business", "account"],
  title:     ["title", "jobtitle", "designation", "position", "role"],
  industry:  ["industry", "sector", "vertical"],
  address:   ["address", "street", "addressline1", "address1"],
  city:      ["city", "town"],
  country:   ["country", "countryname", "nation"],
  notes:     ["notes", "comment", "remarks", "description"],
  whatsApp:     ["whatsapp", "whatsappnumber", "whatsappno", "wanumber", "whatsappphone"],
  interestedIn: ["interestedin", "interest", "interest in", "productinterest", "serviceinterest", "lookingfor"],
  budget:       ["budget", "budgetrange", "pricerange", "estimatedbudget", "yourbudget"],
  message:      ["message", "yourmessage", "custommessage", "comments", "enquiry", "inquiry", "additionalinfo", "details"],
  timeframe:    ["timeframe", "timeline", "whentobuy", "whenlookingtobuy", "purchasetimeline", "buyingtimeline", "whenplanningtoinvest", "movein", "urgency"],
  campaign:     ["campaign", "campaignname", "adcampaign"],
  formName:     ["formname", "form", "formtitle", "leadform"],
};

const TARGET_LABEL: Record<ImportTargetField, string> = {
  firstName: "First name", lastName: "Last name", fullName: "Full name", email: "Email",
  phone: "Phone", company: "Company", title: "Job title", industry: "Industry",
  address: "Address", city: "City", country: "Country", notes: "Notes",
  whatsApp: "WhatsApp", interestedIn: "Interested in", budget: "Budget",
  message: "Message", timeframe: "Purchase timeframe", campaign: "Campaign", formName: "Form name",
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Keyword classifier — mirrors the backend LeadFieldClassifier so real Meta question headers
// ("your_budget?", "when_are_you_planning_to_buy?", "what_are_you_interested_in?", "whatsapp_number")
// auto-map even though they aren't fixed synonyms.
function classifyHeader(header: string): ImportTargetField | "" {
  const n = norm(header);
  if (!n) return "";
  if (n.includes("whatsapp")) return "whatsApp";
  if (n.includes("email") || n === "mail") return "email";
  if (n.includes("firstname") || n === "fname") return "firstName";
  if (n.includes("lastname") || n.includes("surname") || n === "lname") return "lastName";
  if (n.includes("fullname") || n === "name" || n === "leadname" || n === "contactname") return "fullName";
  if (n.includes("phone") || n.includes("mobile") || n.includes("contactnumber") || n.includes("cellnumber")) return "phone";
  if (n.includes("budget") || n.includes("pricerange") || n.includes("yourprice")) return "budget";
  if (n.includes("when") && (n.includes("buy") || n.includes("invest") || n.includes("purchas") || n.includes("plan") || n.includes("move"))) return "timeframe";
  if (n.includes("timeframe") || n.includes("timeline") || n.includes("urgency")) return "timeframe";
  if (n.includes("interested") || n.includes("buyingfor") || n.includes("lookingfor") || n.includes("propertytype") || n.includes("unittype") || n.includes("project")) return "interestedIn";
  if (n.includes("company") || n.includes("organization") || n.includes("organisation") || n.includes("business")) return "company";
  if (n.includes("jobtitle") || n.includes("designation")) return "title";
  if (n.includes("industry") || n.includes("sector")) return "industry";
  if (n.includes("city") || n.includes("town")) return "city";
  if (n.includes("country")) return "country";
  if (n.includes("formname")) return "formName";
  if (n.includes("campaign")) return "campaign";
  if (n.includes("message") || n.includes("ask") || n.includes("comment") || n.includes("query") || n.includes("question") || n.includes("enquiry") || n.includes("inquiry") || n.includes("details")) return "message";
  if (n.includes("note")) return "notes";
  return "";
}

function autoDetect(header: string): ImportTargetField | "" {
  const h = norm(header);
  if (!h) return "";
  for (const field of IMPORT_TARGET_FIELDS) {
    for (const syn of FIELD_SYNONYMS[field]) {
      if (h === norm(syn)) return field;       // exact synonym wins
    }
  }
  const byKeyword = classifyHeader(header);     // then the keyword classifier
  if (byKeyword) return byKeyword;
  for (const field of IMPORT_TARGET_FIELDS) {
    for (const syn of FIELD_SYNONYMS[field]) {
      const n = norm(syn);
      if (h.includes(n) || n.includes(h)) return field;   // fuzzy fallback
    }
  }
  return "";
}

// ── CSV parsing (RFC-4180-ish: quoted fields, embedded commas / newlines) ───────
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

async function parseFile(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    return parseCsv(await file.text());
  }
  // Excel — lazy-load SheetJS so it never bloats the main bundle.
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false, defval: "", raw: false });
  return rows
    .map((r) => (Array.isArray(r) ? r.map((c) => (c == null ? "" : String(c))) : []))
    .filter((r) => r.some((cell) => String(cell).trim() !== ""));
}

const CHUNK = 2000;   // backend caps a single request at 5000 rows

type Stage = "upload" | "map" | "result";

export function ImportLeadsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && <ImportLeadsModalInner onClose={onClose} />}
    </AnimatePresence>
  );
}

function ImportLeadsModalInner({ onClose }: { onClose: () => void }) {
  const importLeads = useImportLeads();
  const [stage, setStage] = React.useState<Stage>("upload");
  const [fileName, setFileName] = React.useState("");
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [rows, setRows] = React.useState<string[][]>([]);
  const [mapping, setMapping] = React.useState<(ImportTargetField | "")[]>([]);
  const [parsing, setParsing] = React.useState(false);
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = React.useState<ImportLeadsResult | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setParsing(true);
    try {
      const grid = await parseFile(file);
      if (grid.length < 2) {
        toast.error("The file needs a header row and at least one data row.");
        return;
      }
      const hdr = grid[0].map((h) => h.trim());
      setFileName(file.name);
      setHeaders(hdr);
      setRows(grid.slice(1));
      setMapping(hdr.map(autoDetect));
      setStage("map");
    } catch (e) {
      toast.error(`Could not read the file: ${(e as Error).message}`);
    } finally {
      setParsing(false);
    }
  }

  const mappedFields = React.useMemo(() => new Set(mapping.filter(Boolean)), [mapping]);
  const hasIdentity =
    mappedFields.has("email") || mappedFields.has("phone") ||
    mappedFields.has("fullName") || mappedFields.has("firstName");

  // Build canonical rows; skip rows with no identity value so they don't count as "failed".
  const buildPayload = React.useCallback((): ImportLeadInput[] => {
    const out: ImportLeadInput[] = [];
    for (const r of rows) {
      const lead: ImportLeadInput = { source: "import" };
      let hasValue = false;
      mapping.forEach((field, col) => {
        if (!field) return;
        const val = (r[col] ?? "").trim();
        if (!val) return;
        (lead as Record<string, string>)[field] = val;
        if (field === "email" || field === "phone" || field === "fullName" || field === "firstName") hasValue = true;
      });
      if (hasValue) out.push(lead);
    }
    return out;
  }, [rows, mapping]);

  const validCount = React.useMemo(
    () => (hasIdentity ? buildPayload().length : 0),
    [hasIdentity, buildPayload],
  );

  async function runImport() {
    const payload = buildPayload();
    if (payload.length === 0) { toast.error("No importable rows — check your column mapping."); return; }

    const totals: ImportLeadsResult = { created: 0, duplicates: 0, failed: 0, errors: [] };
    setProgress({ done: 0, total: payload.length });
    try {
      for (let i = 0; i < payload.length; i += CHUNK) {
        const chunk = payload.slice(i, i + CHUNK);
        const res = (await importLeads.mutateAsync(chunk)) as ImportLeadsResult;
        totals.created += res.created;
        totals.duplicates += res.duplicates;
        totals.failed += res.failed;
        setProgress({ done: Math.min(i + CHUNK, payload.length), total: payload.length });
      }
      setResult(totals);
      setStage("result");
      if (totals.created > 0) toast.success(`Imported ${totals.created} lead${totals.created === 1 ? "" : "s"}.`);
    } catch {
      /* hook toasts the error */
    } finally {
      setProgress(null);
    }
  }

  const busy = importLeads.isPending || progress !== null;

  // Portaled to <body> so a transformed ancestor (the sidebar layout) can't trap this
  // fixed overlay — otherwise it centers within the offset content area (appears bottom-right).
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={busy ? undefined : onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className="w-full max-w-2xl bg-background border border-border rounded-xl shadow-xl flex flex-col max-h-[88vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-teal-600/10 text-teal-600 flex items-center justify-center">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold">Import Leads</h2>
              <p className="text-xs text-muted-foreground">{fileName || "Excel (.xlsx) or CSV file"}</p>
            </div>
          </div>
          <button onClick={busy ? undefined : onClose} disabled={busy}
            className="text-muted-foreground hover:text-foreground disabled:opacity-40"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          {stage === "upload" && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
              className="border-2 border-dashed border-border rounded-xl py-16 flex flex-col items-center justify-center text-center gap-3"
            >
              {parsing ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <UploadCloud className="h-8 w-8 text-muted-foreground" />}
              <div>
                <p className="font-medium">{parsing ? "Reading file…" : "Drop your file here"}</p>
                <p className="text-sm text-muted-foreground">Supports .xlsx, .xls and .csv — first row must be column headers.</p>
              </div>
              {!parsing && (
                <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>Choose file</Button>
              )}
              <input ref={inputRef} type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
            </div>
          )}

          {stage === "map" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Match each column to a CRM field. We auto-detected what we could — adjust anything below.
                Leave a column as <span className="font-medium text-foreground">Ignore</span> to skip it.
              </p>
              <div className="border border-border rounded-lg divide-y divide-border">
                {headers.map((h, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{h || <span className="text-muted-foreground italic">Column {i + 1}</span>}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        e.g. {rows.slice(0, 1).map((r) => r[i]).filter(Boolean)[0] || "—"}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    <select
                      className="bg-card border border-border rounded-md px-2 py-1.5 text-sm w-40 shrink-0"
                      value={mapping[i] ?? ""}
                      onChange={(e) => setMapping((prev) => prev.map((m, j) => (j === i ? (e.target.value as ImportTargetField | "") : m)))}
                    >
                      <option value="">Ignore</option>
                      {IMPORT_TARGET_FIELDS.map((f) => (
                        <option key={f} value={f}
                          disabled={f !== mapping[i] && mappedFields.has(f)}>
                          {TARGET_LABEL[f]}{f !== mapping[i] && mappedFields.has(f) ? " (used)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {!hasIdentity && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 text-amber-600 text-sm">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  Map at least one of <span className="font-medium">Email, Phone, Full name or First name</span> — every lead needs an identifier.
                </div>
              )}

              <div className="text-sm text-muted-foreground">
                {rows.length} row{rows.length === 1 ? "" : "s"} in file · <span className="text-foreground font-medium">{validCount}</span> importable
              </div>
            </div>
          )}

          {stage === "result" && result && (
            <div className="space-y-4 py-4">
              <div className="flex flex-col items-center text-center gap-2">
                <CheckCircle2 className="h-12 w-12 text-success" />
                <h3 className="font-semibold text-lg">Import complete</h3>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <ResultTile label="Created" value={result.created} cls="text-success" />
                <ResultTile label="Duplicates skipped" value={result.duplicates} cls="text-muted-foreground" />
                <ResultTile label="Failed" value={result.failed} cls={result.failed ? "text-destructive" : "text-muted-foreground"} />
              </div>
              {result.errors.length > 0 && (
                <div className="border border-border rounded-lg p-3 max-h-40 overflow-y-auto text-xs space-y-1">
                  <p className="font-medium text-muted-foreground mb-1">First {result.errors.length} problem row(s):</p>
                  {result.errors.map((e, i) => (
                    <div key={i} className="text-destructive">Row {e.row + 2}: {e.message}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 p-4 border-t border-border flex items-center justify-between gap-2">
          {stage === "map" ? (
            <>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setStage("upload"); setResult(null); }}>Back</Button>
              <Button size="sm" disabled={!hasIdentity || validCount === 0 || busy} onClick={runImport} className="gap-1.5">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                {progress ? `Importing ${progress.done}/${progress.total}…` : `Import ${validCount} lead${validCount === 1 ? "" : "s"}`}
              </Button>
            </>
          ) : stage === "result" ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => { setStage("upload"); setResult(null); setRows([]); setHeaders([]); }}>Import another</Button>
              <Button size="sm" onClick={onClose}>Done</Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={onClose} className="ml-auto">Cancel</Button>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

function ResultTile({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-center">
      <p className={cn("text-2xl font-bold", cls)}>{value}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
