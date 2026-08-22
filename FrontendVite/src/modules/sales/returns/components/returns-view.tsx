import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  RotateCcw, CheckCircle2, Clock, Ban, Banknote,
  Search, DollarSign, AlertCircle, Calendar, Plus, Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { SalesReturnDto as SalesReturn, ReturnStatus, ReturnReason } from "@/lib/sales/returns.api";
import { useReturns, useReturnsSummary } from "@/hooks/sales/use-returns";
import { ReturnDrawer } from "./return-drawer";
import { AddReturnForm } from "./add-return-form";
import { Can } from "@/components/auth/can";

const STATUS_FALLBACK = { color: "text-muted-foreground", bg: "bg-muted", dot: "bg-muted-foreground" };
const STATUS_STYLES: Record<string, { color: string; bg: string; dot: string }> = {
  pending:   { color: "text-slate-600",   bg: "bg-slate-100 dark:bg-slate-800/50",  dot: "bg-slate-400" },
  approved:  { color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-900/20",     dot: "bg-blue-500" },
  rejected:  { color: "text-destructive", bg: "bg-destructive/10",                  dot: "bg-destructive" },
  refunded:  { color: "text-success",     bg: "bg-success/10",                      dot: "bg-success" },
  completed: { color: "text-success",     bg: "bg-success/10",                      dot: "bg-success" },
};

function StatCard({ card, index }: { card: { label: string; value: number; icon: React.ElementType; color: string; bg: string; format: string }; index: number }) {
  const Icon = card.icon;
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
      <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", card.bg)}>
        <Icon className={cn("h-5 w-5", card.color)} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{card.label}</p>
        <p className="font-bold text-lg leading-tight">
          {card.format === "currency"
            ? formatCurrency(card.value as number, "AED")
            : card.value}
        </p>
      </div>
    </motion.div>
  );
}

export function ReturnsView() {
  const { t } = useTranslation("sales");
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<ReturnStatus | "all">("all");
  const [selected, setSelected] = React.useState<SalesReturn | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [showAddForm, setShowAddForm] = React.useState(false);

  const { data: returns_ = [] } = useReturns();
  const { data: returnsSummary } = useReturnsSummary();

  const STAT_CARDS = [
    { label: t("returns.stats.total"),      value: returnsSummary?.total            ?? returns_.length,                                                               icon: RotateCcw,    color: "text-slate-600",   bg: "bg-slate-100 dark:bg-slate-800/50", format: "number" },
    { label: t("returns.stats.pending"),    value: returnsSummary?.pending          ?? returns_.filter(r => r.status === "pending").length,                           icon: Clock,        color: "text-warning",     bg: "bg-warning/10",                     format: "number" },
    { label: t("returns.stats.approved"),   value: returnsSummary?.approved         ?? returns_.filter(r => r.status === "approved").length,                          icon: CheckCircle2, color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-900/20",    format: "number" },
    { label: t("returns.stats.refunded"),   value: returnsSummary?.refunded         ?? returns_.filter(r => r.status === "refunded" || r.status === "completed").length, icon: Banknote,  color: "text-success",     bg: "bg-success/10",                     format: "number" },
    { label: t("returns.stats.totalValue"), value: returnsSummary?.totalRefundValue ?? returns_.reduce((s, r) => s + r.refundAmount, 0),                              icon: DollarSign,   color: "text-destructive", bg: "bg-destructive/10",                 format: "currency" },
  ];

  const filtered = React.useMemo(() => {
    let list = returns_;
    if (statusFilter !== "all") list = list.filter(r => r.status === statusFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(r =>
        (r.returnNumber ?? "").toLowerCase().includes(s) ||
        (r.customerName ?? "").toLowerCase().includes(s) ||
        (r.orderNumber ?? "").toLowerCase().includes(s)
      );
    }
    return list;
  }, [search, statusFilter, returns_]);

  function openDrawer(r: SalesReturn) { setSelected(r); setDrawerOpen(true); }
  function closeDrawer() { setDrawerOpen(false); }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("returns.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("returns.description")}</p>
        </div>
        <Can permission="sales.returns.create">
          <Button size="sm" className="gap-2 h-9" onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4" /> {t("returns.new")}
          </Button>
        </Can>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {STAT_CARDS.map((card, i) => <StatCard key={card.label} card={card} index={i} />)}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input placeholder={t("returns.search")} value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {(["", "pending", "approved", "rejected", "refunded", "completed"] as const).map(key => (
            <button key={key} onClick={() => setStatusFilter(key as ReturnStatus | "all")}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                statusFilter === key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground")}>
              {t(`returns.filters.${key || "all"}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("returns.table.returnNum")}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("returns.table.customer")}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">{t("returns.table.orderRef")}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">{t("returns.table.reason")}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">{t("returns.table.date")}</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("returns.table.refundAmt")}</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("returns.table.status")}</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("returns.table.action")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-sm text-muted-foreground">{t("returns.noResults")}</td></tr>
            ) : filtered.map((r, i) => {
              const sc = STATUS_STYLES[r.status] ?? STATUS_FALLBACK;
              return (
                <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => openDrawer(r)}
                  className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors cursor-pointer">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <RotateCcw className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-mono text-sm font-semibold">{r.returnNumber}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-sm font-medium">{r.customerName}</p>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <span className="font-mono text-xs text-muted-foreground">{r.orderNumber}</span>
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <div className="flex items-center gap-1.5">
                      <AlertCircle className="h-3 w-3 text-warning shrink-0" />
                      <span className="text-sm text-muted-foreground">{t(`returns.reasons.${r.reason}`)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(r.requestDate, "short")}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="font-semibold text-sm">{formatCurrency(r.refundAmount, r.currency)}</span>
                    {r.refundMethod && <p className="text-[10px] text-muted-foreground capitalize mt-0.5">{r.refundMethod.replace("_", " ")}</p>}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />
                      {t(`returns.status.${r.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      {r.status === "pending" && (
                        <>
                          <button onClick={e => { e.stopPropagation(); openDrawer(r); }}
                            className="h-7 px-2.5 rounded-md text-xs font-medium bg-success/10 text-success hover:bg-success/20 transition-colors">
                            {t("returns.button.approve")}
                          </button>
                          <button onClick={e => { e.stopPropagation(); openDrawer(r); }}
                            className="h-7 px-2.5 rounded-md text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                            {t("returns.button.reject")}
                          </button>
                        </>
                      )}
                      {r.status === "approved" && (
                        <button onClick={e => { e.stopPropagation(); openDrawer(r); }}
                          className="h-7 px-2.5 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                          {t("returns.button.refund")}
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </motion.div>

      <ReturnDrawer ret={selected} open={drawerOpen} onClose={closeDrawer} />
      <AddReturnForm open={showAddForm} onClose={() => setShowAddForm(false)} />
    </div>
  );
}

