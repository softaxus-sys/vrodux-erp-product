import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, AlertTriangle, BarChart3, BookOpen, Calendar, TrendingUp, X, Loader2, Info, Lightbulb,
} from "lucide-react";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import type { GLPeriod, TrialBalanceLine, AccountTypeDto } from "@/lib/finance/finance.api";
import { useTrialBalance, useGLSummary, useAccountLedger, useAccountTypes } from "@/hooks/finance/use-finance";

/** Cycling color palette applied to root account Types in display order — matches accounting-view.tsx. */
const TYPE_PALETTE = [
  { text: "text-success",     bg: "bg-success/10 text-success" },
  { text: "text-destructive", bg: "bg-destructive/10 text-destructive" },
  { text: "text-primary",     bg: "bg-primary/10 text-primary" },
  { text: "text-amber-500",   bg: "bg-amber-500/10 text-amber-500" },
  { text: "text-violet-500",  bg: "bg-violet-500/10 text-violet-500" },
  { text: "text-cyan-500",    bg: "bg-cyan-500/10 text-cyan-500" },
];

/** "2026-06" -> "June 2026" */
function formatPeriodLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) return period;
  return new Date(year, month - 1, 1).toLocaleString("en-AE", { month: "long", year: "numeric" });
}

const CURRENT_PERIOD = new Date().toISOString().slice(0, 7);

export function GLView() {
  const currency = useCurrency();
  const { data: trialBalance = [] } = useTrialBalance();
  const { data: glSummary } = useGLSummary();
  const { data: accountTypes = [] } = useAccountTypes();

  const [activePeriod, setActivePeriod] = React.useState<GLPeriod>(CURRENT_PERIOD);
  const [selectedAccount, setSelectedAccount] = React.useState<TrialBalanceLine | null>(null);

  // Root account types, ordered the same way as the Chart of Accounts (by sortOrder).
  const rootTypes = React.useMemo(
    () => accountTypes.filter((t) => !t.parentId).sort((a, b) => a.sortOrder - b.sortOrder),
    [accountTypes]
  );

  const typesByCode = React.useMemo(() => {
    const m = new Map<string, AccountTypeDto>();
    for (const t of rootTypes) m.set(t.code, t);
    return m;
  }, [rootTypes]);

  // For this view, the trial balance is the same data regardless of period
  // In a real system, filtering by period would change the data
  const grouped = React.useMemo(() => {
    const groups: Record<string, TrialBalanceLine[]> = {};
    for (const line of trialBalance) {
      if (!groups[line.accountType]) groups[line.accountType] = [];
      groups[line.accountType].push(line);
    }
    return groups;
  }, [trialBalance]);

  // Display order: known root types first (by sortOrder), then any account-type codes
  // present in the trial balance that don't match a known root type (shouldn't normally
  // happen, but ensures accounts are never silently dropped from the report).
  const typeOrder = React.useMemo(() => {
    const known = rootTypes.map((t) => t.code);
    const extra = Object.keys(grouped).filter((code) => !known.includes(code));
    return [...known, ...extra];
  }, [rootTypes, grouped]);

  const typeColor = (code: string) => {
    const idx = typeOrder.indexOf(code);
    return TYPE_PALETTE[(idx < 0 ? 0 : idx) % TYPE_PALETTE.length];
  };

  const typeLabel = (code: string) => typesByCode.get(code)?.name ?? code;

  const subtotals = React.useMemo(() => {
    const result: Record<string, { debits: number; credits: number; balance: number }> = {};
    for (const type of typeOrder) {
      const lines = grouped[type] ?? [];
      result[type] = {
        debits: lines.reduce((s, l) => s + l.totalDebits, 0),
        credits: lines.reduce((s, l) => s + l.totalCredits, 0),
        balance: lines.reduce((s, l) => s + l.closingBalance, 0),
      };
    }
    return result;
  }, [grouped, typeOrder]);

  const grandTotalDebits = trialBalance.reduce((s, l) => s + l.totalDebits, 0);
  const grandTotalCredits = trialBalance.reduce((s, l) => s + l.totalCredits, 0);

  const isBalanced = glSummary?.isBalanced ?? true;
  const STAT_CARDS = [
    { label: "Total Debits", value: formatCurrency(glSummary?.totalDebits ?? 0, currency), icon: TrendingUp, color: "text-primary", bg: "bg-primary/10" },
    { label: "Total Credits", value: formatCurrency(glSummary?.totalCredits ?? 0, currency), icon: BarChart3, color: "text-primary", bg: "bg-primary/10" },
    {
      label: "Balance Status",
      value: isBalanced ? "Balanced" : "Unbalanced",
      icon: isBalanced ? CheckCircle2 : AlertTriangle,
      color: isBalanced ? "text-success" : "text-destructive",
      bg: isBalanced ? "bg-success/10" : "bg-destructive/10",
    },
    { label: "Accounts", value: `${glSummary?.accounts ?? trialBalance.length} accounts`, icon: BookOpen, color: "text-primary", bg: "bg-primary/10" },
    { label: "Period", value: formatPeriodLabel(activePeriod), icon: Calendar, color: "text-muted-foreground", bg: "bg-muted" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">General Ledger</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Trial balance and account activity across all periods.</p>
        </div>
        {isBalanced ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-success/10 border border-success/20">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span className="text-sm font-semibold text-success">Ledger Balanced</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-sm font-semibold text-destructive">Imbalance Detected</span>
          </div>
        )}
      </div>

      {/* Imbalance details + suggestions */}
      {!isBalanced && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-destructive">
                Out of balance by {formatCurrency(Math.abs(grandTotalDebits - grandTotalCredits), currency)}
              </p>
              <p className="text-xs text-muted-foreground">
                Total Debits ({formatCurrency(grandTotalDebits, currency)}) {grandTotalDebits > grandTotalCredits ? "exceed" : "are less than"} Total Credits ({formatCurrency(grandTotalCredits, currency)}).
                In double-entry bookkeeping these two totals must always be equal — every posted transaction debits one account and credits another for the same amount.
              </p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 pl-8">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" /> Likely causes
              </p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>A journal entry was posted with unequal debit and credit totals (e.g. via a direct database edit, import, or migration that bypassed validation)</li>
                <li>An opening balance was entered for an account without a matching offsetting entry</li>
                <li>A posted journal entry was later edited or deleted without reversing both its debit and credit sides</li>
                <li>Rounding differences from multi-currency transactions</li>
              </ul>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Lightbulb className="h-3.5 w-3.5" /> How to fix it
              </p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>Open Journals and look for any entry whose debit and credit totals don't match — the New Journal Entry form blocks this, so an existing imbalanced entry usually predates that check</li>
                <li>Click an account row below to open its ledger and trace transactions for an unexpected closing balance</li>
                <li>Post a correcting journal entry for {formatCurrency(Math.abs(grandTotalDebits - grandTotalCredits), currency)} against a Suspense/Clearing account, then investigate and reclassify it once the source is found</li>
                <li>If this followed a data import or migration, re-run it ensuring every batch of entries is balanced before posting</li>
              </ul>
            </div>
          </div>
        </div>
      )}

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
            <p className={cn("text-sm font-bold leading-tight", card.color)}>{card.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Period Selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium">Period:</span>
        <div className="flex gap-1.5 flex-wrap">
          {(glSummary?.periods ?? [CURRENT_PERIOD]).map((period) => (
            <button
              key={period}
              onClick={() => setActivePeriod(period)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                activePeriod === period
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {formatPeriodLabel(period)}
            </button>
          ))}
        </div>
      </div>

      {/* Trial Balance Table */}
      <div className="space-y-4">
        {typeOrder.map((type) => {
          const lines = grouped[type];
          if (!lines?.length) return null;
          const sub = subtotals[type];
          const color = typeColor(type);
          return (
            <div key={type} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
                <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-semibold", color.bg)}>
                  {typeLabel(type)}
                </span>
                <div className="flex items-center gap-6 text-xs font-semibold">
                  <span className="text-muted-foreground">
                    Dr: <span className="text-foreground">{formatCurrency(sub.debits, currency)}</span>
                  </span>
                  <span className="text-muted-foreground">
                    Cr: <span className="text-foreground">{formatCurrency(sub.credits, currency)}</span>
                  </span>
                </div>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground w-24">Code</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Account Name</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Opening Balance</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Total Debits</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Total Credits</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Closing Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr
                      key={line.accountCode}
                      onClick={() => setSelectedAccount(line)}
                      className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{line.accountCode}</td>
                      <td className="px-4 py-3 text-sm font-medium">{line.accountName}</td>
                      <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                        {line.openingBalance !== 0 ? formatCurrency(line.openingBalance, currency) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-sm">
                        {line.totalDebits !== 0 ? formatCurrency(line.totalDebits, currency) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-sm">
                        {line.totalCredits !== 0 ? formatCurrency(line.totalCredits, currency) : "—"}
                      </td>
                      <td className={cn("px-4 py-3 text-right text-sm font-bold", color.text)}>
                        {formatCurrency(Math.abs(line.closingBalance), currency)}
                        {line.closingBalance < 0 && <span className="text-xs ml-1">(Cr)</span>}
                      </td>
                    </tr>
                  ))}
                  {/* Subtotal row */}
                  <tr className="bg-muted/20 border-t border-border">
                    <td colSpan={2} className="px-4 py-2.5 text-xs font-bold text-muted-foreground">
                      {typeLabel(type)} Subtotal
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs font-bold"></td>
                    <td className="px-4 py-2.5 text-right text-xs font-bold">{formatCurrency(sub.debits, currency)}</td>
                    <td className="px-4 py-2.5 text-right text-xs font-bold">{formatCurrency(sub.credits, currency)}</td>
                    <td className={cn("px-4 py-2.5 text-right text-xs font-bold", color.text)}>
                      {formatCurrency(Math.abs(sub.balance), currency)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })}
      </div>

      {/* Grand Total */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold">Trial Balance Totals</span>
            {isBalanced ? (
              <span className="flex items-center gap-1 text-xs text-success font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" /> Balanced
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-destructive font-medium">
                <AlertTriangle className="h-3.5 w-3.5" /> Imbalanced
              </span>
            )}
          </div>
          <div className="flex items-center gap-8 text-sm font-bold">
            <span className="text-muted-foreground">
              Total Dr: <span className="text-foreground">{formatCurrency(grandTotalDebits, currency)}</span>
            </span>
            <span className="text-muted-foreground">
              Total Cr: <span className="text-foreground">{formatCurrency(grandTotalCredits, currency)}</span>
            </span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedAccount && (
          <AccountLedgerDrawer account={selectedAccount} typesByCode={typesByCode} onClose={() => setSelectedAccount(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function AccountLedgerDrawer({ account, typesByCode, onClose }: { account: TrialBalanceLine; typesByCode: Map<string, AccountTypeDto>; onClose: () => void }) {
  const currency = useCurrency();
  const { data, isLoading } = useAccountLedger(account.accountId);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="relative w-full max-w-2xl h-full bg-card border-l border-border overflow-y-auto"
      >
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold">{account.accountName}</h2>
            <p className="text-xs text-muted-foreground font-mono">{account.accountCode} · {typesByCode.get(account.accountType)?.name ?? account.accountType}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading ledger…
            </div>
          ) : !data ? (
            <p className="text-sm text-muted-foreground py-12 text-center">No ledger data available.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/30 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">Opening Balance</p>
                  <p className="text-sm font-bold mt-1">{formatCurrency(Math.abs(data.openingBalance), currency)}{data.openingBalance < 0 && <span className="text-xs ml-1">(Cr)</span>}</p>
                </div>
                <div className="bg-muted/30 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">Total Dr / Cr</p>
                  <p className="text-sm font-bold mt-1">{formatCurrency(data.totalDebits, currency)} / {formatCurrency(data.totalCredits, currency)}</p>
                </div>
                <div className="bg-muted/30 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">Closing Balance</p>
                  <p className="text-sm font-bold mt-1">{formatCurrency(Math.abs(data.closingBalance), currency)}{data.closingBalance < 0 && <span className="text-xs ml-1">(Cr)</span>}</p>
                </div>
              </div>

              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Date</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Entry #</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Description</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Debit</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Credit</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.entries.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">No posted activity yet.</td>
                      </tr>
                    ) : (
                      data.entries.map((entry, i) => (
                        <tr key={`${entry.entryNumber}-${i}`} className="border-b border-border/30 last:border-0">
                          <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{formatDate(entry.date)}</td>
                          <td className="px-3 py-2 text-xs font-mono">{entry.entryNumber}</td>
                          <td className="px-3 py-2 text-sm">{entry.description}</td>
                          <td className="px-3 py-2 text-right text-sm">{entry.debit !== 0 ? formatCurrency(entry.debit, currency) : "—"}</td>
                          <td className="px-3 py-2 text-right text-sm">{entry.credit !== 0 ? formatCurrency(entry.credit, currency) : "—"}</td>
                          <td className="px-3 py-2 text-right text-sm font-semibold">
                            {formatCurrency(Math.abs(entry.runningBalance), currency)}
                            {entry.runningBalance < 0 && <span className="text-xs ml-1">(Cr)</span>}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

