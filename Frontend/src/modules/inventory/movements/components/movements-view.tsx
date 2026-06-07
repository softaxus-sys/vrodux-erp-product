"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, TrendingDown, RotateCcw, Sliders, AlertTriangle,
  Search, Plus, X, ArrowRightLeft, FileDown, Calendar, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import { useStockMovements } from "@/hooks/pos/use-stock-movements";
import type { StockMovementDto } from "@/lib/pos/types";
import { AddAdjustmentForm } from "./add-adjustment-form";

// ─── Config ───────────────────────────────────────────────────────────────────

type MovementType = "Receipt" | "Sale" | "Adjustment" | "Transfer" | "WriteOff" | "Return" | "Opening";

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  Receipt:    { label: "Stock In",   color: "text-success",     bg: "bg-success/10",     Icon: TrendingUp },
  Sale:       { label: "Stock Out",  color: "text-destructive", bg: "bg-destructive/10", Icon: TrendingDown },
  Adjustment: { label: "Adjustment", color: "text-warning",     bg: "bg-warning/10",     Icon: Sliders },
  Transfer:   { label: "Transfer",   color: "text-primary",     bg: "bg-primary/10",     Icon: ArrowRightLeft },
  WriteOff:   { label: "Write-Off",  color: "text-destructive", bg: "bg-destructive/10", Icon: AlertTriangle },
  Return:     { label: "Return",     color: "text-blue-600",    bg: "bg-blue-500/10",    Icon: RotateCcw },
  Opening:    { label: "Opening",    color: "text-slate-600",   bg: "bg-slate-100",      Icon: Sliders },
};

const TYPE_FILTERS = [
  { key: "",          label: "All" },
  { key: "Receipt",   label: "Stock In" },
  { key: "Sale",      label: "Stock Out" },
  { key: "Adjustment",label: "Adjustment" },
  { key: "Transfer",  label: "Transfer" },
  { key: "WriteOff",  label: "Write-Off" },
  { key: "Return",    label: "Return" },
];

// ─── Detail Drawer ─────────────────────────────────────────────────────────────

function MovementDetailDrawer({ record, open, onClose }: { record: StockMovementDto | null; open: boolean; onClose: () => void }) {
  if (!record) return null;
  const cfg = TYPE_CONFIG[record.adjustmentType] ?? { label: record.adjustmentType, color: "text-muted-foreground", bg: "bg-muted", Icon: Sliders };
  const Icon = cfg.Icon;
  const isPositive = record.quantity >= 0;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div className="fixed top-0 right-0 h-full w-full max-w-[440px] bg-background border-l border-border shadow-2xl z-50 flex flex-col"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 280 }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center", cfg.bg)}>
                  <Icon className={cn("h-4 w-4", cfg.color)} />
                </div>
                <div>
                  <p className="font-bold text-sm">{record.reference ?? "—"}</p>
                  <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", cfg.color, cfg.bg)}>{cfg.label}</span>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className={cn("rounded-xl p-4 border", isPositive ? "bg-success/5 border-success/20" : "bg-destructive/5 border-destructive/20")}>
                <p className="text-xs text-muted-foreground mb-1">Quantity Change</p>
                <p className={cn("text-3xl font-bold", isPositive ? "text-success" : "text-destructive")}>
                  {isPositive ? "+" : ""}{record.quantity}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Balance after: <span className="font-semibold">{record.balanceAfter}</span></p>
              </div>
              <div className="bg-muted/30 rounded-xl p-4 space-y-1 border border-border">
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">Product</p>
                <p className="font-semibold">{record.productName}</p>
                {record.productSku && <p className="text-xs font-mono text-muted-foreground">{record.productSku}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Date",      value: formatDate(record.createdAt) },
                  { label: "Reference", value: record.reference ?? "—" },
                  { label: "Type",      value: cfg.label },
                  { label: "Balance",   value: String(record.balanceAfter) },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-muted/30 rounded-xl p-3 border border-border">
                    <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
                    <p className="text-xs font-semibold">{value}</p>
                  </div>
                ))}
              </div>
              {record.notes && (
                <div className="bg-muted/30 rounded-xl p-4 border border-border">
                  <p className="text-xs text-muted-foreground font-semibold mb-1">Notes</p>
                  <p className="text-sm text-muted-foreground">{record.notes}</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-border">
              <Button variant="outline" className="w-full" onClick={onClose}>Close</Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function MovementsView() {
  const [search, setSearch]           = React.useState("");
  const [typeFilter, setTypeFilter]   = React.useState("");
  const [dateFilter, setDateFilter]   = React.useState("");
  const [page, setPage]               = React.useState(1);
  const [selected, setSelected]       = React.useState<StockMovementDto | null>(null);
  const [drawerOpen, setDrawerOpen]   = React.useState(false);
  const [showAddForm, setShowAddForm] = React.useState(false);

  const { data, isLoading } = useStockMovements({
    page,
    pageSize: 25,
    type: typeFilter || undefined,
    from: dateFilter || undefined,
    to:   dateFilter || undefined,
  });

  // Client-side search filter
  const items = React.useMemo(() => {
    if (!data?.items) return [];
    if (!search.trim()) return data.items;
    const s = search.toLowerCase();
    return data.items.filter(m =>
      m.productName.toLowerCase().includes(s) ||
      (m.productSku ?? "").toLowerCase().includes(s) ||
      (m.reference ?? "").toLowerCase().includes(s)
    );
  }, [data?.items, search]);

  // Stats computed from current page
  const stats = React.useMemo(() => ({
    total:       data?.totalCount ?? 0,
    inCount:     data?.items.filter(m => m.quantity > 0).length ?? 0,
    outCount:    data?.items.filter(m => m.quantity < 0).length ?? 0,
    adjustments: data?.items.filter(m => m.adjustmentType === "Adjustment").length ?? 0,
  }), [data]);

  const STATS = [
    { label: "Total Records", value: stats.total,       color: "text-slate-600", bg: "bg-slate-100 dark:bg-slate-800/50", Icon: Sliders },
    { label: "Stock In",      value: stats.inCount,     color: "text-success",   bg: "bg-success/10",     Icon: TrendingUp,   sub: "this page" },
    { label: "Stock Out",     value: stats.outCount,    color: "text-destructive", bg: "bg-destructive/10", Icon: TrendingDown, sub: "this page" },
    { label: "Adjustments",   value: stats.adjustments, color: "text-warning",   bg: "bg-warning/10",     Icon: RotateCcw },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stock Movements</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Complete audit trail of every inventory movement, adjustment, and write-off</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-9">
            <FileDown className="h-3.5 w-3.5" />Export
          </Button>
          <Button size="sm" className="gap-1.5 h-9" onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4" />Record Adjustment
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATS.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-card border border-border rounded-xl p-4">
            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center mb-3", s.bg)}>
              <s.Icon className={cn("h-4 w-4", s.color)} />
            </div>
            <p className="text-xs text-muted-foreground">{s.label}{(s as { sub?: string }).sub ? ` (${(s as { sub: string }).sub})` : ""}</p>
            <p className="font-bold text-lg leading-tight">{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input placeholder="Search product, SKU, ref…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9 h-9 text-sm" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {TYPE_FILTERS.map(f => (
            <button key={f.key} onClick={() => { setTypeFilter(f.key); setPage(1); }}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                typeFilter === f.key ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/40 text-muted-foreground hover:bg-muted")}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 bg-background border border-border rounded-lg px-3 h-9">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <input type="date" value={dateFilter} onChange={e => { setDateFilter(e.target.value); setPage(1); }}
            className="text-xs bg-transparent text-foreground focus:outline-none" />
          {dateFilter && (
            <button onClick={() => setDateFilter("")} className="text-muted-foreground hover:text-foreground ml-1">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Loading movements…</span>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Product</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Qty</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Balance</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Reference</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-sm text-muted-foreground">No movements found.</td></tr>
              ) : items.map((m, i) => {
                const cfg = TYPE_CONFIG[m.adjustmentType] ?? { label: m.adjustmentType, color: "text-muted-foreground", bg: "bg-muted", Icon: Sliders };
                const Icon = cfg.Icon;
                const isPos = m.quantity >= 0;
                return (
                  <motion.tr key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                    onClick={() => { setSelected(m); setDrawerOpen(true); }}
                    className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors cursor-pointer">
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold">{formatDate(m.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold", cfg.color, cfg.bg)}>
                        <Icon className="h-3 w-3" />{cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold">{m.productName}</p>
                      {m.productSku && <p className="text-xs font-mono text-muted-foreground">{m.productSku}</p>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn("text-sm font-bold", isPos ? "text-success" : "text-destructive")}>
                        {isPos ? "+" : ""}{m.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right hidden md:table-cell">
                      <span className="text-sm font-semibold">{m.balanceAfter}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-xs font-mono text-muted-foreground">{m.reference ?? "—"}</p>
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
          <span className="text-muted-foreground text-xs">Page {data.page} of {data.totalPages} ({data.totalCount} records)</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8" disabled={!data.hasPrev} onClick={() => setPage(p => p - 1)}>Prev</Button>
            <Button variant="outline" size="sm" className="h-8" disabled={!data.hasNext} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      <MovementDetailDrawer record={selected} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <AddAdjustmentForm open={showAddForm} onClose={() => setShowAddForm(false)} />
    </div>
  );
}
