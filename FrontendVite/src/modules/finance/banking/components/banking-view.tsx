import * as React from "react";
import { motion } from "framer-motion";
import {
  Building2, ArrowUpCircle, ArrowDownCircle, Wallet, AlertCircle, CheckCircle2, Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddTransactionForm } from "./add-transaction-form";
import { AddBankAccountForm } from "./add-bank-account-form";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import type { BankAccountDto as BankAccount } from "@/lib/finance/finance.api";
import { useBankAccounts, useBankTransactions, useBankingSummary, useReconcileTransaction } from "@/hooks/finance/use-finance";
import { Can } from "@/components/auth/can";

const CURRENCY_FLAGS: Record<string, string> = {
  AED: "🇦🇪",
  USD: "🇺🇸",
  EUR: "🇪🇺",
};


export function BankingView() {
  const currency = useCurrency();
  const { data: bankAccounts = [] } = useBankAccounts();
  const { data: bankTransactions = [] } = useBankTransactions();
  const reconcile = useReconcileTransaction();
  const { data: bankingSummary } = useBankingSummary();

  const STAT_CARDS = [
    { label: "Total Balance (AED)", value: bankingSummary?.totalBalance ?? 0, icon: Wallet, color: "text-primary", bg: "bg-primary/10", format: "currency" as const },
    { label: "Active Accounts", value: bankingSummary?.totalAccounts ?? 0, icon: Building2, color: "text-primary", bg: "bg-primary/10", format: "number" as const },
    { label: "Credits This Month", value: bankingSummary?.totalCreditThisMonth ?? 0, icon: ArrowUpCircle, color: "text-success", bg: "bg-success/10", format: "currency" as const },
    { label: "Debits This Month", value: bankingSummary?.totalDebitThisMonth ?? 0, icon: ArrowDownCircle, color: "text-destructive", bg: "bg-destructive/10", format: "currency" as const },
    { label: "Unreconciled", value: bankingSummary?.unreconciled ?? 0, icon: AlertCircle, color: "text-warning", bg: "bg-warning/10", format: "number" as const },
  ];

  const [selectedAccountId, setSelectedAccountId] = React.useState<string>("");
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [showAddAccount, setShowAddAccount] = React.useState(false);

  const selectedAccount = React.useMemo(
    () => bankAccounts.find((a) => a.id === selectedAccountId) ?? bankAccounts[0],
    [bankAccounts, selectedAccountId]
  );

  const transactions = React.useMemo(
    () => bankTransactions.filter((t) => t.accountId === (selectedAccount?.id ?? selectedAccountId)),
    [bankTransactions, selectedAccount, selectedAccountId]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Bank Accounts</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Monitor bank balances and reconcile transactions.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Can permission="finance.banking.create">
            <Button size="sm" variant="outline" className="gap-2" onClick={() => setShowAddAccount(true)}>
              <Building2 className="h-4 w-4" /> Add Bank Account
            </Button>
          </Can>
          <Can permission="finance.banking.create">
            <Button size="sm" className="gap-2" onClick={() => setShowAddForm(true)}>
              <Plus className="h-4 w-4" /> Add Transaction
            </Button>
          </Can>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* Bank Account Cards */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bank Accounts</p>
          {bankAccounts.map((account) => (
            <BankAccountCard
              key={account.id}
              account={account}
              isSelected={account.id === selectedAccountId}
              onClick={() => setSelectedAccountId(account.id)}
            />
          ))}
        </div>

        {/* Transactions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Transactions — {selectedAccount?.accountName ?? "—"}
            </p>
            <p className="text-xs text-muted-foreground">{transactions.length} entries</p>
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
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      No transactions for this account.
                    </td>
                  </tr>
                ) : (
                  transactions.map((txn) => (
                    <tr key={txn.id} className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(txn.date, "short")}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium">{txn.description}</p>
                        <p className="text-xs text-muted-foreground">{txn.category}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground hidden sm:table-cell">{txn.reference}</td>
                      <td className="px-4 py-3 text-right text-sm text-destructive font-medium">
                        {txn.type === "debit" ? formatCurrency(Math.abs(txn.amount), selectedAccount?.currency ?? "AED") : "—"}
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
                          <button
                            onClick={() => reconcile.mutate(txn.id)}
                            disabled={reconcile.isPending}
                            title="Mark as reconciled"
                            className="inline-flex items-center gap-1 text-warning hover:text-success transition-colors disabled:opacity-50">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-[10px] font-medium">Reconcile</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <AddTransactionForm open={showAddForm} onClose={() => setShowAddForm(false)} />
      <AddBankAccountForm open={showAddAccount} onClose={() => setShowAddAccount(false)} />
    </div>
  );
}

function BankAccountCard({ account, isSelected, onClick }: { account: BankAccount; isSelected: boolean; onClick: () => void }) {
  const typeColor = account.accountType === "savings" ? "text-primary" : "text-success";

  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "w-full text-left rounded-xl border p-4 transition-all",
        isSelected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border bg-card hover:bg-muted/20"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{CURRENCY_FLAGS[account.currency] ?? "🏦"}</span>
          <div>
            <p className="text-sm font-semibold leading-tight">{account.bankName}</p>
            <p className="text-xs text-muted-foreground">••••{account.accountNumber}</p>
          </div>
        </div>
        <span className={cn(
          "px-2 py-0.5 rounded-full text-xs font-medium capitalize",
          account.status === "active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
        )}>
          {account.accountType}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-0.5">{account.accountName}</p>
      <p className={cn("text-lg font-bold", typeColor)}>
        {formatCurrency(account.balance, account.currency)}
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Available: {formatCurrency(account.availableBalance, account.currency)}
      </p>
      <p className="text-xs text-muted-foreground mt-2">
        Synced {formatDate(account.lastSynced, "relative")}
      </p>
    </motion.button>
  );
}

