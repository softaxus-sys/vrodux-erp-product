"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, Download, X, CheckCircle2, XCircle, Receipt, Clock,
  DollarSign, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  useExpenses, useCreateExpense, useApproveExpense, useRejectExpense, useMarkExpensePaid,
} from "@/hooks/finance/use-expenses";
import type { ExpenseDto } from "@/lib/finance/expenses.api";

// Approver placeholder — in a real app this comes from the auth store
const APPROVER_ID = "00000000-0000-0000-0000-000000000001";

const STATUS_STYLES: Record<string, string> = {
  pending:  "bg-warning/10 text-warning",
  approved: "bg-primary/10 text-primary",
  rejected: "bg-destructive/10 text-destructive",
  paid:     "bg-success/10 text-success",
};
const STATUS_LABELS: Record<string, string> = {
  pending: "Pending", approved: "Approved", rejected: "Rejected", paid: "Paid",
};

const CATEGORY_EMOJIS: Record<string, string> = {
  travel: "✈️", accommodation: "🏨", meals: "🍽️", entertainment: "🎭",
  software: "💻", office: "🏢", training: "📚", medical: "🏥", fuel: "⛽", other: "📎",
};

function ExpenseDrawer({ expense, onClose }: { expense: ExpenseDto; onClose: () => void }) {
  const approve  = useApproveExpense();
  const reject   = useRejectExpense();
  const markPaid = useMarkExpensePaid();

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="fixed top-0 right-0 h-full w-full max-w-[540px] bg-background border-l border-border shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Expense Claim</p>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs text-muted-foreground">{expense.expenseNumber}</p>
              <p className="font-bold text-base mt-0.5">{expense.title}</p>
              <p className="text-sm text-muted-foreground capitalize">{expense.category}</p>
            </div>
            <span className={cn("px-3 py-1 rounded-full text-xs font-semibold capitalize",
              STATUS_STYLES[expense.status] ?? "bg-muted text-muted-foreground")}>
              {STATUS_LABELS[expense.status] ?? expense.status}
            </span>
          </div>

          {/* Amount */}
          <div className="rounded-xl bg-muted/30 p-4 text-center">
            <p className="text-xs text-muted-foreground">Amount</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(expense.amount, "AED")}</p>
          </div>

          {/* Details */}
          {[
            { label: "Expense Date",   value: formatDate(expense.expenseDate, "medium") },
            { label: "Category",       value: `${CATEGORY_EMOJIS[expense.category] ?? "📎"} ${expense.category}` },
            ...(expense.paidBy       ? [{ label: "Paid By",        value: expense.paidBy }] : []),
            ...(expense.paymentMethod ? [{ label: "Payment Method", value: expense.paymentMethod }] : []),
            ...(expense.reference    ? [{ label: "Reference",      value: expense.reference }] : []),
            ...(expense.approvedAt   ? [{ label: "Approved At",    value: formatDate(expense.approvedAt, "medium") }] : []),
          ].map(row => (
            <div key={row.label} className="flex justify-between items-center py-2.5 border-b border-border/40">
              <span className="text-xs text-muted-foreground">{row.label}</span>
              <span className="text-sm font-medium capitalize">{row.value}</span>
            </div>
          ))}

          {expense.notes && (
            <div className="rounded-lg bg-muted/40 p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Notes</p>
              <p className="text-sm">{expense.notes}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        {expense.status === "pending" && (
          <div className="border-t border-border px-6 py-4 flex gap-2">
            <Button size="sm" className="flex-1 gap-1.5 bg-success hover:bg-success/90"
              disabled={approve.isPending}
              onClick={() => { approve.mutate({ id: expense.id, approverId: APPROVER_ID }); onClose(); }}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Approve
            </Button>
            <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-destructive border-destructive/30"
              disabled={reject.isPending}
              onClick={() => { reject.mutate({ id: expense.id, approverId: APPROVER_ID }); onClose(); }}>
              <XCircle className="h-3.5 w-3.5" /> Reject
            </Button>
          </div>
        )}
        {expense.status === "approved" && (
          <div className="border-t border-border px-6 py-4">
            <Button size="sm" className="gap-1.5 w-full" disabled={markPaid.isPending}
              onClick={() => { markPaid.mutate(expense.id); onClose(); }}>
              <DollarSign className="h-3.5 w-3.5" /> Mark as Paid
            </Button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function AddExpenseModal({ onClose }: { onClose: () => void }) {
  const createExpense = useCreateExpense();
  const today = new Date().toISOString().split("T")[0];
  const [title, setTitle]           = React.useState("");
  const [category, setCategory]     = React.useState("other");
  const [amount, setAmount]         = React.useState("");
  const [expenseDate, setExpDate]   = React.useState(today);
  const [paidBy, setPaidBy]         = React.useState("");
  const [reference, setReference]   = React.useState("");
  const [notes, setNotes]           = React.useState("");

  const isValid = title.trim() && category && amount && expenseDate;

  const handleSubmit = async () => {
    if (!isValid) return;
    await createExpense.mutateAsync({
      title, category,
      amount: parseFloat(amount),
      expenseDate,
      paidBy: paidBy || null,
      reference: reference || null,
      notes: notes || null,
    });
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="fixed top-0 right-0 h-full w-full max-w-md bg-background border-l border-border shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <p className="font-bold text-base">New Expense</p>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Title *</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Expense title" className="h-9" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Category *</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm capitalize">
                {Object.keys(CATEGORY_EMOJIS).map(c => (
                  <option key={c} value={c}>{CATEGORY_EMOJIS[c]} {c}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amount (AED) *</label>
              <Input type="number" min={0} step={0.01} value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0.00" className="h-9 text-right" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Expense Date *</label>
            <Input type="date" value={expenseDate} onChange={e => setExpDate(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Paid By</label>
            <Input value={paidBy} onChange={e => setPaidBy(e.target.value)} placeholder="Employee name" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reference</label>
            <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="Receipt / PO number" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Additional notes…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>
        </div>
        <div className="border-t border-border px-6 py-4 flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!isValid || createExpense.isPending}>
            {createExpense.isPending ? "Creating…" : "Create Expense"}
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export function ExpensesView() {
  const [search, setSearch]         = React.useState("");
  const [statusFilter, setStatus]   = React.useState<string>("all");
  const [page, setPage]             = React.useState(1);
  const [selected, setSelected]     = React.useState<ExpenseDto | null>(null);
  const [showAdd, setShowAdd]       = React.useState(false);

  const approve  = useApproveExpense();
  const reject   = useRejectExpense();

  const { data, isLoading } = useExpenses({
    page, pageSize: 20,
    search: search || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const expenses   = data?.items      ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalCount = data?.totalCount ?? 0;

  const pendingCount  = expenses.filter(e => e.status === "pending").length;
  const approvedCount = expenses.filter(e => e.status === "approved").length;
  const paidCount     = expenses.filter(e => e.status === "paid").length;
  const totalAmount   = expenses.reduce((s, e) => s + e.amount, 0);

  const STAT_CARDS = [
    { label: "Total (page)", value: expenses.length,                   icon: Receipt,     color: "text-primary",   bg: "bg-primary/10" },
    { label: "Pending",      value: pendingCount,                      icon: Clock,       color: "text-warning",   bg: "bg-warning/10" },
    { label: "Approved",     value: approvedCount,                     icon: CheckCircle2, color: "text-primary",  bg: "bg-primary/10" },
    { label: "Paid",         value: paidCount,                         icon: DollarSign,  color: "text-success",   bg: "bg-success/10" },
    { label: "Page Amount",  value: formatCurrency(totalAmount, "AED"), icon: Receipt,    color: "text-primary",   bg: "bg-primary/10", isText: true },
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
          <Button variant="outline" size="sm" className="gap-2"><Download className="h-4 w-4" /> Export</Button>
          <Button size="sm" className="gap-2" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" /> New Claim
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {STAT_CARDS.map((card, i) => (
          <motion.div key={card.label}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-card border border-border rounded-xl p-4 space-y-2">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", card.bg)}>
              <card.icon className={cn("h-4 w-4", card.color)} />
            </div>
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className={cn("text-base font-bold leading-tight", card.color)}>{card.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search claims…" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9 h-9" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(["all", "pending", "approved", "rejected", "paid"] as const).map(s => (
            <button key={s} onClick={() => { setStatus(s); setPage(1); }}
              className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize",
                statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
              {s === "all" ? "All" : STATUS_LABELS[s] ?? s}
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
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Title</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden md:table-cell">Category</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Date</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Amount</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground">Status</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">Loading…</td></tr>
            ) : expenses.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">No expense claims found.</td></tr>
            ) : expenses.map((expense: ExpenseDto) => (
              <tr key={expense.id} onClick={() => setSelected(expense)}
                className="border-b border-border/30 last:border-0 hover:bg-muted/20 cursor-pointer transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{expense.expenseNumber}</td>
                <td className="px-4 py-3 text-sm font-medium">{expense.title}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell capitalize">
                  {CATEGORY_EMOJIS[expense.category] ?? "📎"} {expense.category}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground hidden sm:table-cell">
                  {formatDate(expense.expenseDate, "medium")}
                </td>
                <td className="px-4 py-3 text-right text-sm font-semibold">{formatCurrency(expense.amount, "AED")}</td>
                <td className="px-4 py-3 text-center">
                  <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold capitalize",
                    STATUS_STYLES[expense.status] ?? "bg-muted text-muted-foreground")}>
                    {STATUS_LABELS[expense.status] ?? expense.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                  {expense.status === "pending" ? (
                    <div className="flex justify-center gap-1">
                      <button onClick={() => approve.mutate({ id: expense.id, approverId: APPROVER_ID })}
                        className="p-1.5 rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => reject.mutate({ id: expense.id, approverId: APPROVER_ID })}
                        className="p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/10">
            <p className="text-xs text-muted-foreground">Page {page} of {totalPages} · {totalCount} total</p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selected && <ExpenseDrawer expense={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
      {showAdd && <AddExpenseModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}
