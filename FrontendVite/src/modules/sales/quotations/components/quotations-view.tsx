import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  FileText, Send, CheckCircle2, ArrowRight, Ban, Clock,
  Search, Plus, DollarSign, Loader2, Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useSalesQuotations, useConvertQuotationToOrder } from "@/hooks/sales/use-sales-quotations";
import type { SalesQuotationSummaryDto } from "@/lib/pos/types";
import { QuotationDrawer } from "./quotation-drawer";
import { AddQuotationForm } from "./add-quotation-form";
import { Can } from "@/components/auth/can";

const STATUS_STYLES: Record<string, { color: string; bg: string; dot: string }> = {
  draft:     { color: "text-slate-600",   bg: "bg-slate-100 dark:bg-slate-800/50", dot: "bg-slate-400" },
  sent:      { color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-900/20",    dot: "bg-blue-500" },
  approved:  { color: "text-success",     bg: "bg-success/10",                     dot: "bg-success" },
  rejected:  { color: "text-destructive", bg: "bg-destructive/10",                 dot: "bg-destructive" },
  expired:   { color: "text-warning",     bg: "bg-warning/10",                     dot: "bg-warning" },
  converted: { color: "text-primary",     bg: "bg-primary/10",                     dot: "bg-primary" },
};

const STATUS_KEYS = {
  draft:     "quotations.status.draft",
  sent:      "quotations.status.sent",
  approved:  "quotations.status.approved",
  rejected:  "quotations.status.rejected",
  expired:   "quotations.status.expired",
  converted: "quotations.status.converted",
};

export function QuotationsView() {
  const { t } = useTranslation("sales");
  const currency = useCurrency();
  const [search, setSearch]           = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [page, setPage]               = React.useState(1);
  const [selected, setSelected]       = React.useState<SalesQuotationSummaryDto | null>(null);
  const [drawerOpen, setDrawerOpen]   = React.useState(false);
  const [showAddForm, setShowAddForm] = React.useState(false);

  const { data, isLoading } = useSalesQuotations({
    page,
    pageSize: 25,
    status:   statusFilter || undefined,
    search:   search || undefined,
  });

  const convertToOrder = useConvertQuotationToOrder();
  const items = data?.items ?? [];

  const stats = React.useMemo(() => ({
    total:     data?.totalCount ?? 0,
    draft:     items.filter(q => q.status === "draft").length,
    sent:      items.filter(q => q.status === "sent").length,
    approved:  items.filter(q => q.status === "approved").length,
    converted: items.filter(q => q.status === "converted").length,
    pipeline:  items.filter(q => !["rejected", "expired", "converted"].includes(q.status)).reduce((s, q) => s + q.total, 0),
  }), [data?.totalCount, items]);

  const STAT_CARDS = [
    { label: t("quotations.stats.total"),     value: stats.total,                             icon: FileText,    color: "text-slate-600", bg: "bg-slate-100 dark:bg-slate-800/50" },
    { label: t("quotations.stats.draft"),     value: stats.draft,                             icon: Clock,       color: "text-slate-500", bg: "bg-slate-100 dark:bg-slate-800/50" },
    { label: t("quotations.stats.sent"),      value: stats.sent,                              icon: Send,        color: "text-blue-600",  bg: "bg-blue-50 dark:bg-blue-900/20" },
    { label: t("quotations.stats.approved"),  value: stats.approved,                          icon: CheckCircle2,color: "text-success",   bg: "bg-success/10" },
    { label: t("quotations.stats.converted"), value: stats.converted,                         icon: ArrowRight,  color: "text-primary",   bg: "bg-primary/10" },
    { label: t("quotations.stats.pipeline"),  value: formatCurrency(stats.pipeline, currency),   icon: DollarSign,  color: "text-success",   bg: "bg-success/10" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("quotations.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("quotations.description")}</p>
        </div>
        <Can permission="sales.quotations.create">
          <Button className="gap-2 h-9" onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4" />{t("quotations.new")}
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
          <Input placeholder={t("quotations.search")} value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 h-9 text-sm" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {(["", "draft", "sent", "approved", "rejected", "expired", "converted"] as const).map(key => (
            <button key={key} onClick={() => { setStatusFilter(key); setPage(1); }}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                statusFilter === key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground")}>
              {t(`quotations.filters.${key || "all"}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">{t("quotations.loading")}</span>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("quotations.table.quoteNum")}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("quotations.table.customer")}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">{t("quotations.table.created")}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">{t("quotations.table.validUntil")}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("quotations.table.total")}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">{t("quotations.table.items")}</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("quotations.table.status")}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("quotations.table.action")}</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-sm text-muted-foreground">{t("quotations.noResults")}</td></tr>
              ) : items.map((q, i) => {
                const styleKey = q.status as keyof typeof STATUS_STYLES;
                const style = STATUS_STYLES[styleKey] ?? { color: "text-muted-foreground", bg: "bg-muted", dot: "bg-muted-foreground" };
                const label = t(STATUS_KEYS[styleKey as keyof typeof STATUS_KEYS] ?? "common.unknown");
                return (
                  <motion.tr key={q.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    onClick={() => { setSelected(q); setDrawerOpen(true); }}
                    className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors cursor-pointer">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-mono text-sm font-semibold">{q.quotationNumber}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-medium">{q.customerName ?? t("quotations.walkIn")}</p>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />{formatDate(q.createdAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      <span className="text-xs text-muted-foreground">{q.validUntil ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="font-semibold text-sm">{formatCurrency(q.total, currency)}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right hidden md:table-cell">
                      <span className="text-sm text-muted-foreground">{q.itemCount}</span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold", style.color, style.bg)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />{label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                      {q.status === "approved" && (
                        <Button size="sm" className="h-7 text-xs gap-1" disabled={convertToOrder.isPending}
                          onClick={() => convertToOrder.mutate(q.id)}>
                          <ArrowRight className="h-3 w-3" />{t("quotations.button.convert")}
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
          <span className="text-muted-foreground text-xs">{t("quotations.pagination", { page: data.page, total: data.totalPages, count: data.totalCount })}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8" disabled={!data.hasPrev} onClick={() => setPage(p => p - 1)}>{t("quotations.button.prev")}</Button>
            <Button variant="outline" size="sm" className="h-8" disabled={!data.hasNext} onClick={() => setPage(p => p + 1)}>{t("quotations.button.next")}</Button>
          </div>
        </div>
      )}

      <QuotationDrawer quotation={selected} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <AddQuotationForm open={showAddForm} onClose={() => setShowAddForm(false)} />
    </div>
  );
}

