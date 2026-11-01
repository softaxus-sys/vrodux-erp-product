import * as React from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Image as ImageIcon, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toCsv, downloadFile } from "@/lib/csv";
import { autoMapHeadings, cellNumber, readSheet, type SheetField } from "@/lib/import-sheet";
import { productImportApi, type ImportProductRow, type ImportProductsResult } from "@/lib/inventory/product-import.api";
import { useImportPhotoStatus, useRefreshAfterImport, useRetryFailedImportPhotos } from "@/hooks/inventory/use-product-import";

const SLICE = 500;

/** Headings are English so a file made from the template maps itself; `synonyms` catch other people's files. */
const FIELDS: SheetField[] = [
  { key: "name", header: "Name", sample: "Cotton T-Shirt - M", required: true, synonyms: ["name", "itemname", "productname", "title", "item", "product", "description1"] },
  { key: "sku", header: "SKU", sample: "TSH-M", synonyms: ["sku", "itemcode", "productcode", "code", "partnumber"] },
  { key: "barcode", header: "Barcode", sample: "", synonyms: ["barcode", "ean", "upc", "gtin"] },
  { key: "category", header: "Category", sample: "Clothing", synonyms: ["category", "productcategory", "type", "department"] },
  { key: "brand", header: "Brand", sample: "", synonyms: ["brand", "manufacturer", "vendor"] },
  { key: "unit", header: "Unit", sample: "pcs", synonyms: ["unit", "uom", "unitofmeasure"] },
  { key: "costPrice", header: "CostPrice", sample: "10", kind: "number", synonyms: ["costprice", "cost", "purchaseprice", "buyprice"] },
  { key: "salePrice", header: "SalePrice", sample: "25", kind: "number", synonyms: ["saleprice", "price", "sellingprice", "retailprice", "rate"] },
  { key: "taxRate", header: "TaxRate", sample: "5", kind: "number", synonyms: ["taxrate", "tax", "vat", "vatrate"] },
  { key: "openingStock", header: "OpeningStock", sample: "100", kind: "number", synonyms: ["openingstock", "stock", "quantity", "qty", "onhand", "stockqty"] },
  { key: "reorderLevel", header: "ReorderLevel", sample: "10", kind: "number", synonyms: ["reorderlevel", "reorder", "minstock", "minimumstock"] },
  { key: "description", header: "Description", sample: "Soft 100% cotton", synonyms: ["description", "details", "longdescription", "about"] },
  { key: "image1", header: "Image1", sample: "https://example.com/tshirt-front.jpg", synonyms: ["image1", "image", "imageurl", "image1url", "photo", "photo1", "picture", "picture1", "imagelink", "mainimage", "imgurl"] },
  { key: "image2", header: "Image2", sample: "https://example.com/tshirt-back.jpg", synonyms: ["image2", "image2url", "photo2", "picture2", "imagelink2"] },
  { key: "image3", header: "Image3", sample: "", synonyms: ["image3", "image3url", "photo3", "picture3"] },
  { key: "image4", header: "Image4", sample: "", synonyms: ["image4", "image4url", "photo4", "picture4"] },
  { key: "images", header: "Images", sample: "", synonyms: ["images", "imageurls", "photos", "pictures", "gallery"] },
  { key: "group", header: "Group", sample: "Cotton T-Shirt", synonyms: ["group", "parent", "parentsku", "variantgroup", "productgroup"] },
  { key: "options", header: "Options", sample: "Size=M; Colour=Blue", synonyms: ["options", "variant", "variantoptions", "attributes"] },
];

/** A cell holding several addresses ("a, b" / one per line) becomes a list; anything that is not a web address is dropped. */
const urlsFrom = (cell: string): string[] => cell.split(/[\s,;|]+/).map(s => s.trim()).filter(s => /^https?:\/\//i.test(s));

export function ProductImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation("inventory");
  const refresh = useRefreshAfterImport();
  const [fileName, setFileName] = React.useState("");
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [body, setBody] = React.useState<string[][]>([]);
  const [mapping, setMapping] = React.useState<string[]>([]);
  const [listOnline, setListOnline] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [result, setResult] = React.useState<ImportProductsResult | null>(null);

  const photos = useImportPhotoStatus(open && !!result);
  const retry = useRetryFailedImportPhotos();

  React.useEffect(() => {
    if (!open) { setFileName(""); setHeaders([]); setBody([]); setMapping([]); setListOnline(false); setRunning(false); setProgress(0); setResult(null); }
  }, [open]);

  // Pictures arrive after the import has finished; refresh the lists as they land.
  const pendingNow = photos.data?.pending ?? 0;
  const prevPending = React.useRef(0);
  React.useEffect(() => {
    if (prevPending.current > 0 && pendingNow < prevPending.current) refresh();
    prevPending.current = pendingNow;
  }, [pendingNow, refresh]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const sheet = await readSheet(file);
      if (sheet.length < 2) { toast.error(t("productImport.empty")); return; }
      setFileName(file.name); setResult(null);
      setHeaders(sheet[0]); setBody(sheet.slice(1));
      const guess = autoMapHeadings(sheet[0], FIELDS);
      // A file with an "Image" and an "Image URL" column would otherwise offer both to one field.
      setMapping(guess);
    } catch { toast.error(t("productImport.readFailed")); }
  };

  const used = new Set(mapping.filter(Boolean));
  const colOf = (key: string) => mapping.indexOf(key);
  const hasName = colOf("name") >= 0;

  const rows: ImportProductRow[] = React.useMemo(() => {
    const cell = (r: string[], key: string) => { const c = mapping.indexOf(key); return c >= 0 ? (r[c] ?? "").trim() : ""; };
    const num = (r: string[], key: string) => cellNumber(cell(r, key)) ?? 0;
    return body.map(r => ({
      name: cell(r, "name"), sku: cell(r, "sku") || null, barcode: cell(r, "barcode") || null,
      category: cell(r, "category") || null, brand: cell(r, "brand") || null, unit: cell(r, "unit") || null,
      costPrice: num(r, "costPrice"), salePrice: num(r, "salePrice"), taxRate: num(r, "taxRate"),
      openingStock: num(r, "openingStock"), reorderLevel: num(r, "reorderLevel"),
      description: cell(r, "description") || null,
      imageUrls: [...urlsFrom(cell(r, "image1")), ...urlsFrom(cell(r, "image2")), ...urlsFrom(cell(r, "image3")), ...urlsFrom(cell(r, "image4")), ...urlsFrom(cell(r, "images"))],
      group: cell(r, "group") || null, options: cell(r, "options") || null,
    })).filter(r => r.name || r.sku);
  }, [body, mapping]);

  const photoCount = rows.reduce((n, r) => n + r.imageUrls.length, 0);

  const run = async () => {
    setRunning(true); setProgress(0);
    const total: ImportProductsResult = { created: 0, existing: 0, listed: 0, photosQueued: 0, failed: [], notes: [] };
    try {
      for (let at = 0; at < rows.length; at += SLICE) {
        const r = await productImportApi.import(rows.slice(at, at + SLICE), listOnline);
        total.created += r.created; total.existing += r.existing; total.listed += r.listed; total.photosQueued += r.photosQueued;
        total.failed.push(...r.failed.map(f => ({ ...f, index: f.index + at })));
        total.notes.push(...r.notes);
        setProgress(Math.round((Math.min(at + SLICE, rows.length) / rows.length) * 100));
      }
      setResult(total);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
      if (total.created + total.existing > 0) { setResult(total); refresh(); }
    } finally { setRunning(false); }
  };

  const downloadTemplate = () =>
    downloadFile("product-import-template.csv",
      toCsv([Object.fromEntries(FIELDS.map(f => [f.header, f.sample]))], FIELDS.map(f => f.header)));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-2xl max-h-[88vh] flex flex-col">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-bold flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-primary" />{t("productImport.title")}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted/60 text-muted-foreground" aria-label={t("bulkTools.close")}><X className="h-4 w-4" /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {!result && (
            <>
              <div className="flex items-start justify-between gap-3 text-xs">
                <p className="text-muted-foreground">{t("productImport.hint")}</p>
                <button onClick={downloadTemplate} className="text-primary hover:underline font-medium shrink-0">{t("bulkTools.downloadTemplate")}</button>
              </div>

              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-7 cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-colors">
                <Upload className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm font-medium">{fileName || t("productImport.choose")}</span>
                <span className="text-xs text-muted-foreground">{rows.length > 0 ? t("bulkTools.rowsDetected", { count: rows.length }) : t("productImport.formats")}</span>
                <input type="file" accept=".csv,.txt,.xlsx,.xls,text/csv" className="hidden" onChange={onFile} />
              </label>

              {headers.length > 0 && (
                <div className="border border-border rounded-xl overflow-hidden">
                  <div className="px-3 py-2 bg-muted/30 text-xs font-semibold">{t("productImport.matchColumns")}</div>
                  <div className="divide-y divide-border max-h-64 overflow-y-auto">
                    {headers.map((h, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-1.5">
                        <div className="w-1/2 min-w-0">
                          <p className="text-xs font-medium truncate">{h || t("productImport.noHeading", { n: i + 1 })}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{body[0]?.[i]}</p>
                        </div>
                        <select value={mapping[i] ?? ""} onChange={e => setMapping(m => m.map((v, j) => (j === i ? e.target.value : v)))}
                          className="flex-1 h-8 px-2 rounded-lg border border-border bg-card text-xs">
                          <option value="">{t("productImport.ignore")}</option>
                          {FIELDS.map(f => (
                            <option key={f.key} value={f.key} disabled={used.has(f.key) && mapping[i] !== f.key}>{f.header}{f.required ? " *" : ""}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {headers.length > 0 && !hasName && (
                <p className="text-xs text-destructive flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" />{t("productImport.needName")}</p>
              )}

              {rows.length > 0 && (
                <>
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={listOnline} onChange={e => setListOnline(e.target.checked)} className="h-4 w-4 mt-0.5 rounded border-border" />
                    <span>
                      {t("productImport.listOnline")}
                      <span className="block text-xs text-muted-foreground">{t("productImport.listOnlineHint")}</span>
                    </span>
                  </label>
                  {photoCount > 0 && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <ImageIcon className="h-3.5 w-3.5" />{t("productImport.photoNote", { count: photoCount })}
                    </p>
                  )}
                </>
              )}

              {running && (
                <div className="space-y-1.5">
                  <div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>
                  <p className="text-xs text-muted-foreground text-center">{t("bulkTools.importing", { progress })}</p>
                </div>
              )}
            </>
          )}

          {result && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="h-4 w-4" />{t("productImport.done", { created: result.created })}</div>
              <ul className="text-xs text-muted-foreground space-y-1 ps-6 list-disc">
                {result.existing > 0 && <li>{t("productImport.existing", { count: result.existing })}</li>}
                {result.listed > 0 && <li>{t("productImport.listed", { count: result.listed })}</li>}
                {result.photosQueued > 0 && <li>{t("productImport.photosQueued", { count: result.photosQueued })}</li>}
              </ul>

              {result.photosQueued > 0 && photos.data && (
                <div className="border border-border rounded-xl p-3 space-y-2">
                  <p className="text-xs font-semibold flex items-center gap-1.5">
                    {photos.data.pending > 0 && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {photos.data.pending > 0
                      ? t("productImport.photosPending", { count: photos.data.pending })
                      : t("productImport.photosFinished")}
                  </p>
                  {photos.data.failedCount > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-warning font-semibold">{t("productImport.photosFailed", { count: photos.data.failedCount })}</p>
                        <Button size="sm" variant="outline" className="h-7" onClick={() => retry.mutate()} disabled={retry.isPending}>{t("productImport.retry")}</Button>
                      </div>
                      <div className="max-h-36 overflow-y-auto space-y-1">
                        {photos.data.failures.map(f => (
                          <p key={f.id} className="text-[11px] text-muted-foreground break-all">
                            <span className="font-medium text-foreground">{f.productName}</span> — {f.error}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {result.failed.length > 0 && (
                <div className="border border-warning/30 bg-warning/5 rounded-lg p-3 max-h-40 overflow-y-auto">
                  <p className="text-xs font-semibold text-warning flex items-center gap-1.5 mb-1.5"><AlertTriangle className="h-3.5 w-3.5" />{t("bulkTools.skippedCount", { count: result.failed.length })}</p>
                  {result.failed.map((f, i) => <p key={i} className="text-[11px] text-muted-foreground">{t("bulkTools.rowError", { row: f.index + 2, reason: f.reason })}</p>)}
                </div>
              )}
              {result.notes.length > 0 && (
                <div className="text-[11px] text-muted-foreground space-y-0.5 max-h-28 overflow-y-auto">
                  {result.notes.map((n, i) => <p key={i}>{n}</p>)}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={running}>{result ? t("bulkTools.close") : t("bulkTools.cancel")}</Button>
          {!result && (
            <Button onClick={run} disabled={rows.length === 0 || !hasName || running}>
              {running ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />{t("bulkTools.importingBtn")}</> : t("bulkTools.importCta", { count: rows.length })}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
