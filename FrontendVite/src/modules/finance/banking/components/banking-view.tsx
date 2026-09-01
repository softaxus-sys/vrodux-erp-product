import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Building2, ArrowUpCircle, ArrowDownCircle, Wallet, AlertCircle, CheckCircle2, Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddTransactionForm } from "./add-transaction-form";
import { AddBankAccountForm } from "./add-bank-account-form";
import { cn, formatCurrency, formatDate, fitTextClass } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import type { BankAccountDto as BankAccount } from "@/lib/finance/finance.api";
import { useBankAccounts, useBankTransactions, useBankingSummary, useReconcileTransaction } from "@/hooks/finance/use-finance";
import { Can } from "@/components/auth/can";

const PAGE_SIZE = 30;

const CURRENCY_FLAGS: Record<string, string> = {
  AED: "🇦🇪",
  USD: "🇺🇸",
  EUR: "🇪🇺",
};


export function BankingView() {
  const { t } = useTranslation("finance");
  const currency = useCurrency();
  const { data: bankAccounts = [] } = useBankAccounts();
  const reconcile = useReconcileTransaction();
  const { data: bankingSummary } = useBankingSummary();

  const STAT_CARDS = [
    { label: t("banking.stat.totalBalance"), value: bankingSummary?.totalBalance ?? 0, icon: Wallet, color: "text-primary", bg: "bg-primary/10", format: "currency" as const },
    { label: t("banking.stat.activeAccounts"), value: bankingSummary?.totalAccounts ?? 0, icon: Building2, color: "text-primary", bg: "bg-primary/10", format: "number" as const },
    { label: t("banking.stat.creditsThisMonth"), value: bankingSummary?.totalCreditThisMonth ?? 0, icon: ArrowUpCircle, color: "text-success", bg: "bg-success/10", format: "currency" as const },
    { label: t("banking.stat.debitsThisMonth"), value: bankingSummary?.totalDebitThisMonth ?? 0, icon: ArrowDownCircle, color: "text-destructive", bg: "bg-destructive/10", format: "currency" as const },
    { label: t("banking.stat.unreconciled"), value: bankingSummary?.unreconciled ?? 0, icon: AlertCircle, color: "text-warning", bg: "bg-warning/10", format: "number" as const },
  ];

  const [selectedAccountId, setSelectedAccountId] = React.useState<string>("");
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [showAddAccount, setShowAddAccount] = React.useState(false);

  const selectedAccount = React.useMemo(
    () => bankAccounts.find((a) => a.id === selectedAccountId) ?? bankAccounts[0],
    [bankAccounts, selectedAccountId]
  );

  // The account filter now narrows in SQL rather than in the browser over the whole feed.
  const activeAccountId = selectedAccount?.id ?? selectedAccountId;
  const [page, setPage] = React.useState(1);
  React.useEffect(() => { setPage(1); }, [activeAccountId]);

  const { data: paged, isFetching } = useBankTransactions(
    { accountId: activeAccountId || undefined, page, pageSize: PAGE_SIZE },
    Boolean(activeAccountId),
  );
  const transactions = paged?.items ?? [];
  const totalCount   = paged?.totalCount ?? 0;
  const totalPages   = paged?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("banking.title")}</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">{t("banking.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Can permission="finance.banking.create">
            <Button size="sm" variant="outline" className="gap-2" onClick={() => setShowAddAccount(true)}>
              <Building2 className="h-4 w-4" /> {t("banking.addAccount")}
            </Button>
          </Can>
          <Can permission="finance.banking.create">
            <Button size="sm" className="gap-2" onClick={() => setShowAddForm(true)}>
              <Plus className="h-4 w-4" /> {t("banking.addTransaction")}
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

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* Bank Account Cards */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("banking.accountsHeading")}</p>
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
              {t("banking.txHeading", { account: selectedAccount?.accountName ?? "—" })}
            </p>
            <p className="text-xs text-muted-foreground">{t("banking.entries", { count: totalCount })}</p>
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">{t("banking.table.date")}</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">{t("banking.table.description")}</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden sm:table-cell">{t("banking.table.reference")}</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">{t("banking.table.debit")}</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">{t("banking.table.credit")}</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden md:table-cell">{t("banking.table.balance")}</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground">{t("banking.table.rec")}</th>
                </tr>
              </thead>
              <tbody>
                {totalCount === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      {t("banking.table.empty")}
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
                        {txn.type === "debit" ? formatCurrency(Math.abs(txn.amount), selectedAccount?.currency || currency) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-success font-medium">
                        {txn.type === "credit" ? formatCurrency(txn.amount, selectedAccount?.currency || currency) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold hidden md:table-cell">
                        {formatCurrency(txn.balance, selectedAccount?.currency || currency)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {txn.reconciled ? (
                          <CheckCircle2 className="h-4 w-4 text-success mx-auto" />
                        ) : (
                          <button
                            onClick={() => reconcile.mutate(txn.id)}
                            disabled={reconcile.isPending}
                            title={t("banking.table.reconcileTitle")}
                            className="inline-flex items-center gap-1 text-warning hover:text-success transition-colors disabled:opacity-50">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-[10px] font-medium">{t("banking.table.reconcile")}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {totalCount > 0 && (
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  {t("banking.table.showing", {
                    shown: `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, totalCount)}`,
                    total: totalCount,
                  })}
                </span>
                <div className="flex items-center gap-2">
                  {/* Disabled while fetching, so a double-click cannot skip a page. */}
                  <Button variant="outline" size="sm" className="h-8 text-xs"
                    disabled={page <= 1 || isFetching}
                    onClick={() => setPage(p => Math.max(1, p - 1))}>
                    {t("banking.table.prev")}
                  </Button>
                  <span className="text-xs text-muted-foreground tabular-nums">{page} / {totalPages}</span>
                  <Button variant="outline" size="sm" className="h-8 text-xs"
                    disabled={page >= totalPages || isFetching}
                    onClick={() => setPage(p => p + 1)}>
                    {t("banking.table.next")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <AddTransactionForm open={showAddForm} onClose={() => setShowAddForm(false)} />
      <AddBankAccountForm open={showAddAccount} onClose={() => setShowAddAccount(false)} />
    </div>
  );
}

function BankAccountCard({ account, isSelected, onClick }: { account: BankAccount; isSelected: boolean; onClick: () => void }) {
  const { t } = useTranslation("finance");
  const currency = useCurrency();
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
          "px-2 py-0.5 rounded-full text-xs font-medium",
          account.status === "active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
        )}>
          {t(`banking.accountType.${account.accountType}`, { defaultValue: account.accountType })}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-0.5">{account.accountName}</p>
      <p className={cn("text-lg font-bold", typeColor)}>
        {formatCurrency(account.balance, account.currency || currency)}
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        {t("banking.card.available", { amount: formatCurrency(account.availableBalance, account.currency || currency) })}
      </p>
      <p className="text-xs text-muted-foreground mt-2">
        {t("banking.card.synced", { time: formatDate(account.lastSynced, "relative") })}
      </p>
    </motion.button>
  );
}

