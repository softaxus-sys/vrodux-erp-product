import * as React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AlertTriangle, Download, FileSpreadsheet, Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildImportTemplate, downloadFile } from "@/lib/csv";
import { autoMapHeadings, cellNumber, readSheet, type SheetField } from "@/lib/import-sheet";
import type { ItemRequest } from "@/lib/trade/trade.api";
import { Modal, SELECT } from "../../shared/ui";

const FIELDS: SheetField[] = [
  { key: "description", header: "Description", sample: "Stainless steel pipe 2 inch", required: true, synonyms: ["description", "item", "itemname", "product", "productname", "goods", "name", "article"] },
  { key: "hsCode", header: "HS Code", sample: "7306.30", synonyms: ["hscode", "hs", "tariff", "tariffcode", "hsn", "commoditycode"] },
  { key: "originCountry", header: "Country of Origin", sample: "China", synonyms: ["origin", "countryoforigin", "origincountry", "madein", "coo"] },
  { key: "quantity", header: "Quantity", sample: "500", kind: "number", required: true, synonyms: ["quantity", "qty", "units", "pieces", "pcs", "count"] },
  { key: "unit", header: "Unit", sample: "pcs", synonyms: ["unit", "uom", "unitofmeasure", "measure"] },
  { key: "unitPrice", header: "Unit Price", sample: "12.50", kind: "number", required: true, synonyms: ["unitprice", "price", "rate", "priceperunit", "unitcost", "cost"] },
  { key: "weightKg", header: "Weight (kg)", sample: "850", kind: "number", synonyms: ["weight", "weightkg", "grossweight", "totalweight", "kg"] },
  { key: "volumeCbm", header: "Volume (CBM)", sample: "4.2", kind: "number", synonyms: ["volume", "volumecbm", "cbm", "m3", "cubicmeters"] },
  { key: "packages", header: "Packages", sample: "20", kind: "number", synonyms: ["packages", "cartons", "ctns", "boxes", "packs", "noofpackages"] },
  { key: "sku", header: "SKU", sample: "", synonyms: ["sku", "itemcode", "code", "partno", "partnumber", "productcode"] },
];

/**
 * Upload a CSV or Excel packing list / invoice and turn its rows into goods lines. Nothing is sent
 * to the server here — the lines land in the shipment form, which is where the user checks and
 * saves them, so a wrong mapping costs a glance rather than a clean-up.
 */
export function GoodsImportModal({ onImport, onClose }: { onImport: (items: ItemRequest[]) => void; onClose: () => void }) {
  const { t } = useTranslation("trade");
  const [fileName, setFileName] = React.useState("");
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [rows, setRows] = React.useState<string[][]>([]);
  const [mapping, setMapping] = React.useState<string[]>([]);
  const [reading, setReading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const label = (f: SheetField) => t(`goodsImport.field.${f.key}`);

  const handleFile = async (file: File) => {
    setReading(true);
    try {
      const grid = await readSheet(file);
      if (grid.length < 2) { toast.error(t("goodsImport.needHeader")); return; }
      const hdr = grid[0].map(h => h.trim());
      setFileName(file.name); setHeaders(hdr); setRows(grid.slice(1)); setMapping(autoMapHeadings(hdr, FIELDS));
    } catch (e) {
      toast.error(t("goodsImport.couldNotRead", { error: (e as Error).message }));
    } finally {
      setReading(false);
    }
  };

  // A row with no description, or no readable quantity, is skipped and counted — never guessed at.
  const { items, skipped } = React.useMemo(() => {
    const out: ItemRequest[] = []; let skip = 0;
    for (const r of rows) {
      const v: Record<string, string> = {};
      mapping.forEach((key, col) => { if (key) v[key] = (r[col] ?? "").trim(); });
      if (!Object.values(v).some(x => x)) continue;            // an empty line is not an error
      const quantity = cellNumber(v.quantity ?? "");
      const unitPrice = cellNumber(v.unitPrice ?? "") ?? 0;
      if (!v.description || quantity === null || quantity <= 0) { skip++; continue; }
      out.push({
        description: v.description, hsCode: v.hsCode || null, originCountry: v.originCountry || null, quantity,
        unit: v.unit || "pcs", unitPrice, weightKg: cellNumber(v.weightKg ?? ""), volumeCbm: cellNumber(v.volumeCbm ?? ""),
        packages: cellNumber(v.packages ?? "") === null ? null : Math.round(cellNumber(v.packages ?? "")!), sku: v.sku || null,
      });
    }
    return { items: out, skipped: skip };
  }, [rows, mapping]);

  const missing = FIELDS.filter(f => f.required && !mapping.includes(f.key));
  const mapped = headers.length > 0;

  return (
    <Modal title={t("goodsImport.title")} subtitle={mapped ? t("goodsImport.fileSummary", { file: fileName, count: rows.length }) : undefined}
      onClose={onClose} size="lg" layer={60}
      footer={mapped ? (
        <>
          <Button variant="outline" size="sm" onClick={() => { setHeaders([]); setRows([]); setMapping([]); }}>{t("goodsImport.back")}</Button>
          <Button size="sm" disabled={missing.length > 0 || items.length === 0} onClick={() => { onImport(items); onClose(); }}>
            {t("goodsImport.add", { count: items.length })}
          </Button>
        </>
      ) : undefined}>
      {!mapped ? (
        <>
          <p className="text-sm text-muted-foreground">{t("goodsImport.intro")}</p>
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv,.txt" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ""; }} />
          <button onClick={() => inputRef.current?.click()} disabled={reading}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) void handleFile(f); }}
            className="w-full rounded-xl border-2 border-dashed border-border hover:border-primary/60 hover:bg-muted/20 transition-colors px-6 py-10 text-center">
            {reading ? <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" /> : <UploadCloud className="h-8 w-8 mx-auto text-muted-foreground" />}
            <p className="text-sm font-semibold mt-3">{reading ? t("goodsImport.reading") : t("goodsImport.drop")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("goodsImport.dropHint")}</p>
          </button>
          <button onClick={() => downloadFile("shipment-goods-template.csv", buildImportTemplate(FIELDS.map(f => ({ label: f.header, sample: f.sample }))))}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            <Download className="h-3.5 w-3.5" />{t("goodsImport.template")}
          </button>
        </>
      ) : (
        <>
          <div className="rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-start font-semibold px-3 py-2">{t("goodsImport.column")}</th>
                  <th className="text-start font-semibold px-3 py-2">{t("goodsImport.firstValue")}</th>
                  <th className="text-start font-semibold px-3 py-2 w-56">{t("goodsImport.goesTo")}</th>
                </tr>
              </thead>
              <tbody>
                {headers.map((h, col) => (
                  <tr key={col} className="border-t border-border">
                    <td className="px-3 py-2 font-medium"><span className="inline-flex items-center gap-1.5"><FileSpreadsheet className="h-3.5 w-3.5 text-muted-foreground" />{h || `#${col + 1}`}</span></td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[14rem] truncate">{rows.find(r => (r[col] ?? "") !== "")?.[col] ?? "—"}</td>
                    <td className="px-3 py-2">
                      <select value={mapping[col] ?? ""} className={cn(SELECT, "h-8", !mapping[col] && "text-muted-foreground")}
                        onChange={e => setMapping(prev => prev.map((m, i) => (i === col ? e.target.value : m)))}>
                        <option value="">{t("goodsImport.ignore")}</option>
                        {FIELDS.map(f => (
                          <option key={f.key} value={f.key} disabled={mapping.includes(f.key) && mapping[col] !== f.key}>{label(f)}{f.required ? " *" : ""}</option>
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
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />{t("goodsImport.requiredMissing", { field: missing.map(label).join(", ") })}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("goodsImport.ready", { count: items.length })}{skipped > 0 && ` ${t("goodsImport.skipped", { count: skipped })}`}
            </p>
          )}
        </>
      )}
    </Modal>
  );
}
