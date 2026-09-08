import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, X, CheckCircle2, XCircle, Receipt, Clock, Send, DollarSign,
  FileText, Eye, Trash2,
} from "lucide-react";
// Send used in stat card icon below
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, formatCurrency, formatDate, getInitials, fitTextClass } from "@/lib/utils";
import { useCurrency, useCurrencyOptions } from "@/hooks/use-currency";
import { financeApi } from "@/lib/finance/finance.api";
import type { ExpenseDto as Expense, ExpenseStatus } from "@/lib/finance/finance.api";
import { useExpenses, useExpensesSummary, useApproveExpense, useRejectExpense, usePayExpense, useDeleteExpenseReceipt } from "@/hooks/finance/use-finance";
import { Can } from "@/components/auth/can";
import { toCsv, downloadFile } from "@/lib/csv";
import { exportPdf } from "@/lib/pdf";
import { ExportMenu } from "@/components/ui/export-menu";
import { AddExpenseForm } from "./add-expense-form";

const STATUS_STYLES_FALLBACK = "bg-muted text-muted-foreground";
const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending: "bg-warning/10 text-warning",
  approved: "bg-primary/10 text-primary",
  rejected: "bg-destructive/10 text-destructive",
  paid: "bg-success/10 text-success",
};

const CATEGORY_EMOJIS: Record<string, string> = {
  travel: "✈️",
  accommodation: "🏨",
  meals: "🍽️",
  entertainment: "🎭",
  software: "💻",
  office: "🏢",
  training: "📚",
  medical: "🏥",
  fuel: "⛽",
  other: "📎",
};

function ExpenseDrawer({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  const { t } = useTranslation("finance");
  const currency = useCurrency();
  const approve = useApproveExpense();
  const reject  = useRejectExpense();
  const pay     = usePayExpense();
  const busy    = approve.isPending || reject.isPending || pay.isPending;
  const statusLabel = t(`expenses.status.${expense.status}`, { defaultValue: t("expenses.status.unknown") });
  const categoryLabel = t(`expenses.category.${expense.category}`, { defaultValue: expense.category });
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
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{t("expenses.drawer.header")}</p>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                  {getInitials(expense.paidBy)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-mono text-xs text-muted-foreground">{expense.expenseNumber}</p>
                <p className="font-bold">{expense.paidBy}</p>
                <p className="text-xs text-muted-foreground">{categoryLabel}</p>
              </div>
            </div>
            <span className={cn("px-3 py-1 rounded-full text-xs font-semibold", STATUS_STYLES[expense.status] ?? STATUS_STYLES_FALLBACK)}>
              {statusLabel}
            </span>
          </div>

          {/* Action buttons */}
          {expense.status === "pending" && (
            <div className="flex gap-2">
              <Button size="sm" disabled={busy} className="gap-1.5 flex-1 bg-success hover:bg-success/90"
                onClick={() => approve.mutate(expense.id, { onSuccess: onClose })}>
                <CheckCircle2 className="h-3.5 w-3.5" /> {t("expenses.drawer.approve")}
              </Button>
              <Button size="sm" variant="outline" disabled={busy} className="gap-1.5 flex-1 text-destructive border-destructive/30 hover:bg-destructive/5"
                onClick={() => reject.mutate(expense.id, { onSuccess: onClose })}>
                <XCircle className="h-3.5 w-3.5" /> {t("expenses.drawer.reject")}
              </Button>
            </div>
          )}
          {expense.status === "approved" && (
            <Button size="sm" disabled={busy} className="gap-1.5 w-full"
              onClick={() => pay.mutate(expense.id, { onSuccess: onClose })}>
              <DollarSign className="h-3.5 w-3.5" /> {t("expenses.drawer.markPaid")}
            </Button>
          )}

          {/* Details */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">{t("expenses.drawer.title")}</span>
              <span className="text-sm font-medium">{expense.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">{t("expenses.drawer.amount")}</span>
              <span className="text-sm font-bold">{formatCurrency(expense.amount, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">{t("expenses.drawer.date")}</span>
              <span className="text-sm">{formatDate(expense.expenseDate, "medium")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">{t("expenses.drawer.category")}</span>
              <span className="text-sm">{CATEGORY_EMOJIS[expense.category] ?? "📎"} {categoryLabel}</span>
            </div>
            {expense.paymentMethod && (
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">{t("expenses.drawer.paymentMethod")}</span>
                <span className="text-sm capitalize">{expense.paymentMethod}</span>
              </div>
            )}
          </div>

          {/* Approval trail */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("expenses.drawer.approvalHistory")}</p>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
              <Clock className="h-4 w-4 text-warning mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">{t("expenses.drawer.submitted")}</p>
                <p className="text-xs text-muted-foreground">{t("expenses.drawer.byOn", { name: expense.paidBy, date: formatDate(expense.expenseDate, "medium") })}</p>
              </div>
            </div>
            {expense.approvedBy && expense.approvedAt && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-success/5 border border-success/20">
                <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-success">{t("expenses.drawer.approved")}</p>
                  <p className="text-xs text-muted-foreground">{t("expenses.drawer.byOn", { name: expense.approvedBy, date: formatDate(expense.approvedAt, "medium") })}</p>
                </div>
              </div>
            )}
            {expense.status === "rejected" && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-destructive">{t("expenses.drawer.rejected")}</p>
                </div>
              </div>
            )}
          </div>

          {expense.notes && (
            <div className="rounded-lg bg-muted/40 p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-1">{t("expenses.drawer.notes")}</p>
              <p className="text-sm">{expense.notes}</p>
            </div>
          )}

          <ReceiptBlock expense={expense} />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function ReceiptBlock({ expense }: { expense: Expense }) {
  const { t } = useTranslation("finance");
  const deleteReceipt = useDeleteExpenseReceipt();
  const [opening, setOpening] = React.useState(false);

  const viewReceipt = async () => {
    setOpening(true);
    try {
      const url = await financeApi.getExpenseReceiptObjectUrl(expense.id);
      window.open(url, "_blank", "noopener");
      // Revoke shortly after so the new tab has time to load it.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("expenses.drawer.openError"));
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="rounded-lg bg-muted/40 p-4">
      <p className="text-xs font-semibold text-muted-foreground mb-2">{t("expenses.drawer.receipt")}</p>
      {expense.hasReceipt ? (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm truncate flex-1" title={expense.receiptFileName ?? undefined}>
            {expense.receiptFileName ?? t("expenses.drawer.receiptFallback")}
          </span>
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={viewReceipt} disabled={opening}>
            <Eye className="h-3.5 w-3.5" /> {opening ? t("expenses.drawer.opening") : t("expenses.drawer.view")}
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-destructive"
            onClick={() => deleteReceipt.mutate(expense.id)} disabled={deleteReceipt.isPending}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("expenses.drawer.noReceipt")}</p>
      )}
    </div>
  );
}

export function ExpensesView() {
  const { t } = useTranslation("finance");
  const currency = useCurrency();
  const { data: expenses = [] } = useExpenses();
  const { data: expensesSummary } = useExpensesSummary();

  const exportCsv = () => {
    const csv = toCsv(expenses.map(e => ({
      "Expense #":  e.expenseNumber,
      "Title":      e.title,
      "Category":   e.category,
      "Paid By":    e.paidBy,
      "Date":       e.expenseDate,
      "Amount":     e.amount,
      "Currency":   currency,
      "Status":     e.status,
      "Approved By":e.approvedBy ?? "",
    })), ["Expense #","Title","Category","Paid By","Date","Amount","Currency","Status","Approved By"]);
    downloadFile(`expenses_${new Date().toISOString().split("T")[0]}.csv`, csv);
  };

  const exportPdfReport = () => exportPdf({
    title: "Expense Claims",
    subtitle: `${expenses.length} expenses`,
    columns: ["Expense #","Title","Category","Paid By","Date","Amount","Currency","Status"],
    rows: expenses.map(e => [e.expenseNumber, e.title, e.category, e.paidBy, e.expenseDate, e.amount, currency, e.status]),
    landscape: false,
  });
  const approveRow = useApproveExpense();
  const rejectRow  = useRejectExpense();

  const [search, setSearch] = React.useState("");
  const [activeStatus, setActiveStatus] = React.useState<ExpenseStatus | "all">("all");
  const [selectedExpense, setSelectedExpense] = React.useState<Expense | null>(null);
  const [showAddForm, setShowAddForm] = React.useState(false);

  const filtered = React.useMemo(() => {
    return expenses.filter((e) => {
      const matchStatus = activeStatus === "all" || e.status === activeStatus;
      const matchSearch =
        !search ||
        e.expenseNumber.toLowerCase().includes(search.toLowerCase()) ||
        e.paidBy.toLowerCase().includes(search.toLowerCase()) ||
        e.title.toLowerCase().includes(search.toLowerCase()) ||
        e.category.toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [expenses, search, activeStatus]);

  const STAT_CARDS = [
    { label: t("expenses.stat.totalClaims"), value: expensesSummary?.total ?? expenses.length, icon: Receipt, color: "text-primary", bg: "bg-primary/10", format: "number" as const },
    { label: t("expenses.stat.pending"), value: expensesSummary?.pending ?? expenses.filter(e => e.status === "pending").length, icon: Send, color: "text-warning", bg: "bg-warning/10", format: "number" as const },
    { label: t("expenses.stat.approved"), value: expensesSummary?.approved ?? expenses.filter(e => e.status === "approved").length, icon: CheckCircle2, color: "text-primary", bg: "bg-primary/10", format: "number" as const },
    { label: t("expenses.stat.paid"), value: expensesSummary?.paid ?? expenses.filter(e => e.status === "paid").length, icon: DollarSign, color: "text-success", bg: "bg-success/10", format: "number" as const },
    { label: t("expenses.stat.pendingApproval"), value: expensesSummary?.pendingApproval ?? 0, icon: Clock, color: "text-warning", bg: "bg-warning/10", format: "number" as const },
    { label: t("expenses.stat.totalAmount"), value: expensesSummary?.totalAmount ?? expenses.reduce((s, e) => s + e.amount, 0), icon: Receipt, color: "text-primary", bg: "bg-primary/10", format: "currency" as const },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("expenses.title")}</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">{t("expenses.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ExportMenu onCsv={exportCsv} onPdf={exportPdfReport} className="gap-2" />
          <Can permission="finance.expenses.create">
            <Button size="sm" className="gap-2" onClick={() => setShowAddForm(true)}>
              <Plus className="h-4 w-4" /> {t("expenses.newClaim")}
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
            {(() => {
              const display = card.format === "currency"
                ? formatCurrency(card.value as number, currency)
                : String(card.value);
              return (
                <p className={cn("font-bold leading-tight truncate", fitTextClass(display, "lg"), card.color)} title={display}>
                  {display}
                </p>
              );
            })()}
          </motion.div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("expenses.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(["all", "draft", "pending", "approved", "rejected", "paid"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setActiveStatus(s)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                activeStatus === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {s === "all" ? t("expenses.all") : t(`expenses.status.${s}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/30 border-b border-border">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">{t("expenses.table.claimNumber")}</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">{t("expenses.table.paidBy")}</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden md:table-cell">{t("expenses.table.category")}</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden sm:table-cell">{t("expenses.table.date")}</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">{t("expenses.table.amount")}</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground">{t("expenses.table.status")}</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground w-28">{t("expenses.table.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  {t("expenses.table.empty")}
                </td>
              </tr>
            ) : (
              filtered.map((expense) => (
                <tr
                  key={expense.id}
                  onClick={() => setSelectedExpense(expense)}
                  className="border-b border-border/30 last:border-0 hover:bg-muted/20 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs text-muted-foreground">{expense.expenseNumber}</p>
                    <p className="text-xs text-foreground/70 truncate max-w-[120px]">{expense.title}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {getInitials(expense.paidBy)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{expense.paidBy}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                    {CATEGORY_EMOJIS[expense.category] ?? "📎"} {t(`expenses.category.${expense.category}`, { defaultValue: expense.category })}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground hidden sm:table-cell">
                    {formatDate(expense.expenseDate, "medium")}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold">
                    {formatCurrency(expense.amount, currency)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold", STATUS_STYLES[expense.status] ?? STATUS_STYLES_FALLBACK)}>
                      {t(`expenses.status.${expense.status}`, { defaultValue: t("expenses.status.unknown") })}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    {expense.status === "pending" ? (
                      <div className="flex justify-center gap-1">
                        <button
                          onClick={() => approveRow.mutate(expense.id)}
                          disabled={approveRow.isPending}
                          className="p-1.5 rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => rejectRow.mutate(expense.id)}
                          disabled={rejectRow.isPending}
                          className="p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Drawer */}
      <AnimatePresence>
        {selectedExpense && (
          <ExpenseDrawer expense={selectedExpense} onClose={() => setSelectedExpense(null)} />
        )}
      </AnimatePresence>
      <AddExpenseForm open={showAddForm} onClose={() => setShowAddForm(false)} />
    </div>
  );
}

