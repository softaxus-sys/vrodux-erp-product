import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, TrendingDown, Target, AlertTriangle, CheckCircle2, BarChart3,
  X, Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, fitTextClass } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import type { BudgetDto as Budget, BudgetStatus } from "@/lib/finance/finance.api";
import { useBudgets, useBudgetingSummary, useChangeBudgetStatus } from "@/hooks/finance/use-finance";
import { toCsv, downloadFile } from "@/lib/csv";
import { exportPdf } from "@/lib/pdf";
import { ExportMenu } from "@/components/ui/export-menu";
import { AddBudgetForm } from "./add-budget-form";
import { Can } from "@/components/auth/can";

const PAGE_SIZE = 30;

const STATUS_STYLES: Record<BudgetStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  approved: "bg-primary/10 text-primary",
  active: "bg-success/10 text-success",
  closed: "bg-muted text-muted-foreground",
};

/** Valid lifecycle transitions, mirroring Budget.CanTransitionTo on the backend. */
const STATUS_ACTIONS: Record<BudgetStatus, { to: BudgetStatus; labelKey: string; variant?: "outline" }[]> = {
  draft:    [{ to: "approved", labelKey: "budgeting.action.submitApproval" }],
  approved: [{ to: "active", labelKey: "budgeting.action.activate" }, { to: "draft", labelKey: "budgeting.action.sendBackDraft", variant: "outline" }],
  active:   [{ to: "closed", labelKey: "budgeting.action.closeBudget" }],
  closed:   [{ to: "active", labelKey: "budgeting.action.reopen", variant: "outline" }],
};

function UtilisationBar({ actual, budget }: { actual: number; budget: number }) {
  const pct = Math.min((actual / budget) * 100, 120);
  const isOver = actual > budget;
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", isOver ? "bg-destructive" : "bg-success")}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className={cn("text-xs font-medium w-12 text-right shrink-0", isOver ? "text-destructive" : "text-muted-foreground")}>
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

function BudgetDrawer({ budget, onClose }: { budget: Budget; onClose: () => void }) {
  const { t } = useTranslation("finance");
  const currency = useCurrency();
  const changeStatus = useChangeBudgetStatus();
  const actions = STATUS_ACTIONS[budget.status] ?? [];
  const variancePct = budget.totalBudgeted > 0
    ? ((budget.variance / budget.totalBudgeted) * 100).toFixed(1)
    : "0.0";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="fixed top-0 right-0 h-full w-full max-w-[480px] bg-background border-l border-border shadow-2xl z-50 flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{t("budgeting.drawer.header")}</p>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">{budget.name}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{budget.period} · {t("budgeting.drawer.lineItems", { count: budget.lineCount })}</p>
            </div>
            <span className={cn("px-3 py-1 rounded-full text-xs font-semibold", STATUS_STYLES[budget.status])}>
              {t(`budgeting.status.${budget.status}`)}
            </span>
          </div>

          {/* Status workflow actions */}
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">{t("budgeting.drawer.statusWorkflow")}</p>
            {actions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {actions.map((a) => (
                  <Button
                    key={a.to}
                    size="sm"
                    variant={a.variant ?? "default"}
                    disabled={changeStatus.isPending}
                    onClick={() => changeStatus.mutate({ id: budget.id, status: a.to })}
                  >
                    {t(a.labelKey)}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("budgeting.drawer.noActions")}</p>
            )}
            <p className="text-[11px] text-muted-foreground mt-2">{t("budgeting.drawer.lifecycle")}</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-border bg-card p-4 min-w-0">
              <p className="text-xs text-muted-foreground truncate">{t("budgeting.drawer.budgeted")}</p>
              <p className={cn("font-bold text-primary mt-1 truncate", fitTextClass(formatCurrency(budget.totalBudgeted, currency), "lg"))}
                 title={formatCurrency(budget.totalBudgeted, currency)}>
                {formatCurrency(budget.totalBudgeted, currency)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 min-w-0">
              <p className="text-xs text-muted-foreground truncate">{t("budgeting.drawer.actual")}</p>
              <p className={cn("font-bold mt-1 truncate", fitTextClass(formatCurrency(budget.totalActual, currency), "lg"), budget.totalActual > budget.totalBudgeted ? "text-destructive" : "text-success")}
                 title={formatCurrency(budget.totalActual, currency)}>
                {formatCurrency(budget.totalActual, currency)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 min-w-0">
              <p className="text-xs text-muted-foreground truncate">{t("budgeting.drawer.variance")}</p>
              <p className={cn("font-bold mt-1 truncate", fitTextClass(`${budget.variance > 0 ? "+" : ""}${formatCurrency(Math.abs(budget.variance), currency)}`, "lg"), budget.variance > 0 ? "text-destructive" : "text-success")}
                 title={`${budget.variance > 0 ? "+" : ""}${formatCurrency(Math.abs(budget.variance), currency)}`}>
                {budget.variance > 0 ? "+" : ""}{formatCurrency(Math.abs(budget.variance), currency)}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">{t("budgeting.drawer.utilisation")}</p>
            <UtilisationBar actual={budget.totalActual} budget={budget.totalBudgeted} />
          </div>

          <div className="space-y-0 divide-y divide-border/50">
            {[
              { label: t("budgeting.drawer.period"), value: budget.period ? budget.period.charAt(0).toUpperCase() + budget.period.slice(1) : "—" },
              { label: t("budgeting.drawer.variancePct"), value: `${Number(variancePct) > 0 ? "+" : ""}${variancePct}%` },
              { label: t("budgeting.drawer.lineItemsLabel"), value: String(budget.lineCount) },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center py-3">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="text-sm font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export function BudgetingView() {
  const { t } = useTranslation("finance");
  const currency = useCurrency();
  const [page, setPage] = React.useState(1);
  const { data: paged, isFetching } = useBudgets({ page, pageSize: PAGE_SIZE });
  const budgets    = paged?.items ?? [];
  const totalCount = paged?.totalCount ?? 0;
  const totalPages = paged?.totalPages ?? 1;

  // Exports carry the page on screen, not the whole ledger — the subtitle says which.
  const exportCsv = () => {
    const csv = toCsv(budgets.map(b => ({
      "Name":        b.name,
      "Period":      b.period,
      "Status":      b.status,
      "Budgeted":    b.totalBudgeted,
      "Actual":      b.totalActual,
      "Variance":    b.variance,
      "Line Items":  b.lineCount,
    })), ["Name","Period","Status","Budgeted","Actual","Variance","Line Items"]);
    downloadFile(`budgets_${new Date().toISOString().split("T")[0]}.csv`, csv);
  };

  const exportPdfReport = () => exportPdf({
    title: "Budget Overview",
    subtitle: `${budgets.length} of ${totalCount} budgets (page ${page})`,
    columns: ["Name","Period","Status","Budgeted (AED)","Actual (AED)","Variance (AED)","Lines"],
    rows: budgets.map(b => [b.name, b.period, b.status, b.totalBudgeted, b.totalActual, b.variance, b.lineCount]),
  });
  const { data: budgetingSummary } = useBudgetingSummary();

  const [selectedBudget, setSelectedBudget] = React.useState<Budget | null>(null);
  const [showAddForm, setShowAddForm] = React.useState(false);

  const totalBudgeted = budgetingSummary?.totalBudget ?? budgets.reduce((s, b) => s + b.totalBudgeted, 0);
  const totalActual   = budgetingSummary?.totalActual ?? budgets.reduce((s, b) => s + b.totalActual, 0);
  const utilisationPct = totalBudgeted > 0 ? ((totalActual / totalBudgeted) * 100).toFixed(1) : "0.0";

  const STAT_CARDS = [
    { label: t("budgeting.stat.totalBudgeted"), value: formatCurrency(totalBudgeted, currency), icon: Target, color: "text-primary", bg: "bg-primary/10" },
    { label: t("budgeting.stat.actualSpend"), value: formatCurrency(totalActual, currency), icon: BarChart3, color: "text-warning", bg: "bg-warning/10" },
    { label: t("budgeting.stat.overallVariance"), value: formatCurrency(budgetingSummary?.overallVariance ?? 0, currency), icon: TrendingDown, color: "text-success", bg: "bg-success/10" },
    { label: t("budgeting.stat.depsOver"), value: budgetingSummary?.depsOverBudget ?? budgets.filter(b => b.totalActual > b.totalBudgeted).length, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
    { label: t("budgeting.stat.depsUnder"), value: budgetingSummary?.depsUnderBudget ?? budgets.filter(b => b.totalActual <= b.totalBudgeted).length, icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
    { label: t("budgeting.stat.utilisation"), value: `${budgetingSummary?.utilisation ?? utilisationPct}%`, icon: TrendingUp, color: "text-primary", bg: "bg-primary/10" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("budgeting.title")}</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">{t("budgeting.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ExportMenu onCsv={exportCsv} onPdf={exportPdfReport} className="gap-2" />
          <Can permission="finance.budgeting.create">
            <Button size="sm" className="gap-2" onClick={() => setShowAddForm(true)}>
              <Plus className="h-4 w-4" /> {t("budgeting.newBudget")}
            </Button>
          </Can>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {STAT_CARDS.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card border border-border rounded-xl p-4 space-y-2 min-w-0"
          >
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", card.bg)}>
              <card.icon className={cn("h-4 w-4", card.color)} />
            </div>
            <p className="text-xs text-muted-foreground truncate">{card.label}</p>
            <p className={cn("font-bold leading-tight truncate", fitTextClass(card.value, "lg"), card.color)} title={String(card.value)}>{card.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-muted/30 border-b border-border">
          <p className="text-sm font-semibold">{t("budgeting.overview")}</p>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">{t("budgeting.table.budgetName")}</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">{t("budgeting.table.budgeted")}</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">{t("budgeting.table.actual")}</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">{t("budgeting.table.variance")}</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground w-48">{t("budgeting.table.utilisation")}</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground">{t("budgeting.table.status")}</th>
            </tr>
          </thead>
          <tbody>
            {budgets.map((budget) => {
              const varPct = budget.totalBudgeted > 0
                ? ((budget.variance / budget.totalBudgeted) * 100).toFixed(1)
                : "0.0";
              return (
                <tr
                  key={budget.id}
                  onClick={() => setSelectedBudget(budget)}
                  className="border-b border-border/30 last:border-0 hover:bg-muted/20 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold">{budget.name}</p>
                    <p className="text-xs text-muted-foreground">{budget.period} · {t("budgeting.table.linesShort", { count: budget.lineCount })}</p>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                    {formatCurrency(budget.totalBudgeted, currency)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium">
                    {formatCurrency(budget.totalActual, currency)}
                  </td>
                  <td className={cn("px-4 py-3 text-right text-sm font-semibold", budget.variance > 0 ? "text-destructive" : "text-success")}>
                    {budget.variance > 0 ? "+" : ""}{formatCurrency(Math.abs(budget.variance), currency)}
                    <span className="text-xs ml-1">({Number(varPct) > 0 ? "+" : ""}{varPct}%)</span>
                  </td>
                  <td className="px-4 py-3">
                    <UtilisationBar actual={budget.totalActual} budget={budget.totalBudgeted} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold", STATUS_STYLES[budget.status])}>
                      {t(`budgeting.status.${budget.status}`)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {totalCount > 0 && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              {t("budgeting.table.showing", {
                shown: `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, totalCount)}`,
                total: totalCount,
              })}
            </span>
            <div className="flex items-center gap-2">
              {/* Disabled while fetching, so a double-click cannot skip a page. */}
              <Button variant="outline" size="sm" className="h-8 text-xs"
                disabled={page <= 1 || isFetching}
                onClick={() => setPage(p => Math.max(1, p - 1))}>
                {t("budgeting.table.prev")}
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" className="h-8 text-xs"
                disabled={page >= totalPages || isFetching}
                onClick={() => setPage(p => p + 1)}>
                {t("budgeting.table.next")}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Drawer */}
      <AnimatePresence>
        {selectedBudget && (
          <BudgetDrawer budget={selectedBudget} onClose={() => setSelectedBudget(null)} />
        )}
      </AnimatePresence>
      <AddBudgetForm open={showAddForm} onClose={() => setShowAddForm(false)} />
    </div>
  );
}

