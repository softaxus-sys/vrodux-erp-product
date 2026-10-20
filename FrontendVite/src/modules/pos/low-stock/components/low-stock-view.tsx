/**
 * POS low stock report — every product that is out of stock or at/below its reorder level, in one
 * list, so a buyer can decide what to purchase without checking products one by one.
 */

import * as React from "react";
import { AlertTriangle, Loader2, PackageSearch, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExportMenu } from "@/components/ui/export-menu";
import { Can } from "@/components/auth/can";
import { cn, formatCurrency } from "@/lib/utils";
import { toCsv, downloadFile } from "@/lib/csv";
import { exportPdf } from "@/lib/pdf";
import { useCurrency } from "@/hooks/use-currency";
import { useLazyList } from "@/hooks/use-lazy-list";
import { useLowStockReport } from "@/hooks/pos/use-low-stock";
import type { LowStockItemDto } from "@/lib/pos/low-stock.api";

type StatusFilter = "all" | "out" | "low";

const SALES_WINDOWS = [7, 30, 60, 90];
const qty = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

export function LowStockView() {
  return (
    <Can
      anyOf={["pos.reports.view", "pos.products.view"]}
      fallback={
        <div className="p-10 text-center space-y-2">
          <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="font-semibold">You don't have access to the low stock report.</p>
          <p className="text-sm text-muted-foreground">It needs the POS reports or products permission. Ask an administrator to grant it.</p>
        </div>
      }
    >
      <Report />
    </Can>
  );
}

function Report() {
  const currency = useCurrency();
  const [salesDays, setSalesDays] = React.useState(30);
  const [status, setStatus] = React.useState<StatusFilter>("all");
  const [category, setCategory] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const { data, isLoading, isError, error, refetch, isFetching } = useLowStockReport(salesDays);

  const all = data?.items ?? [];
  const categories = React.useMemo(() => [...new Set(all.map(i => i.category))].sort(), [all]);

  const items = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter(i =>
      (status === "all" || i.status === status) &&
      (category === "all" || i.category === category) &&
      (!q || i.name.toLowerCase().includes(q) || i.sku?.toLowerCase().includes(q) || i.barcode?.toLowerCase().includes(q)));
  }, [all, status, category, search]);

  const { visible, hasMore, loadMore, sentinelRef } = useLazyList(items, 50);
  const money = (n: number) => formatCurrency(n, currency);
  const filteredCost = items.reduce((s, i) => s + i.estimatedCost, 0);
  const today = new Date().toISOString().split("T")[0];
  const soldLabel = `Sold (${salesDays}d)`;

  // Exports follow the filters on screen, so the file is the list the buyer is looking at.
  const exportCsv = () => {
    const csv = toCsv(
      items.map(i => ({
        Product: i.name, SKU: i.sku ?? "", Barcode: i.barcode ?? "", Category: i.category,
        Status: i.status === "out" ? "Out of stock" : "Low", "In Stock": i.stockQuantity, Unit: i.unit,
        "Reorder Level": i.reorderLevel, [soldLabel]: i.soldInPeriod,
        "Suggested Order": i.suggestedOrderQty, "Cost Price": i.costPrice, "Est. Cost": i.estimatedCost,
      })),
      ["Product", "SKU", "Barcode", "Category", "Status", "In Stock", "Unit", "Reorder Level", soldLabel, "Suggested Order", "Cost Price", "Est. Cost"],
    );
    downloadFile(`low_stock_${today}.csv`, csv);
  };

  const exportPdfReport = () => exportPdf({
    title: "Low Stock Report",
    subtitle: `${items.length} items to reorder · est. cost ${money(filteredCost)}`,
    columns: ["Product", "SKU", "Category", "Status", "In Stock", "Reorder Level", soldLabel, "Suggested Order", "Est. Cost"],
    rows: items.map(i => [
      i.name, i.sku ?? "—", i.category, i.status === "out" ? "Out of stock" : "Low",
      `${qty(i.stockQuantity)} ${i.unit}`, qty(i.reorderLevel), qty(i.soldInPeriod),
      qty(i.suggestedOrderQty), money(i.estimatedCost),
    ]),
    landscape: true,
  });

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <PackageSearch className="h-5 w-5 text-primary" />Low Stock
          </h1>
          <p className="text-sm text-muted-foreground">Everything that is out of stock or at its reorder level — your buying list.</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu onCsv={exportCsv} onPdf={exportPdfReport} disabled={items.length === 0} />
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching} aria-label="Refresh">
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />Loading stock levels…
        </div>
      ) : isError || !data ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-3">
          <p className="font-semibold">Couldn't load the low stock report.</p>
          <p className="text-sm text-muted-foreground">{(error as Error)?.message ?? "Unknown error"}</p>
          <Button size="sm" onClick={() => refetch()}>Try again</Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Tile label="Items to reorder" value={all.length.toLocaleString()} />
            <Tile label="Out of stock" value={data.outOfStockCount.toLocaleString()} tone="destructive" />
            <Tile label="Running low" value={data.lowStockCount.toLocaleString()} tone="warning" />
            <Tile label="Est. cost of suggested order" value={money(data.estimatedCost)} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[12rem] max-w-sm">
              <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, SKU or barcode" className="ps-8 h-9" />
            </div>
            <div className="flex gap-1.5">
              {([["all", "All"], ["out", "Out of stock"], ["low", "Low"]] as const).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setStatus(id)}
                  aria-pressed={status === id}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap border transition-colors",
                    status === id ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted/50",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <select value={category} onChange={e => setCategory(e.target.value)} aria-label="Category"
              className="h-9 rounded-lg border border-border bg-card px-2 text-sm">
              <option value="all">All categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={salesDays} onChange={e => setSalesDays(Number(e.target.value))} aria-label="Sales period"
              className="h-9 rounded-lg border border-border bg-card px-2 text-sm">
              {SALES_WINDOWS.map(d => <option key={d} value={d}>Sales: last {d} days</option>)}
            </select>
          </div>

          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              {all.length === 0 ? "Nothing is running low. Every tracked product is above its reorder level." : "No items match these filters."}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border">
                    <th className="text-start font-medium px-3 py-2">Product</th>
                    <th className="text-start font-medium px-3 py-2">Category</th>
                    <th className="text-start font-medium px-3 py-2">Status</th>
                    <th className="text-end font-medium px-3 py-2">In stock</th>
                    <th className="text-end font-medium px-3 py-2">Reorder level</th>
                    <th className="text-end font-medium px-3 py-2">{soldLabel}</th>
                    <th className="text-end font-medium px-3 py-2">Suggested order</th>
                    <th className="text-end font-medium px-3 py-2">Est. cost</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(i => <Row key={i.id} item={i} money={money} />)}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border font-semibold">
                    <td className="px-3 py-2" colSpan={7}>{items.length.toLocaleString()} item{items.length === 1 ? "" : "s"}</td>
                    <td className="px-3 py-2 text-end tabular-nums">{money(filteredCost)}</td>
                  </tr>
                </tfoot>
              </table>
              {hasMore && (
                <div ref={sentinelRef} className="p-3 text-center">
                  <Button variant="ghost" size="sm" onClick={loadMore}>Show more</Button>
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Suggested order brings stock up to twice the reorder level, or to what sold in the last {salesDays} days if that is higher.
            Products with stock tracking turned off, and inactive products, are not listed.
          </p>
        </>
      )}
    </div>
  );
}

function Row({ item: i, money }: { item: LowStockItemDto; money: (n: number) => string }) {
  const out = i.status === "out";
  return (
    <tr className="border-b border-border/60 last:border-0">
      <td className="px-3 py-2">
        <p className="font-medium">{i.name}</p>
        {(i.sku || i.barcode) && <p className="text-xs text-muted-foreground">{[i.sku, i.barcode].filter(Boolean).join(" · ")}</p>}
      </td>
      <td className="px-3 py-2 text-muted-foreground">{i.category}</td>
      <td className="px-3 py-2">
        <span className={cn("text-xs font-semibold rounded px-1.5 py-0.5 whitespace-nowrap",
          out ? "bg-destructive/10 text-destructive" : "bg-warning/15 text-warning")}>
          {out ? "Out of stock" : "Low"}
        </span>
      </td>
      <td className="px-3 py-2 text-end tabular-nums font-semibold">{qty(i.stockQuantity)} <span className="font-normal text-muted-foreground">{i.unit}</span></td>
      <td className="px-3 py-2 text-end tabular-nums">{i.reorderLevel > 0 ? qty(i.reorderLevel) : "—"}</td>
      <td className="px-3 py-2 text-end tabular-nums">{qty(i.soldInPeriod)}</td>
      <td className="px-3 py-2 text-end tabular-nums font-semibold">{i.suggestedOrderQty > 0 ? qty(i.suggestedOrderQty) : "—"}</td>
      <td className="px-3 py-2 text-end tabular-nums">{i.estimatedCost > 0 ? money(i.estimatedCost) : "—"}</td>
    </tr>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: "destructive" | "warning" }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-1 min-w-0">
      <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
      <p className={cn("text-2xl font-bold truncate tabular-nums",
        tone === "destructive" && "text-destructive", tone === "warning" && "text-warning")} title={value}>{value}</p>
    </div>
  );
}
