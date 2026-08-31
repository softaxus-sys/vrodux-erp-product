import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Receipt, FileText, CheckCircle2, Ban, Clock, Search, Plus,
  DollarSign, Calendar, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  usePurchaseBills, usePurchaseBillsSummary,
  useApprovePurchaseBill, useCancelPurchaseBill,
} from "@/hooks/finance/use-finance";
import type { PurchaseBillStatus } from "@/lib/finance/finance.api";
import { CreatePurchaseBillForm } from "./create-purchase-bill-form";
import { useCurrency } from "@/hooks/use-currency";

const getStatusConfig = (t: any): Record<PurchaseBillStatus, { label: string; color: string; bg: string; dot: string }> => ({
  draft:           { label: t("bills.status.draft"),           color: "text-slate-600",   bg: "bg-slate-100 dark:bg-slate-800/50", dot: "bg-slate-400" },
  approved:        { label: t("bills.status.approved"),        color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-900/20",    dot: "bg-blue-500" },
  partially_paid:  { label: t("bills.status.paid"),            color: "text-primary",     bg: "bg-primary/10",                     dot: "bg-primary" },
  paid:            { label: t("bills.status.paid"),            color: "text-success",     bg: "bg-success/10",                     dot: "bg-success" },
  cancelled:       { label: t("bills.status.cancelled"),       color: "text-destructive", bg: "bg-destructive/10",                 dot: "bg-destructive" },
});

export function PurchaseBillsView() {
  const { t } = useTranslation("purchase");
  const currency = useCurrency();
  const [search, setSearch]             = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [page, setPage]                 = React.useState(1);
  const [showAddForm, setShowAddForm]   = React.useState(false);

  const { data, isLoading } = usePurchaseBills({
    page,
    pageSize: 25,
    status:   statusFilter || undefined,
    search:   search || undefined,
  });
  const { data: summary } = usePurchaseBillsSummary();

  const approve = useApprovePurchaseBill();
  const cancel  = useCancelPurchaseBill();

  const items = data?.items ?? [];
  const STATUS_CONFIG = getStatusConfig(t);

  const STATUS_FILTERS = [
    { key: "",               label: t("common.all") },
    { key: "draft",          label: t("bills.status.draft") },
    { key: "approved",       label: t("bills.status.approved") },
    { key: "partially_paid", label: t("common.partiallyPaid") },
    { key: "paid",           label: t("bills.status.paid") },
    { key: "cancelled",      label: t("bills.status.cancelled") },
  ];

  const STAT_CARDS = [
    { label: t("common.totalInvoices"), value: summary?.totalBills ?? 0,                           icon: Receipt,      color: "text-slate-600", bg: "bg-slate-100 dark:bg-slate-800/50" },
    { label: t("bills.status.draft"),          value: summary?.draftCount ?? 0,                           icon: FileText,     color: "text-slate-500", bg: "bg-slate-100 dark:bg-slate-800/50" },
    { label: t("common.outstanding"),    value: summary?.outstandingCount ?? 0,                     icon: Clock,        color: "text-primary",   bg: "bg-primary/10" },
    { label: t("common.totalAmount"),   value: formatCurrency(summary?.totalAmount ?? 0, currency),   icon: DollarSign,   color: "text-primary",   bg: "bg-primary/10" },
    { label: t("common.paid"),           value: formatCurrency(summary?.totalPaid ?? 0, currency),     icon: CheckCircle2, color: "text-success",   bg: "bg-success/10" },
    { label: t("common.due"),            value: formatCurrency(summary?.totalOutstanding ?? 0, currency), icon: Ban,       color: "text-destructive", bg: "bg-destructive/10" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Purchase Invoices</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Vendor bills (AP) — tax, non-tax and import invoices</p>
        </div>
        <Button className="gap-2 h-9" onClick={() => setShowAddForm(true)}>
          <Plus className="h-4 w-4" />New Invoice
        </Button>
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
          <Input placeholder="Search bill # or supplier…" value={search}
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
            <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Loading purchase invoices…</span>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bill #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Supplier</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Bill Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Due Date</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Due</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-sm text-muted-foreground">No purchase invoices found.</td></tr>
              ) : items.map((b, i) => {
                const sc = STATUS_CONFIG[b.status] ?? { label: b.status, color: "text-muted-foreground", bg: "bg-muted", dot: "bg-muted-foreground" };
                return (
                  <motion.tr key={b.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <Receipt className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-mono text-sm font-semibold">{b.billNumber}</span>
                        {b.taxRate === 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground">Non-Tax</span>
                        )}
                        {b.currencyCode && b.currencyCode !== currency && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary">Import · {b.currencyCode}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-medium">{b.supplierName}</p>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />{formatDate(b.billDate)}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      <span className="text-xs text-muted-foreground">{formatDate(b.dueDate)}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="font-semibold text-sm">{formatCurrency(b.total, b.currencyCode || currency)}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right hidden md:table-cell">
                      <span className="text-sm text-muted-foreground">{formatCurrency(b.amountDue, b.currencyCode || currency)}</span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />{sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {b.status === "draft" && (
                        <Button size="sm" className="h-7 text-xs gap-1" disabled={approve.isPending}
                          onClick={() => approve.mutate(b.id)}>
                          <CheckCircle2 className="h-3 w-3" />Approve
                        </Button>
                      )}
                      {(b.status === "draft" || b.status === "approved") && (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 ml-1.5" disabled={cancel.isPending}
                          onClick={() => cancel.mutate(b.id)}>
                          <Ban className="h-3 w-3" />Cancel
                        </Button>
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
          <span className="text-muted-foreground text-xs">Page {data.page} of {data.totalPages} ({data.totalCount} invoices)</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8" disabled={!data.hasPrev} onClick={() => setPage(p => p - 1)}>Prev</Button>
            <Button variant="outline" size="sm" className="h-8" disabled={!data.hasNext} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      <CreatePurchaseBillForm open={showAddForm} onClose={() => setShowAddForm(false)} />
    </div>
  );
}
