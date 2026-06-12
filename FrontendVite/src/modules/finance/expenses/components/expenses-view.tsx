import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, X, CheckCircle2, XCircle, Receipt, Clock, Send, DollarSign,
} from "lucide-react";
// Send used in stat card icon below
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, formatCurrency, formatDate, getInitials } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import type { ExpenseDto as Expense, ExpenseStatus } from "@/lib/finance/finance.api";
import { useExpenses, useExpensesSummary, useApproveExpense, useRejectExpense, usePayExpense } from "@/hooks/finance/use-finance";
import { toCsv, downloadFile } from "@/lib/csv";
import { exportPdf } from "@/lib/pdf";
import { ExportMenu } from "@/components/ui/export-menu";
import { AddExpenseForm } from "./add-expense-form";

const STATUS_STYLES_FALLBACK = "bg-muted text-muted-foreground";
const STATUS_LABELS_FALLBACK = "Unknown";
const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending: "bg-warning/10 text-warning",
  approved: "bg-primary/10 text-primary",
  rejected: "bg-destructive/10 text-destructive",
  paid: "bg-success/10 text-success",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Paid",
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
  const approve = useApproveExpense();
  const reject  = useRejectExpense();
  const pay     = usePayExpense();
  const busy    = approve.isPending || reject.isPending || pay.isPending;
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
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Expense Claim</p>
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
                <p className="text-xs text-muted-foreground capitalize">{expense.category}</p>
              </div>
            </div>
            <span className={cn("px-3 py-1 rounded-full text-xs font-semibold capitalize", STATUS_STYLES[expense.status] ?? STATUS_STYLES_FALLBACK)}>
              {STATUS_LABELS[expense.status] ?? STATUS_LABELS_FALLBACK}
            </span>
          </div>

          {/* Action buttons */}
          {expense.status === "pending" && (
            <div className="flex gap-2">
              <Button size="sm" disabled={busy} className="gap-1.5 flex-1 bg-success hover:bg-success/90"
                onClick={() => approve.mutate(expense.id, { onSuccess: onClose })}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Approve
              </Button>
              <Button size="sm" variant="outline" disabled={busy} className="gap-1.5 flex-1 text-destructive border-destructive/30 hover:bg-destructive/5"
                onClick={() => reject.mutate(expense.id, { onSuccess: onClose })}>
                <XCircle className="h-3.5 w-3.5" /> Reject
              </Button>
            </div>
          )}
          {expense.status === "approved" && (
            <Button size="sm" disabled={busy} className="gap-1.5 w-full"
              onClick={() => pay.mutate(expense.id, { onSuccess: onClose })}>
              <DollarSign className="h-3.5 w-3.5" /> Mark as Paid
            </Button>
          )}

          {/* Details */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Title</span>
              <span className="text-sm font-medium">{expense.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Amount</span>
              <span className="text-sm font-bold">{formatCurrency(expense.amount, expense.currency ?? "AED")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Date</span>
              <span className="text-sm">{formatDate(expense.expenseDate, "medium")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Category</span>
              <span className="text-sm capitalize">{CATEGORY_EMOJIS[expense.category] ?? "📎"} {expense.category}</span>
            </div>
            {expense.paymentMethod && (
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Payment Method</span>
                <span className="text-sm capitalize">{expense.paymentMethod}</span>
              </div>
            )}
          </div>

          {/* Approval trail */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Approval History</p>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
              <Clock className="h-4 w-4 text-warning mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Submitted</p>
                <p className="text-xs text-muted-foreground">by {expense.paidBy} on {formatDate(expense.expenseDate, "medium")}</p>
              </div>
            </div>
            {expense.approvedBy && expense.approvedAt && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-success/5 border border-success/20">
                <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-success">Approved</p>
                  <p className="text-xs text-muted-foreground">by {expense.approvedBy} on {formatDate(expense.approvedAt, "medium")}</p>
                </div>
              </div>
            )}
            {expense.status === "rejected" && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-destructive">Rejected</p>
                </div>
              </div>
            )}
          </div>

          {expense.notes && (
            <div className="rounded-lg bg-muted/40 p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Notes</p>
              <p className="text-sm">{expense.notes}</p>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export function ExpensesView() {
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
      "Currency":   e.currency ?? "AED",
      "Status":     e.status,
      "Approved By":e.approvedBy ?? "",
    })), ["Expense #","Title","Category","Paid By","Date","Amount","Currency","Status","Approved By"]);
    downloadFile(`expenses_${new Date().toISOString().split("T")[0]}.csv`, csv);
  };

  const exportPdfReport = () => exportPdf({
    title: "Expense Claims",
    subtitle: `${expenses.length} expenses`,
    columns: ["Expense #","Title","Category","Paid By","Date","Amount","Currency","Status"],
    rows: expenses.map(e => [e.expenseNumber, e.title, e.category, e.paidBy, e.expenseDate, e.amount, e.currency ?? "AED", e.status]),
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
    { label: "Total Claims", value: expensesSummary?.total ?? expenses.length, icon: Receipt, color: "text-primary", bg: "bg-primary/10", format: "number" as const },
    { label: "Pending", value: expensesSummary?.pending ?? expenses.filter(e => e.status === "pending").length, icon: Send, color: "text-warning", bg: "bg-warning/10", format: "number" as const },
    { label: "Approved", value: expensesSummary?.approved ?? expenses.filter(e => e.status === "approved").length, icon: CheckCircle2, color: "text-primary", bg: "bg-primary/10", format: "number" as const },
    { label: "Paid", value: expensesSummary?.paid ?? expenses.filter(e => e.status === "paid").length, icon: DollarSign, color: "text-success", bg: "bg-success/10", format: "number" as const },
    { label: "Pending Approval", value: expensesSummary?.pendingApproval ?? 0, icon: Clock, color: "text-warning", bg: "bg-warning/10", format: "number" as const },
    { label: "Total Amount", value: expensesSummary?.totalAmount ?? expenses.reduce((s, e) => s + e.amount, 0), icon: Receipt, color: "text-primary", bg: "bg-primary/10", format: "currency" as const },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Expense Claims</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Review, approve, and process employee expense claims.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ExportMenu onCsv={exportCsv} onPdf={exportPdfReport} className="gap-2" />
          <Button size="sm" className="gap-2" onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4" /> New Claim
          </Button>
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
            className="bg-card border border-border rounded-xl p-4 space-y-2"
          >
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", card.bg)}>
              <card.icon className={cn("h-4 w-4", card.color)} />
            </div>
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className={cn("text-base font-bold leading-tight", card.color)}>
              {card.format === "currency"
                ? formatCurrency(card.value as number, currency)
                : card.value}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search claims..."
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
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize",
                activeStatus === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {s === "all" ? "All" : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/30 border-b border-border">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Claim #</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Paid By</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden md:table-cell">Category</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Date</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Amount</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground">Status</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground w-28">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No expense claims found.
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
                  <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell capitalize">
                    {CATEGORY_EMOJIS[expense.category] ?? "📎"} {expense.category}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground hidden sm:table-cell">
                    {formatDate(expense.expenseDate, "medium")}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold">
                    {formatCurrency(expense.amount, expense.currency ?? "AED")}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold", STATUS_STYLES[expense.status] ?? STATUS_STYLES_FALLBACK)}>
                      {STATUS_LABELS[expense.status] ?? STATUS_LABELS_FALLBACK}
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

