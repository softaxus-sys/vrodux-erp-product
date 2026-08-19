import * as React from "react";
import { X, Upload, Loader2, CheckCircle2, AlertTriangle, Download, FileSpreadsheet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import i18n from "@/i18n";
import { useQueryClient } from "@tanstack/react-query";
import { inventoryProductsApi } from "@/lib/inventory/products.api";
import { inventoryCategoriesApi } from "@/lib/inventory/categories.api";
import { brandsApi } from "@/lib/inventory/brands.api";
import { uomApi } from "@/lib/inventory/uom.api";
import { inventoryProductKeys } from "@/hooks/inventory/use-inventory-products";
import { toCsv, parseCsv, downloadFile } from "@/lib/csv";
import { barcodeSvg } from "@/lib/barcode/code128";
import type { ProductSummaryDto } from "@/lib/inventory/types";
import { formatCurrency } from "@/lib/utils";

const CSV_HEADERS = [
  "Name", "SKU", "Barcode", "Category", "Brand", "Unit",
  "CostPrice", "SalePrice", "OpeningStock", "ReorderLevel",
] as const;

// ── Export ──────────────────────────────────────────────────────────────────────

/** Fetch the full catalogue and download it as a CSV file. */
export async function downloadProductsCsv() {
  const page = await inventoryProductsApi.getAll({ page: 1, pageSize: 100000 });
  const rows = page.items.map(p => ({
    Name:         p.name,
    SKU:          p.sku ?? "",
    Barcode:      p.barcode ?? "",
    Category:     p.categoryName,
    Brand:        p.brandName ?? "",
    Unit:         p.unit,
    CostPrice:    p.costPrice,
    SalePrice:    p.salePrice,
    OpeningStock: p.stockQuantity,
    ReorderLevel: p.reorderLevel,
  }));
  downloadFile(`products-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows, [...CSV_HEADERS]));
  toast.success(i18n.t("bulkTools.toast.exported", { ns: "inventory", count: rows.length }));
}

// ── Import ──────────────────────────────────────────────────────────────────────

interface ImportRow { Name: string; SKU: string; Barcode: string; Category: string; Brand: string; Unit: string; CostPrice: string; SalePrice: string; OpeningStock: string; ReorderLevel: string; }

export function ProductImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation("inventory");
  const qc = useQueryClient();
  const [rows, setRows]       = React.useState<ImportRow[]>([]);
  const [fileName, setFileName] = React.useState("");
  const [running, setRunning] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [result, setResult]   = React.useState<{ ok: number; failed: { row: number; reason: string }[] } | null>(null);

  React.useEffect(() => {
    if (!open) { setRows([]); setFileName(""); setRunning(false); setProgress(0); setResult(null); }
  }, [open]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    const text = await file.text();
    setRows(parseCsv(text) as unknown as ImportRow[]);
  };

  const runImport = async () => {
    setRunning(true);
    setProgress(0);
    const [cats, brands, uoms] = await Promise.all([
      inventoryCategoriesApi.getAll({}), brandsApi.getAll({}), uomApi.getAll({}),
    ]);
    const catBy   = new Map(cats.map(c => [c.name.toLowerCase(), c.id]));
    const brandBy = new Map(brands.map(b => [b.name.toLowerCase(), b.id]));
    const uomBy   = new Map(uoms.map(u => [u.symbol.toLowerCase(), u.id]));

    let ok = 0;
    const failed: { row: number; reason: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      try {
        if (!r.Name?.trim()) { failed.push({ row: i + 2, reason: t("bulkTools.missingName") }); continue; }
        const categoryId = catBy.get((r.Category ?? "").toLowerCase());
        if (!categoryId) { failed.push({ row: i + 2, reason: t("bulkTools.unknownCategory", { category: r.Category }) }); continue; }

        await inventoryProductsApi.create({
          name:            r.Name.trim(),
          sku:             r.SKU?.trim() || null,
          barcode:         r.Barcode?.trim() || null,
          categoryId,
          brandId:         brandBy.get((r.Brand ?? "").toLowerCase()) ?? null,
          unitOfMeasureId: uomBy.get((r.Unit ?? "").toLowerCase()) ?? null,
          unit:            r.Unit?.trim() || "pcs",
          costPrice:       parseFloat(r.CostPrice) || 0,
          salePrice:       parseFloat(r.SalePrice) || 0,
          taxRate:         0,
          openingStock:    parseFloat(r.OpeningStock) || 0,
          reorderLevel:    parseFloat(r.ReorderLevel) || 0,
          trackInventory:  true,
        });
        ok++;
      } catch (err) {
        failed.push({ row: i + 2, reason: (err as Error).message });
      }
      setProgress(Math.round(((i + 1) / rows.length) * 100));
    }

    setResult({ ok, failed });
    setRunning(false);
    qc.invalidateQueries({ queryKey: inventoryProductKeys.lists() });
    if (ok > 0) toast.success(t(ok === 1 ? "bulkTools.toast.importedOne" : "bulkTools.toast.importedMany", { count: ok }));
    if (failed.length) toast.error(t("bulkTools.toast.skipped", { count: failed.length }));
  };

  const downloadTemplate = () =>
    downloadFile("product-import-template.csv",
      toCsv([{ Name: "Sample Item", SKU: "ITM-001", Barcode: "", Category: "General", Brand: "", Unit: "pcs", CostPrice: "10", SalePrice: "15", OpeningStock: "100", ReorderLevel: "10" }], [...CSV_HEADERS]));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-bold flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-primary" />{t("bulkTools.importTitle")}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted/60 text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between text-xs">
            <p className="text-muted-foreground">{t("bulkTools.columns", { columns: CSV_HEADERS.join(", ") })}</p>
            <button onClick={downloadTemplate} className="text-primary hover:underline font-medium shrink-0">{t("bulkTools.downloadTemplate")}</button>
          </div>

          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-8 cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-colors">
            <Upload className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm font-medium">{fileName || t("bulkTools.chooseFile")}</span>
            <span className="text-xs text-muted-foreground">{rows.length > 0 ? t("bulkTools.rowsDetected", { count: rows.length }) : t("bulkTools.dragDrop")}</span>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
          </label>

          {rows.length > 0 && !result && (
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/30"><tr>
                  <th className="text-left px-2 py-1.5 font-semibold">{t("bulkTools.colName")}</th>
                  <th className="text-left px-2 py-1.5 font-semibold">{t("bulkTools.colCategory")}</th>
                  <th className="text-right px-2 py-1.5 font-semibold">{t("bulkTools.colSale")}</th>
                  <th className="text-right px-2 py-1.5 font-semibold">{t("bulkTools.colQty")}</th>
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {rows.slice(0, 5).map((r, i) => (
                    <tr key={i}><td className="px-2 py-1.5">{r.Name}</td><td className="px-2 py-1.5 text-muted-foreground">{r.Category}</td><td className="px-2 py-1.5 text-right">{r.SalePrice}</td><td className="px-2 py-1.5 text-right">{r.OpeningStock}</td></tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 5 && <p className="text-[11px] text-muted-foreground px-2 py-1.5 bg-muted/20">{t("bulkTools.moreRows", { count: rows.length - 5 })}</p>}
            </div>
          )}

          {running && (
            <div className="space-y-1.5">
              <div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>
              <p className="text-xs text-muted-foreground text-center">{t("bulkTools.importing", { progress })}</p>
            </div>
          )}

          {result && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="h-4 w-4" />{t("bulkTools.imported", { count: result.ok })}</div>
              {result.failed.length > 0 && (
                <div className="border border-warning/30 bg-warning/5 rounded-lg p-3 max-h-40 overflow-y-auto">
                  <p className="text-xs font-semibold text-warning flex items-center gap-1.5 mb-1.5"><AlertTriangle className="h-3.5 w-3.5" />{t("bulkTools.skippedCount", { count: result.failed.length })}</p>
                  {result.failed.map((f, i) => <p key={i} className="text-[11px] text-muted-foreground">{t("bulkTools.rowError", { row: f.row, reason: f.reason })}</p>)}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={running}>{result ? t("bulkTools.close") : t("bulkTools.cancel")}</Button>
          {!result && <Button onClick={runImport} disabled={rows.length === 0 || running}>
            {running ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />{t("bulkTools.importingBtn")}</> : t("bulkTools.importCta", { count: rows.length || "" })}
          </Button>}
        </div>
      </div>
    </div>
  );
}

// ── Label printing ───────────────────────────────────────────────────────────────

export function printProductLabels(products: ProductSummaryDto[], currency = "AED") {
  if (products.length === 0) { toast.error(i18n.t("bulkTools.toast.noProducts", { ns: "inventory" })); return; }
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) { toast.error(i18n.t("bulkTools.toast.popupBlocked", { ns: "inventory" })); return; }

  const labels = products.map(p => {
    const code = p.barcode || p.sku || p.id;
    return `
      <div class="label">
        <div class="name">${escapeHtml(p.name)}</div>
        <div class="meta">${p.sku ? escapeHtml(p.sku) : ""}</div>
        ${barcodeSvg(code, { height: 38, moduleWidth: 1.4, showText: true })}
        <div class="price">${escapeHtml(formatCurrency(p.salePrice, currency))}</div>
      </div>`;
  }).join("");

  win.document.write(`<!doctype html><html><head><title>${i18n.t("bulkTools.shelfLabels", { ns: "inventory" })}</title><style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; margin: 0; padding: 10px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .label { border: 1px solid #ddd; border-radius: 6px; padding: 8px; text-align: center; page-break-inside: avoid; }
    .name { font-size: 12px; font-weight: 600; line-height: 1.2; height: 29px; overflow: hidden; }
    .meta { font-size: 10px; color: #666; font-family: monospace; margin-bottom: 2px; }
    .price { font-size: 15px; font-weight: 700; margin-top: 2px; }
    svg { max-width: 100%; height: auto; }
    @media print { .toolbar { display: none; } @page { margin: 8mm; } }
  </style></head><body>
    <div class="toolbar" style="text-align:center;margin-bottom:10px">
      <button onclick="window.print()" style="padding:8px 20px;font-size:14px;cursor:pointer;border-radius:6px;border:1px solid #ccc;background:#2563eb;color:#fff">${i18n.t("bulkTools.print", { ns: "inventory", count: products.length })}</button>
    </div>
    <div class="grid">${labels}</div>
  </body></html>`);
  win.document.close();
}

function escapeHtml(s: string): string {
  return s.replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]!));
}
