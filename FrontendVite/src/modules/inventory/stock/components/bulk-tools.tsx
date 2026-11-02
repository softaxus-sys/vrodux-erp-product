import { getTenantCurrency } from "@/hooks/use-currency";
import { toast } from "sonner";
import i18n from "@/i18n";
import { inventoryProductsApi } from "@/lib/inventory/products.api";
import { toCsv, downloadFile } from "@/lib/csv";
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

/** The import lives in its own file (column matching, pictures, listing online). */
export { ProductImportDialog } from "./product-import-dialog";

// ── Label printing ───────────────────────────────────────────────────────────────

export function printProductLabels(products: ProductSummaryDto[], currency = getTenantCurrency()) {
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
