import * as React from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  UploadCloud, FileSpreadsheet, X, Loader2, CheckCircle2, AlertTriangle, Download, Sparkles, ImageOff,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { parseDelimitedFile, toCsv, downloadFile } from "@/lib/csv";
import { restaurantApi, type ImportMenuRow, type ImportMenuResult } from "@/lib/restaurant/restaurant.api";
import { useImportMenu, useInvalidateRestaurant } from "@/hooks/restaurant/use-restaurant";
import { SAMPLE_MENU } from "@/lib/restaurant/menu-sample";

/**
 * Bulk menu import. The server creates categories and dishes in one call; photos are then fetched
 * by this browser from each row's Image URL and uploaded through the ordinary dish-photo endpoint —
 * so the server never fetches a URL a spreadsheet handed it, and photos get the usual compression
 * and storage-quota checks.
 */

type Field = "category" | "categoryDescription" | "name" | "description" | "price" | "prepTimeMinutes" | "allergens" | "imageUrl";

const HEADERS: Record<Field, string> = {
  category: "Category", categoryDescription: "Category Description", name: "Dish Name",
  description: "Description", price: "Price", prepTimeMinutes: "Prep Time (min)",
  allergens: "Allergens", imageUrl: "Image URL",
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Order matters: "category description" must be tested before "category", "dish name" before "description".
function detect(header: string): Field | null {
  const h = norm(header);
  if (!h) return null;
  if (h.includes("image") || h.includes("photo") || h.includes("picture") || h === "url") return "imageUrl";
  if (h.includes("category") && (h.includes("desc") || h.includes("note"))) return "categoryDescription";
  if (h.includes("category") || h === "section" || h === "group") return "category";
  if (h.includes("price") || h === "rate" || h === "amount") return "price";
  if (h.includes("prep") || h.includes("time") || h.includes("minutes")) return "prepTimeMinutes";
  if (h.includes("allerg")) return "allergens";
  if (h.includes("name") || h === "dish" || h === "item" || h === "title") return "name";
  if (h.includes("desc") || h.includes("detail")) return "description";
  return null;
}

interface ParsedRow extends ImportMenuRow { imageUrl: string | null }

/** "Rs. 1,250.00" → 1250. Returns null when there is no number to read. */
function parsePrice(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function toRows(grid: string[][]): { rows: ParsedRow[]; dropped: number } | null {
  const fields = grid[0].map(detect);
  const col = (f: Field) => fields.indexOf(f);
  if (col("category") < 0 || col("name") < 0 || col("price") < 0) return null;

  const rows: ParsedRow[] = [];
  let dropped = 0;
  for (const r of grid.slice(1)) {
    const get = (f: Field) => (col(f) >= 0 ? (r[col(f)] ?? "").trim() : "");
    const price = parsePrice(get("price"));
    if (!get("category") || !get("name") || price === null) { dropped++; continue; }
    const url = get("imageUrl");
    rows.push({
      category: get("category"), name: get("name"), price,
      description: get("description") || null,
      categoryDescription: get("categoryDescription") || null,
      prepTimeMinutes: Number.parseInt(get("prepTimeMinutes"), 10) || null,
      allergens: get("allergens") || null,
      imageUrl: /^https?:\/\//i.test(url) ? url : null,
    });
  }
  return { rows, dropped };
}

const SAMPLE_ROWS: ParsedRow[] = SAMPLE_MENU.map(s => ({ ...s, allergens: s.allergens || null }));

function downloadSample() {
  const records = SAMPLE_MENU.map(s => ({
    [HEADERS.category]: s.category, [HEADERS.categoryDescription]: s.categoryDescription,
    [HEADERS.name]: s.name, [HEADERS.description]: s.description, [HEADERS.price]: s.price,
    [HEADERS.prepTimeMinutes]: s.prepTimeMinutes, [HEADERS.allergens]: s.allergens, [HEADERS.imageUrl]: s.imageUrl,
  }));
  downloadFile("restaurant-menu-sample.csv", toCsv(records, Object.values(HEADERS)));
}

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;   // the server's per-photo limit
const PHOTO_WORKERS = 3;                   // polite to the image host, and to a slow connection

async function fetchAsDataUri(url: string): Promise<string> {
  const res = await fetch(url, { referrerPolicy: "no-referrer" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  if (!blob.type.startsWith("image/") || blob.size > MAX_PHOTO_BYTES) throw new Error("Not a usable image");
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

type Stage = "upload" | "preview" | "result";
interface Outcome extends ImportMenuResult { photosAdded: number; photosFailed: number }

export function ImportMenuModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return <AnimatePresence>{open && <Inner onClose={onClose} />}</AnimatePresence>;
}

function Inner({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("restaurant");
  const currency = useCurrency();
  const importMenu = useImportMenu();
  const invalidate = useInvalidateRestaurant();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [stage, setStage] = React.useState<Stage>("upload");
  const [fileName, setFileName] = React.useState("");
  const [rows, setRows] = React.useState<ParsedRow[]>([]);
  const [dropped, setDropped] = React.useState(0);
  const [parsing, setParsing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [photoProgress, setPhotoProgress] = React.useState<{ done: number; total: number } | null>(null);
  const [outcome, setOutcome] = React.useState<Outcome | null>(null);

  const busy = saving || photoProgress !== null;
  const sampleCategories = React.useMemo(() => new Set(SAMPLE_MENU.map(s => s.category)).size, []);
  const categoryCount = React.useMemo(() => new Set(rows.map(r => r.category.toLowerCase())).size, [rows]);
  const photoCount = rows.filter(r => r.imageUrl).length;

  async function handleFile(file: File) {
    setParsing(true);
    try {
      const grid = await parseDelimitedFile(file);
      if (grid.length < 2) { toast.error(t("menuMgmt.import.needHeaderRow")); return; }
      const parsed = toRows(grid);
      if (!parsed) { toast.error(t("menuMgmt.import.missingColumns")); return; }
      if (parsed.rows.length === 0) { toast.error(t("menuMgmt.import.needHeaderRow")); return; }
      setFileName(file.name); setRows(parsed.rows); setDropped(parsed.dropped); setStage("preview");
    } catch (e) {
      toast.error(t("menuMgmt.import.couldNotRead", { error: (e as Error).message }));
    } finally {
      setParsing(false);
    }
  }

  function loadSample() {
    setFileName("restaurant-menu-sample.csv"); setRows(SAMPLE_ROWS); setDropped(0); setStage("preview");
  }

  async function runImport() {
    setSaving(true);
    let result: ImportMenuResult;
    try {
      // imageUrl stays in the browser — the server is never asked to fetch it.
      result = await importMenu.mutateAsync(rows.map(({ imageUrl: _imageUrl, ...row }) => row));
    } catch {
      setSaving(false);
      return;   // hook toasts; the preview stays up for another try
    }
    setSaving(false);

    const jobs = result.items
      .map(i => ({ itemId: i.itemId, url: rows[i.row]?.imageUrl ?? null, name: rows[i.row]?.name ?? "dish" }))
      .filter((j): j is { itemId: string; url: string; name: string } => j.url !== null);

    let added = 0, failedPhotos = 0, done = 0;
    if (jobs.length > 0) {
      setPhotoProgress({ done: 0, total: jobs.length });
      let next = 0;
      const worker = async () => {
        while (next < jobs.length) {
          const job = jobs[next++];
          try {
            const data = await fetchAsDataUri(job.url);
            await restaurantApi.addItemImages(job.itemId, [{ data, fileName: `${job.name}.jpg` }]);
            added++;
          } catch {
            failedPhotos++;   // the dish is already saved; a photo can be added by hand
          }
          setPhotoProgress({ done: ++done, total: jobs.length });
        }
      };
      await Promise.all(Array.from({ length: PHOTO_WORKERS }, worker));
      setPhotoProgress(null);
      invalidate();
    }

    setOutcome({ ...result, photosAdded: added, photosFailed: failedPhotos });
    setStage("result");
  }

  const btn = "h-10 px-4 rounded-lg text-sm font-bold flex items-center justify-center gap-2 whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const primary = cn(btn, "bg-primary text-primary-foreground hover:brightness-110");
  const outline = cn(btn, "border-2 border-border bg-card hover:border-primary");
  const ghost = cn(btn, "text-muted-foreground hover:text-foreground hover:bg-muted");

  // Portaled to <body> so a transformed ancestor cannot trap this fixed overlay.
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={busy ? undefined : onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className="w-full max-w-3xl bg-background border border-border rounded-2xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-extrabold text-foreground">{t("menuMgmt.import.title")}</h2>
              <p className="text-sm text-muted-foreground truncate">{fileName || t("menuMgmt.import.subtitle")}</p>
            </div>
          </div>
          <button onClick={busy ? undefined : onClose} disabled={busy}
            className="h-10 w-10 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground disabled:opacity-40">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
          {stage === "upload" && (
            <>
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
                className="border-2 border-dashed border-border rounded-xl py-10 px-4 flex flex-col items-center text-center gap-3"
              >
                {parsing ? <Loader2 className="h-9 w-9 animate-spin text-primary" /> : <UploadCloud className="h-9 w-9 text-muted-foreground" />}
                <div>
                  <p className="font-bold text-foreground">{parsing ? t("menuMgmt.import.reading") : t("menuMgmt.import.dropHere")}</p>
                  <p className="text-sm text-muted-foreground">{t("menuMgmt.import.supports")}</p>
                </div>
                {!parsing && <button onClick={() => inputRef.current?.click()} className={outline}>{t("menuMgmt.import.chooseFile")}</button>}
                <input ref={inputRef} type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
                <p className="text-xs text-muted-foreground max-w-xl">{t("menuMgmt.import.columnsHint")}</p>
              </div>

              <div className="rounded-xl border-2 border-border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-extrabold text-foreground flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />{t("menuMgmt.import.sampleTitle")}</p>
                    <p className="text-sm text-muted-foreground">{t("menuMgmt.import.sampleText", { items: SAMPLE_MENU.length, categories: sampleCategories })}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={downloadSample} className={outline}><Download className="h-4 w-4" />{t("menuMgmt.import.downloadSample")}</button>
                    <button onClick={loadSample} className={primary}><Sparkles className="h-4 w-4" />{t("menuMgmt.import.useSample")}</button>
                  </div>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {SAMPLE_MENU.filter((_, i) => i % 5 === 0).slice(0, 12).map(s => <Thumb key={s.name} url={s.imageUrl} label={s.name} caption />)}
                </div>
                <p className="text-xs text-muted-foreground">{t("menuMgmt.import.samplePrices")}</p>
              </div>
            </>
          )}

          {stage === "preview" && (
            <>
              <div className="flex items-center gap-2 flex-wrap text-sm font-bold">
                <span className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary">{t("menuMgmt.import.previewTitle", { items: rows.length, categories: categoryCount })}</span>
                {photoCount > 0 && <span className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground">{t("menuMgmt.import.withPhotos", { count: photoCount })}</span>}
              </div>
              {dropped > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/15 text-warning text-sm font-semibold">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />{t("menuMgmt.import.rowsSkipped", { count: dropped })}
                </div>
              )}
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="max-h-[46vh] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 sticky top-0 text-muted-foreground">
                      <tr>
                        <th className="p-2.5 text-start font-bold w-16">{t("menuMgmt.import.colPhoto")}</th>
                        <th className="p-2.5 text-start font-bold">{t("menuMgmt.import.colDish")}</th>
                        <th className="p-2.5 text-start font-bold">{t("menuMgmt.import.colCategory")}</th>
                        <th className="p-2.5 text-end font-bold">{t("menuMgmt.import.colPrice")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.map((r, i) => (
                        <tr key={i}>
                          <td className="p-2"><Thumb url={r.imageUrl} label={r.name} /></td>
                          <td className="p-2.5">
                            <p className="font-bold text-foreground">{r.name}</p>
                            {r.description && <p className="text-xs text-muted-foreground line-clamp-1">{r.description}</p>}
                          </td>
                          <td className="p-2.5 text-muted-foreground font-semibold">{r.category}</td>
                          <td className="p-2.5 text-end font-extrabold tabular-nums whitespace-nowrap">{formatCurrency(r.price, currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {stage === "result" && outcome && (
            <div className="space-y-4 py-2">
              <div className="flex flex-col items-center text-center gap-2">
                <CheckCircle2 className="h-12 w-12 text-success" />
                <h3 className="text-lg font-extrabold text-foreground">{t("menuMgmt.import.complete")}</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <Tile label={t("menuMgmt.import.categoriesCreated")} value={outcome.categoriesCreated} cls="text-success" />
                <Tile label={t("menuMgmt.import.itemsCreated")} value={outcome.itemsCreated} cls="text-success" />
                <Tile label={t("menuMgmt.import.photosAdded")} value={outcome.photosAdded} cls="text-success" />
                <Tile label={t("menuMgmt.import.skipped")} value={outcome.skipped} cls="text-muted-foreground" />
                <Tile label={t("menuMgmt.import.failed")} value={outcome.failed} cls={outcome.failed ? "text-destructive" : "text-muted-foreground"} />
              </div>
              {outcome.photosFailed > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/15 text-warning text-sm font-semibold">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />{t("menuMgmt.import.photosFailed", { count: outcome.photosFailed })}
                </div>
              )}
              {outcome.errors.length > 0 && (
                <div className="border border-border rounded-lg p-3 max-h-40 overflow-y-auto text-xs space-y-1">
                  {outcome.errors.map((e, i) => (
                    <div key={i} className="text-destructive">{t("menuMgmt.import.rowError", { row: e.row + 2, message: e.message })}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 p-4 border-t border-border flex items-center justify-between gap-2">
          {stage === "preview" ? (
            <>
              <button className={ghost} disabled={busy} onClick={() => setStage("upload")}>{t("menuMgmt.import.back")}</button>
              <button className={primary} disabled={busy || rows.length === 0} onClick={runImport}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                {photoProgress ? t("menuMgmt.import.photosProgress", photoProgress)
                  : saving ? t("menuMgmt.import.saving")
                  : t("menuMgmt.import.importN", { count: rows.length })}
              </button>
            </>
          ) : stage === "result" ? (
            <button className={cn(primary, "ms-auto")} onClick={onClose}>{t("menuMgmt.import.done")}</button>
          ) : (
            <button className={cn(ghost, "ms-auto")} onClick={onClose}>{t("menuMgmt.import.cancel")}</button>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

/** A photo straight from its URL — preview only. A link that fails to load shows a placeholder. */
function Thumb({ url, label, caption }: { url: string | null; label: string; caption?: boolean }) {
  const [broken, setBroken] = React.useState(false);
  const box = caption ? "aspect-square w-full" : "h-11 w-11";
  return (
    <div className="min-w-0">
      {url && !broken ? (
        <img src={url} alt={label} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)}
          className={cn(box, "rounded-lg object-cover bg-muted")} />
      ) : (
        <div className={cn(box, "rounded-lg bg-muted flex items-center justify-center text-muted-foreground/50")}>
          <ImageOff className="h-4 w-4" />
        </div>
      )}
      {caption && <p className="text-[11px] font-semibold text-muted-foreground truncate mt-1">{label}</p>}
    </div>
  );
}

function Tile({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-center">
      <p className={cn("text-2xl font-black tabular-nums", cls)}>{value}</p>
      <p className="text-[11px] font-semibold text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
