import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  ShoppingCart, Package, Truck, CheckCircle2, Clock, Ban,
  Search, Plus, DollarSign, Calendar, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useSalesOrders, useUpdateSalesOrderStatus, useSalesOrder } from "@/hooks/sales/use-sales-orders";
import type { SalesOrderSummaryDto } from "@/lib/pos/types";
import { OrderDrawer } from "./order-drawer";
import { AddSalesOrderForm } from "./add-sales-order-form";
import { CreateDeliveryChallanForm } from "@/modules/sales/delivery-challans/components/create-delivery-challan-form";
import { Can } from "@/components/auth/can";

const STATUS_CONFIG_KEYS = {
  pending:   "orders.status.pending",
  confirmed: "orders.status.confirmed",
  shipped:   "orders.status.shipped",
  delivered: "orders.status.delivered",
  cancelled: "orders.status.cancelled",
};

const STATUS_STYLES: Record<string, { color: string; bg: string; dot: string }> = {
  pending:   { color: "text-slate-600",   bg: "bg-slate-100 dark:bg-slate-800/50", dot: "bg-slate-400" },
  confirmed: { color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-900/20",    dot: "bg-blue-500" },
  shipped:   { color: "text-primary",     bg: "bg-primary/10",                     dot: "bg-primary" },
  delivered: { color: "text-success",     bg: "bg-success/10",                     dot: "bg-success" },
  cancelled: { color: "text-destructive", bg: "bg-destructive/10",                 dot: "bg-destructive" },
};

export function OrdersView() {
  const { t } = useTranslation("sales");
  const currency = useCurrency();
  const [search, setSearch]           = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [page, setPage]               = React.useState(1);
  const [selected, setSelected]       = React.useState<SalesOrderSummaryDto | null>(null);
  const [drawerOpen, setDrawerOpen]   = React.useState(false);
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [dcOrderId, setDcOrderId]     = React.useState<string | null>(null);
  const [showDcForm, setShowDcForm]   = React.useState(false);

  const { data, isLoading } = useSalesOrders({
    page,
    pageSize: 25,
    status:   statusFilter || undefined,
    search:   search || undefined,
  });

  const updateOrder = useUpdateSalesOrderStatus();
  const { data: dcOrder } = useSalesOrder(dcOrderId);

  const items = data?.items ?? [];

  // Stats derived from current page items
  const stats = React.useMemo(() => ({
    total:     data?.totalCount ?? 0,
    pending:   items.filter(o => o.status === "pending").length,
    shipped:   items.filter(o => o.status === "shipped").length,
    delivered: items.filter(o => o.status === "delivered").length,
    cancelled: items.filter(o => o.status === "cancelled").length,
    revenue:   items.filter(o => o.status === "delivered").reduce((s, o) => s + o.total, 0),
  }), [data?.totalCount, items]);

  const STAT_CARDS = [
    { label: t("orders.stats.total"),      value: stats.total,                                icon: ShoppingCart, color: "text-slate-600", bg: "bg-slate-100 dark:bg-slate-800/50", isText: false },
    { label: t("orders.stats.pending"),    value: stats.pending,                              icon: Clock,        color: "text-slate-500", bg: "bg-slate-100 dark:bg-slate-800/50", isText: false },
    { label: t("orders.stats.shipped"),    value: stats.shipped,                              icon: Truck,        color: "text-primary",   bg: "bg-primary/10",                    isText: false },
    { label: t("orders.stats.delivered"),  value: stats.delivered,                            icon: CheckCircle2, color: "text-success",   bg: "bg-success/10",                    isText: false },
    { label: t("orders.stats.cancelled"),  value: stats.cancelled,                            icon: Ban,          color: "text-destructive", bg: "bg-destructive/10",              isText: false },
    { label: t("orders.stats.revenue"),    value: formatCurrency(stats.revenue, currency),   icon: DollarSign,   color: "text-success",   bg: "bg-success/10",                    isText: true },
  ];

  function handleStatusChange(order: SalesOrderSummaryDto, newStatus: string) {
    updateOrder.mutate({ id: order.id, status: newStatus });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("orders.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("orders.description")}</p>
        </div>
        <Can permission="sales.orders.create">
          <Button className="gap-2 h-9" onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4" />{t("orders.new")}
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
          <Input placeholder={t("orders.search")} value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 h-9 text-sm" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {(["", "pending", "confirmed", "shipped", "delivered", "cancelled"] as const).map(key => (
            <button key={key} onClick={() => { setStatusFilter(key); setPage(1); }}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                statusFilter === key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground")}>
              {t(`orders.filters.${key || "all"}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">{t("orders.loading")}</span>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("orders.table.orderNum")}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("orders.table.customer")}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">{t("orders.table.date")}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">{t("orders.table.expected")}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("orders.table.total")}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">{t("orders.table.items")}</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("orders.table.status")}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("orders.table.action")}</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-sm text-muted-foreground">{t("orders.noResults")}</td></tr>
              ) : items.map((o, i) => {
                const styleKey = o.status as keyof typeof STATUS_STYLES;
                const style = STATUS_STYLES[styleKey] ?? { color: "text-muted-foreground", bg: "bg-muted", dot: "bg-muted-foreground" };
                const label = t(STATUS_CONFIG_KEYS[styleKey as keyof typeof STATUS_CONFIG_KEYS] ?? "common.unknown");
                return (
                  <motion.tr key={o.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    onClick={() => { setSelected(o); setDrawerOpen(true); }}
                    className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors cursor-pointer">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-mono text-sm font-semibold">{o.orderNumber}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-medium">{o.customerName ?? t("orders.walkIn")}</p>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />{formatDate(o.createdAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      <span className="text-xs text-muted-foreground">{o.expectedDate ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="font-semibold text-sm">{formatCurrency(o.total, currency)}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right hidden md:table-cell">
                      <span className="text-sm text-muted-foreground">{o.itemCount}</span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold", style.color, style.bg)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />{label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                      {o.status === "pending" && (
                        <Can permission="sales.orders.edit">
                          <Button size="sm" className="h-7 text-xs gap-1" onClick={() => handleStatusChange(o, "confirmed")}>
                            <CheckCircle2 className="h-3 w-3" />{t("orders.button.confirm")}
                          </Button>
                        </Can>
                      )}
                      {(o.status === "confirmed" || o.status === "shipped") && (
                        <Can permission="sales.orders.edit">
                          <Button size="sm" className="h-7 text-xs gap-1" onClick={() => { setDcOrderId(o.id); setShowDcForm(true); }}>
                            <Truck className="h-3 w-3" />{t("orders.button.delivery")}
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
          <span className="text-muted-foreground text-xs">{t("orders.pagination", { page: data.page, total: data.totalPages, count: data.totalCount })}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8" disabled={!data.hasPrev} onClick={() => setPage(p => p - 1)}>{t("orders.button.prev")}</Button>
            <Button variant="outline" size="sm" className="h-8" disabled={!data.hasNext} onClick={() => setPage(p => p + 1)}>{t("orders.button.next")}</Button>
          </div>
        </div>
      )}

      <OrderDrawer order={selected} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <AddSalesOrderForm open={showAddForm} onClose={() => setShowAddForm(false)} />
      <CreateDeliveryChallanForm order={dcOrder ?? null} open={showDcForm} onClose={() => setShowDcForm(false)} />
    </div>
  );
}

