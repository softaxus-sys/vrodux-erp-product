import * as React from "react";
import { motion } from "framer-motion";
import {
  ShoppingBag, FileText, Send, CheckCircle2, Package, Ban, PackageCheck, RotateCcw,
  Search, Plus, DollarSign, Calendar, AlertCircle, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { usePurchaseOrders, usePurchaseOrder, useUpdatePurchaseOrderStatus } from "@/hooks/purchase/use-purchase-orders";
import type { PurchaseOrderSummaryDto } from "@/lib/pos/types";
import { PurchaseOrderDrawer } from "./purchase-order-drawer";
import { AddPurchaseOrderForm } from "./add-purchase-order-form";
import { CreateGrnForm } from "@/modules/purchase/grn/components/create-grn-form";
import { CreatePurchaseReturnForm } from "@/modules/purchase/returns/components/create-purchase-return-form";
import { Can } from "@/components/auth/can";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  draft:    { label: "Draft",    color: "text-slate-600",   bg: "bg-slate-100 dark:bg-slate-800/50", dot: "bg-slate-400" },
  sent:     { label: "Sent",     color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-900/20",    dot: "bg-blue-500" },
  partial:  { label: "Partial",  color: "text-primary",     bg: "bg-primary/10",                     dot: "bg-primary" },
  received: { label: "Received", color: "text-success",     bg: "bg-success/10",                     dot: "bg-success" },
  cancelled:{ label: "Cancelled",color: "text-destructive", bg: "bg-destructive/10",                 dot: "bg-destructive" },
};

const STATUS_FILTERS = [
  { key: "",          label: "All" },
  { key: "draft",     label: "Draft" },
  { key: "sent",      label: "Sent" },
  { key: "partial",   label: "Partial" },
  { key: "received",  label: "Received" },
  { key: "cancelled", label: "Cancelled" },
];

export function PurchaseOrdersView() {
  const currency = useCurrency();
  const [search, setSearch]           = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [page, setPage]               = React.useState(1);
  const [selected, setSelected]       = React.useState<PurchaseOrderSummaryDto | null>(null);
  const [drawerOpen, setDrawerOpen]   = React.useState(false);
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [grnOrderId, setGrnOrderId]   = React.useState<string | null>(null);
  const [grnOpen, setGrnOpen]         = React.useState(false);
  const [returnOrderId, setReturnOrderId] = React.useState<string | null>(null);
  const [returnOpen, setReturnOpen]       = React.useState(false);

  const { data, isLoading } = usePurchaseOrders({
    page,
    pageSize: 25,
    status:   statusFilter || undefined,
    search:   search || undefined,
  });

  const updateStatus = useUpdatePurchaseOrderStatus();
  const { data: grnOrder } = usePurchaseOrder(grnOrderId);
  const { data: returnOrder } = usePurchaseOrder(returnOrderId);
  const items = data?.items ?? [];

  const stats = React.useMemo(() => ({
    total:    data?.totalCount ?? 0,
    draft:    items.filter(po => po.status === "draft").length,
    sent:     items.filter(po => po.status === "sent").length,
    partial:  items.filter(po => po.status === "partial").length,
    received: items.filter(po => po.status === "received").length,
    value:    items.reduce((s, po) => s + po.total, 0),
  }), [data?.totalCount, items]);

  const STAT_CARDS = [
    { label: "Total POs",   value: stats.total,                          icon: ShoppingBag,  color: "text-slate-600", bg: "bg-slate-100 dark:bg-slate-800/50" },
    { label: "Draft",       value: stats.draft,                          icon: FileText,     color: "text-slate-500", bg: "bg-slate-100 dark:bg-slate-800/50" },
    { label: "Sent",        value: stats.sent,                           icon: Send,         color: "text-blue-600",  bg: "bg-blue-50 dark:bg-blue-900/20" },
    { label: "Partial",     value: stats.partial,                        icon: Package,      color: "text-primary",   bg: "bg-primary/10" },
    { label: "Received",    value: stats.received,                       icon: CheckCircle2, color: "text-success",   bg: "bg-success/10" },
    { label: "Total Value", value: formatCurrency(stats.value, currency),   icon: DollarSign,   color: "text-primary",   bg: "bg-primary/10" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Purchase Orders</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage supplier orders from draft through receipt</p>
        </div>
        <Can permission="purchase.orders.create">
          <Button className="gap-2 h-9" onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4" />New PO
          </Button>
        </Can>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {STAT_CARDS.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div key={card.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", card.bg)}>
                <Icon className={cn("h-5 w-5", card.color)} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{card.label}</p>
                <p className="font-bold text-lg leading-tight">{card.value}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input placeholder="Search PO or vendor…" value={search}
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
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Loading purchase orders…</span>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">PO #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vendor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Created</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Expected</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Items</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-sm text-muted-foreground">No purchase orders found.</td></tr>
              ) : items.map((po, i) => {
                const sc = STATUS_CONFIG[po.status] ?? { label: po.status, color: "text-muted-foreground", bg: "bg-muted", dot: "bg-muted-foreground" };
                return (
                  <motion.tr key={po.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    onClick={() => { setSelected(po); setDrawerOpen(true); }}
                    className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors cursor-pointer">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-mono text-sm font-semibold">{po.orderNumber}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-medium">{po.vendorName}</p>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />{formatDate(po.createdAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      <span className="text-xs text-muted-foreground">{po.expectedDate ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="font-semibold text-sm">{formatCurrency(po.total, currency)}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right hidden md:table-cell">
                      <span className="text-sm text-muted-foreground">{po.itemCount}</span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />{sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                      {po.status === "draft" && (
                        <Can permission="purchase.orders.edit">
                          <Button size="sm" className="h-7 text-xs gap-1" disabled={updateStatus.isPending}
                            onClick={() => updateStatus.mutate({ id: po.id, status: "sent" })}>
                            <Send className="h-3 w-3" />Send
                          </Button>
                        </Can>
                      )}
                      {(po.status === "sent" || po.status === "partial") && (
                        <Can permission="purchase.orders.edit">
                          <Button size="sm" className="h-7 text-xs gap-1 bg-success hover:bg-success/90"
                            onClick={() => { setGrnOrderId(po.id); setGrnOpen(true); }}>
                            <PackageCheck className="h-3 w-3" />Receive
                          </Button>
                        </Can>
                      )}
                      {(po.status === "received" || po.status === "partial") && (
                        <Can permission="purchase.orders.edit">
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 ml-1.5"
                            onClick={() => { setReturnOrderId(po.id); setReturnOpen(true); }}>
                            <RotateCcw className="h-3 w-3" />Return
                          </Button>
                        </Can>
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
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs">Page {data.page} of {data.totalPages} ({data.totalCount} orders)</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8" disabled={!data.hasPrev} onClick={() => setPage(p => p - 1)}>Prev</Button>
            <Button variant="outline" size="sm" className="h-8" disabled={!data.hasNext} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      <PurchaseOrderDrawer order={selected} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <AddPurchaseOrderForm open={showAddForm} onClose={() => setShowAddForm(false)} />
      <CreateGrnForm order={grnOrder ?? null} open={grnOpen} onClose={() => { setGrnOpen(false); setGrnOrderId(null); }} />
      <CreatePurchaseReturnForm order={returnOrder ?? null} open={returnOpen} onClose={() => { setReturnOpen(false); setReturnOrderId(null); }} />
    </div>
  );
}

