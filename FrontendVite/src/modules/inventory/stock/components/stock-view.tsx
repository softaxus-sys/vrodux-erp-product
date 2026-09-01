import * as React from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Package, AlertTriangle, XCircle, DollarSign, Search, Plus,
  RefreshCw, ShoppingCart, Loader2, Upload, Download, Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, fitTextClass } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useInventoryProducts } from "@/hooks/inventory/use-inventory-products";
import type { ProductSummaryDto } from "@/lib/inventory/types";
import { StockDrawer } from "./stock-drawer";
import { AddStockItemForm } from "./add-stock-item-form";
import { Can } from "@/components/auth/can";
import { AddAdjustmentForm } from "../../movements/components/add-adjustment-form";
import { ProductImportDialog, downloadProductsCsv, printProductLabels } from "./bulk-tools";

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  in_stock:     { color: "text-success",          bg: "bg-success/10",     dot: "bg-success" },
  low_stock:    { color: "text-warning",          bg: "bg-warning/10",     dot: "bg-warning" },
  out_of_stock: { color: "text-destructive",      bg: "bg-destructive/10", dot: "bg-destructive" },
  inactive:     { color: "text-muted-foreground", bg: "bg-muted",          dot: "bg-muted-foreground" },
};

type StockStatus = "in_stock" | "low_stock" | "out_of_stock" | "inactive";

function getStockStatus(p: ProductSummaryDto): StockStatus {
  if (!p.isActive) return "inactive";
  if (p.stockQuantity <= 0) return "out_of_stock";
  if (p.isLowStock) return "low_stock";
  return "in_stock";
}

const STATUS_FILTERS: (StockStatus | "all")[] = ["all", "in_stock", "low_stock", "out_of_stock", "inactive"];

// ─── Main View ────────────────────────────────────────────────────────────────

export function StockView() {
  const { t } = useTranslation("inventory");
  const currency = useCurrency();
  const [search, setSearch]           = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StockStatus | "all">("all");
  const [page, setPage]               = React.useState(1);
  const [selectedProduct, setSelectedProduct] = React.useState<ProductSummaryDto | null>(null);
  const [drawerOpen, setDrawerOpen]   = React.useState(false);
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [editingId, setEditingId]     = React.useState<string | null>(null);
  const [adjustItemId, setAdjustItemId] = React.useState<string | null>(null);
  const [showImport, setShowImport]   = React.useState(false);
  const [exporting, setExporting]     = React.useState(false);

  const handleExport = async () => {
    setExporting(true);
    try { await downloadProductsCsv(); } finally { setExporting(false); }
  };

  const openEdit = (p: ProductSummaryDto) => { setDrawerOpen(false); setEditingId(p.id); setShowAddForm(true); };
  const openAdjust = (p: ProductSummaryDto) => { setDrawerOpen(false); setAdjustItemId(p.id); };
  const closeForm = () => { setShowAddForm(false); setEditingId(null); };

  const { data, isLoading } = useInventoryProducts({
    page,
    pageSize: 50,
    search:   search || undefined,
    isLowStock: statusFilter === "low_stock" ? true : undefined,
    isActive:   statusFilter === "inactive" ? false : statusFilter !== "all" ? true : undefined,
  });

  // Client-side status filter for out_of_stock / in_stock (server returns all active/inactive)
  const items = React.useMemo(() => {
    if (!data?.items) return [];
    if (statusFilter === "all" || statusFilter === "low_stock" || statusFilter === "inactive") return data.items;
    return data.items.filter(p => getStockStatus(p) === statusFilter);
  }, [data?.items, statusFilter]);

  // Summary stats from full dataset
  const stats = React.useMemo(() => ({
    total:    data?.totalCount ?? 0,
    lowStock: (data?.items ?? []).filter(p => p.isLowStock).length,
    outOfStock: (data?.items ?? []).filter(p => p.stockQuantity <= 0 && p.isActive).length,
    totalValue: (data?.items ?? []).reduce((sum, p) => sum + p.stockQuantity * p.salePrice, 0),
  }), [data]);

  const STATS = [
    { label: t("stock.stats.totalSkus"),   value: stats.total,                                     icon: Package,       color: "text-slate-600", bg: "bg-slate-100 dark:bg-slate-800/50" },
    { label: t("stock.stats.lowStock"),    value: stats.lowStock,                                  icon: AlertTriangle, color: "text-warning",   bg: "bg-warning/10" },
    { label: t("stock.stats.outOfStock"),  value: stats.outOfStock,                                icon: XCircle,       color: "text-destructive", bg: "bg-destructive/10" },
    { label: t("stock.stats.totalValue"),  value: formatCurrency(stats.totalValue, currency),         icon: DollarSign,    color: "text-success",   bg: "bg-success/10", isText: true },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("stock.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("stock.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{t("stock.export")}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={() => setShowImport(true)}>
            <Upload className="h-4 w-4" />{t("stock.import")}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={() => printProductLabels(items, currency)} disabled={items.length === 0}>
            <Printer className="h-4 w-4" />{t("stock.labels")}
          </Button>
          <Can permission="inventory.stock.create">
            <Button className="gap-2 h-9" onClick={() => setShowAddForm(true)}>
              <Plus className="h-4 w-4" />{t("stock.addProduct")}
            </Button>
          </Can>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATS.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 min-w-0">
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", s.bg)}>
                <Icon className={cn("h-5 w-5", s.color)} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{s.label}</p>
                <p className={cn("font-bold leading-tight truncate", fitTextClass(s.value, "lg"))} title={String(s.value)}>{s.value}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input placeholder={t("stock.searchPlaceholder")} value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 h-9 text-sm" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button key={f} onClick={() => { setStatusFilter(f); setPage(1); }}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize",
                statusFilter === f
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground")}>
              {f === "all" ? t("stock.filters.all") : t(`stockStatus.${f}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">{t("stock.loading")}</span>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("stock.table.product")}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">{t("stock.table.category")}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("stock.table.onHand")}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">{t("stock.table.reorderAt")}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("stock.table.price")}</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("stock.table.status")}</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-sm text-muted-foreground">{t("stock.empty")}</td></tr>
              ) : items.map((p, i) => {
                const status = getStockStatus(p);
                const sc = STATUS_CONFIG[status];
                return (
                  <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                    onClick={() => { setSelectedProduct(p); setDrawerOpen(true); }}
                    className={cn("border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors cursor-pointer",
                      status === "out_of_stock" ? "border-l-2 border-l-destructive" :
                      status === "low_stock"    ? "border-l-2 border-l-warning"     : "")}>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2 mb-0.5">
                        {p.sku && <p className="font-mono text-xs text-muted-foreground">{p.sku}</p>}
                        {p.barcode && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary">
                            <ShoppingCart className="h-2.5 w-2.5" />POS
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold">{p.name}</p>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <span className="text-xs bg-muted px-2 py-0.5 rounded font-medium">{p.categoryName}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <p className={cn("font-bold text-sm", p.isLowStock ? "text-warning" : "")}>
                        {p.stockQuantity} <span className="text-xs text-muted-foreground font-normal">{p.unit}</span>
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-right hidden md:table-cell">
                      <span className={cn("text-sm", p.isLowStock ? "text-destructive font-semibold" : "text-muted-foreground")}>
                        {p.reorderLevel} {p.unit}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <p className="font-semibold text-sm">{formatCurrency(p.salePrice, currency)}</p>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />{t(`stockStatus.${status}`)}
                      </span>
                      {p.isLowStock && status !== "out_of_stock" && (
                        <button onClick={e => { e.stopPropagation(); openAdjust(p); }}
                          className="mt-1 flex items-center gap-1 text-[10px] text-warning mx-auto hover:underline">
                          <RefreshCw className="h-2.5 w-2.5" />{t("stock.reorder")}
                        </button>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        )}
      </motion.div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground text-xs">
            {t("stock.pagination", { page: data.page, totalPages: data.totalPages, count: data.totalCount })}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8" disabled={!data.hasPrev} onClick={() => setPage(p => p - 1)}>{t("stock.prev")}</Button>
            <Button variant="outline" size="sm" className="h-8" disabled={!data.hasNext} onClick={() => setPage(p => p + 1)}>{t("stock.next")}</Button>
          </div>
        </div>
      )}

      <StockDrawer item={selectedProduct} open={drawerOpen} onClose={() => setDrawerOpen(false)}
        onEdit={openEdit} onAdjust={openAdjust} />
      <AddStockItemForm open={showAddForm} onClose={closeForm} editingId={editingId} />
      <AddAdjustmentForm open={!!adjustItemId} onClose={() => setAdjustItemId(null)}
        preselectedItemId={adjustItemId ?? undefined} />
      <ProductImportDialog open={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
}

