import * as React from "react";
import { motion } from "framer-motion";
import {
  Building2, CheckCircle2, AlertCircle, Ban, DollarSign,
  Search, Plus, Star, TrendingDown, LayoutGrid, List, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, formatCurrency, getInitials } from "@/lib/utils";
import { usePurchaseVendors } from "@/hooks/purchase/use-vendors";
import type { VendorDto } from "@/lib/pos/types";
import { VendorDrawer } from "./vendor-drawer";
import { AddVendorForm } from "./add-vendor-form";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  active:   { label: "Active",   color: "text-success",          bg: "bg-success/10",     dot: "bg-success" },
  inactive: { label: "Inactive", color: "text-muted-foreground", bg: "bg-muted",          dot: "bg-muted-foreground" },
  blocked:  { label: "Blocked",  color: "text-destructive",      bg: "bg-destructive/10", dot: "bg-destructive" },
};

const STATUS_FILTERS = [
  { key: "",         label: "All" },
  { key: "active",   label: "Active" },
  { key: "inactive", label: "Inactive" },
  { key: "blocked",  label: "Blocked" },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={cn("h-3 w-3", i <= Math.floor(rating) ? "fill-warning text-warning" : "text-muted-foreground/30")} />
      ))}
    </div>
  );
}

export function VendorsView() {
  const [search, setSearch]           = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [viewMode, setViewMode]       = React.useState<"list" | "grid">("list");
  const [page, setPage]               = React.useState(1);
  const [selected, setSelected]       = React.useState<VendorDto | null>(null);
  const [drawerOpen, setDrawerOpen]   = React.useState(false);
  const [showAddForm, setShowAddForm] = React.useState(false);

  const { data, isLoading } = usePurchaseVendors({
    page,
    pageSize: 25,
    search:   search || undefined,
    status:   statusFilter || undefined,
  });

  const items = data?.items ?? [];

  const stats = React.useMemo(() => ({
    total:    data?.totalCount ?? 0,
    active:   items.filter(v => v.status === "active").length,
    inactive: items.filter(v => v.status === "inactive").length,
    orders:   items.reduce((s, v) => s + v.purchaseOrderCount, 0),
  }), [data?.totalCount, items]);

  const STAT_CARDS = [
    { label: "Total Vendors", value: stats.total,    icon: Building2,    color: "text-slate-600",        bg: "bg-slate-100 dark:bg-slate-800/50" },
    { label: "Active",        value: stats.active,   icon: CheckCircle2, color: "text-success",          bg: "bg-success/10" },
    { label: "Inactive",      value: stats.inactive, icon: AlertCircle,  color: "text-muted-foreground", bg: "bg-muted" },
    { label: "Total POs",     value: stats.orders,   icon: TrendingDown, color: "text-primary",          bg: "bg-primary/10" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vendors</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage supplier profiles, contracts, and payment terms</p>
        </div>
        <Button className="gap-2 h-9" onClick={() => setShowAddForm(true)}>
          <Plus className="h-4 w-4" />Add Vendor
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STAT_CARDS.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div key={card.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", card.bg)}>
                <Icon className={cn("h-5 w-5", card.color)} />
              </div>
              <div><p className="text-xs text-muted-foreground">{card.label}</p><p className="font-bold text-lg leading-tight">{card.value}</p></div>
            </motion.div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input placeholder="Search vendors…" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 h-9 text-sm" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button key={f.key} onClick={() => { setStatusFilter(f.key); setPage(1); }}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                statusFilter === f.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground")}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 border border-border rounded-lg p-1">
          <button onClick={() => setViewMode("list")}
            className={cn("p-1.5 rounded-md transition-colors", viewMode === "list" ? "bg-muted" : "hover:bg-muted/50")}>
            <List className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setViewMode("grid")}
            className={cn("p-1.5 rounded-md transition-colors", viewMode === "grid" ? "bg-muted" : "hover:bg-muted/50")}>
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Loading vendors…</span>
        </div>
      ) : viewMode === "list" ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vendor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Contact</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">POs</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Rating</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-sm text-muted-foreground">No vendors found.</td></tr>
              ) : items.map((v, i) => {
                const sc = STATUS_CONFIG[v.status] ?? { label: v.status, color: "text-muted-foreground", bg: "bg-muted", dot: "bg-muted-foreground" };
                return (
                  <motion.tr key={v.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    onClick={() => { setSelected(v); setDrawerOpen(true); }}
                    className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors cursor-pointer">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">{getInitials(v.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-semibold">{v.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{v.code ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <span className="text-xs bg-muted px-2 py-0.5 rounded">{v.category}</span>
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      <p className="text-sm">{v.contactPerson ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{v.phone ?? v.email ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3.5 text-right hidden lg:table-cell">
                      <span className="text-sm font-medium">{v.purchaseOrderCount}</span>
                    </td>
                    <td className="px-4 py-3.5 text-center hidden md:table-cell">
                      <StarRating rating={v.rating} />
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />{sc.label}
                      </span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((v, i) => {
            const sc = STATUS_CONFIG[v.status] ?? { label: v.status, color: "text-muted-foreground", bg: "bg-muted", dot: "bg-muted-foreground" };
            return (
              <motion.div key={v.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                onClick={() => { setSelected(v); setDrawerOpen(true); }}
                className="bg-card border border-border rounded-xl p-5 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback className="text-sm font-bold bg-primary/10 text-primary">{getInitials(v.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-sm leading-tight">{v.name}</p>
                      <p className="text-xs text-muted-foreground">{v.category}</p>
                    </div>
                  </div>
                  <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold", sc.color, sc.bg)}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />{sc.label}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-muted/30 rounded-lg p-2.5">
                    <p className="text-[10px] text-muted-foreground">Purchase Orders</p>
                    <p className="font-bold text-sm">{v.purchaseOrderCount}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-2.5">
                    <p className="text-[10px] text-muted-foreground">Payment Terms</p>
                    <p className="font-bold text-sm truncate">{v.paymentTerms}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <StarRating rating={v.rating} />
                  <span className="text-[11px] text-muted-foreground font-mono">{v.currency}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs">Page {data.page} of {data.totalPages} ({data.totalCount} vendors)</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8" disabled={!data.hasPrev} onClick={() => setPage(p => p - 1)}>Prev</Button>
            <Button variant="outline" size="sm" className="h-8" disabled={!data.hasNext} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      <VendorDrawer vendor={selected} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <AddVendorForm open={showAddForm} onClose={() => setShowAddForm(false)} />
    </div>
  );
}

