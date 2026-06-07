"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, ArrowUpCircle, ArrowDownCircle, Wallet, AlertCircle, CheckCircle2, Plus, X,
  ChevronLeft, ChevronRight, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  useBankAccounts, useBankTransactions, useCreateTransaction, useReconcileTransaction,
} from "@/hooks/finance/use-banking";
import type { BankAccountDto, BankTransactionDto } from "@/lib/finance/banking.api";

const CURRENCY_FLAGS: Record<string, string> = { AED: "🇦🇪", USD: "🇺🇸", EUR: "🇪🇺" };

function AddTransactionModal({ accounts, onClose }: { accounts: BankAccountDto[]; onClose: () => void }) {
  const createTxn = useCreateTransaction();
  const today     = new Date().toISOString().split("T")[0];

  const [accountId, setAccountId]   = React.useState(accounts[0]?.id ?? "");
  const [date, setDate]             = React.useState(today);
  const [description, setDesc]      = React.useState("");
  const [category, setCategory]     = React.useState("");
  const [reference, setReference]   = React.useState("");
  const [type, setType]             = React.useState("credit");
  const [amount, setAmount]         = React.useState("");

  const isValid = !!accountId && !!date && !!description.trim() && !!amount && parseFloat(amount) > 0;

  const handleSubmit = async () => {
    if (!isValid) return;
    await createTxn.mutateAsync({
      accountId,
      date,
      description: description.trim(),
      category: category || null,
      reference: reference || null,
      type,
      amount: parseFloat(amount),
    });
    onClose();
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="fixed top-0 right-0 h-full w-full max-w-md bg-background border-l border-border shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <p className="font-bold text-base">Add Transaction</p>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Account *</label>
            <select value={accountId} onChange={e => setAccountId(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm">
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.bankName} — {a.accountName}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date *</label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type *</label>
              <select value={type} onChange={e => setType(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm">
                <option value="credit">Credit (Inflow)</option>
                <option value="debit">Debit (Outflow)</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description *</label>
            <Input value={description} onChange={e => setDesc(e.target.value)} placeholder="Transaction description" className="h-9" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amount *</label>
              <Input type="number" min={0} step={0.01} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reference</label>
              <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="REF-001" className="h-9" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Category</label>
            <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Payroll, Rent…" className="h-9" />
          </div>
        </div>
        <div className="border-t border-border px-6 py-4 flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!isValid || createTxn.isPending}>
            {createTxn.isPending ? "Saving…" : "Add Transaction"}
          </Button>
        </div>
      </motion.div>
    </>
  );
}

function BankAccountCard({ account, isSelected, onClick }: {
  account: BankAccountDto;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button onClick={onClick} whileTap={{ scale: 0.98 }}
      className={cn("w-full text-left rounded-xl border p-4 transition-all",
        isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card hover:bg-muted/20")}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{CURRENCY_FLAGS[account.currency] ?? "🏦"}</span>
          <div>
            <p className="text-sm font-semibold leading-tight">{account.bankName}</p>
            <p className="text-xs text-muted-foreground">••••{account.accountNumber.slice(-4)}</p>
          </div>
        </div>
        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium capitalize",
          account.status === "active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>
          {account.accountType}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-0.5">{account.accountName}</p>
      <p className={cn("text-lg font-bold", account.balance >= 0 ? "text-success" : "text-destructive")}>
        {formatCurrency(account.balance, account.currency)}
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Available: {formatCurrency(account.availableBalance, account.currency)}
      </p>
      {account.lastSynced && (
        <p className="text-xs text-muted-foreground mt-2">Synced {formatDate(account.lastSynced, "relative")}</p>
      )}
    </motion.button>
  );
}

export function BankingView() {
  const [selectedAccountId, setSelectedAccountId] = React.useState<string | null>(null);
  const [txnPage, setTxnPage]   = React.useState(1);
  const [showAdd, setShowAdd]   = React.useState(false);
  const reconcile = useReconcileTransaction();

  const { data: accounts = [], isLoading: accLoading } = useBankAccounts();
  const activeAccountId = selectedAccountId ?? accounts[0]?.id ?? null;
  const selectedAccount = accounts.find(a => a.id === activeAccountId);

  const { data: txnData, isLoading: txnLoading } = useBankTransactions({
    accountId: activeAccountId ?? undefined,
    page:      txnPage,
    pageSize:  30,
  });

  const transactions = txnData?.items      ?? [];
  const txnPages     = txnData?.totalPages ?? 1;
  const txnTotal     = txnData?.totalCount ?? 0;

  // Stats derived from accounts
  const totalBalance     = accounts.reduce((s, a) => s + a.balance, 0);
  const activeAccounts   = accounts.filter(a => a.status === "active").length;
  const creditThisMonth  = transactions.filter(t => t.type === "credit").reduce((s, t) => s + t.amount, 0);
  const debitThisMonth   = transactions.filter(t => t.type === "debit").reduce((s, t) => s + t.amount, 0);
  const unreconciled     = transactions.filter(t => !t.reconciled).length;

  const STAT_CARDS = [
    { label: "Total Balance",      value: formatCurrency(totalBalance,    "AED"), icon: Wallet,          color: "text-primary",     bg: "bg-primary/10" },
    { label: "Active Accounts",    value: activeAccounts,                         icon: Building2,       color: "text-primary",     bg: "bg-primary/10" },
    { label: "Credits (page)",     value: formatCurrency(creditThisMonth, "AED"), icon: ArrowUpCircle,   color: "text-success",     bg: "bg-success/10" },
    { label: "Debits (page)",      value: formatCurrency(debitThisMonth,  "AED"), icon: ArrowDownCircle, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Unreconciled",       value: unreconciled,                           icon: AlertCircle,     color: "text-warning",     bg: "bg-warning/10" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Bank Accounts</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Monitor bank balances and reconcile transactions.</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" /> Add Transaction
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {STAT_CARDS.map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }} className="bg-card border border-border rounded-xl p-4 space-y-2">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", card.bg)}>
              <card.icon className={cn("h-4 w-4", card.color)} />
            </div>
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className={cn("text-base font-bold leading-tight", card.color)}>{card.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
        {/* Account Cards */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bank Accounts</p>
          {accLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border p-4 h-28 animate-pulse bg-muted/20" />
            ))
          ) : accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No bank accounts.</p>
          ) : accounts.map(account => (
            <BankAccountCard key={account.id} account={account}
              isSelected={account.id === activeAccountId}
              onClick={() => { setSelectedAccountId(account.id); setTxnPage(1); }} />
          ))}
        </div>

        {/* Transactions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Transactions{selectedAccount ? ` — ${selectedAccount.accountName}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">{txnTotal} total</p>
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Description</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Reference</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Debit</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Credit</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden md:table-cell">Balance</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground">Rec.</th>
                </tr>
              </thead>
              <tbody>
                {txnLoading ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">Loading…</td></tr>
                ) : transactions.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">No transactions.</td></tr>
                ) : transactions.map((txn: BankTransactionDto) => (
                  <tr key={txn.id} className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(txn.date, "short")}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium">{txn.description}</p>
                      {txn.category && <p className="text-xs text-muted-foreground">{txn.category}</p>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground hidden sm:table-cell">{txn.reference ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-sm text-destructive font-medium">
                      {txn.type === "debit" ? formatCurrency(txn.amount, selectedAccount?.currency ?? "AED") : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-success font-medium">
                      {txn.type === "credit" ? formatCurrency(txn.amount, selectedAccount?.currency ?? "AED") : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold hidden md:table-cell">
                      {formatCurrency(txn.balance, selectedAccount?.currency ?? "AED")}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {txn.reconciled ? (
                        <CheckCircle2 className="h-4 w-4 text-success mx-auto" />
                      ) : (
                        <button onClick={() => reconcile.mutate(txn.id)} disabled={reconcile.isPending}>
                          <AlertCircle className="h-4 w-4 text-warning mx-auto hover:text-success transition-colors" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {txnPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/10">
                <p className="text-xs text-muted-foreground">Page {txnPage} of {txnPages} · {txnTotal} total</p>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={txnPage <= 1} onClick={() => setTxnPage(p => p - 1)}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={txnPage >= txnPages} onClick={() => setTxnPage(p => p + 1)}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showAdd && accounts.length > 0 && (
          <AddTransactionModal accounts={accounts} onClose={() => setShowAdd(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
