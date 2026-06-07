import * as React from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2, AlertTriangle, BarChart3, BookOpen, Calendar, TrendingUp,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { GLPeriod, TrialBalanceLine } from "@/lib/finance/finance.api";
import { useTrialBalance, useGLSummary } from "@/hooks/finance/use-finance";

const TYPE_LABELS: Record<string, string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  income: "Income",
  expense: "Expenses",
};

const TYPE_ORDER = ["asset", "liability", "equity", "income", "expense"];

const TYPE_BG: Record<string, string> = {
  asset: "bg-success/10 text-success",
  liability: "bg-destructive/10 text-destructive",
  equity: "bg-primary/10 text-primary",
  income: "bg-success/10 text-success",
  expense: "bg-destructive/10 text-destructive",
};

const TYPE_BALANCE_COLOR: Record<string, string> = {
  asset: "text-success",
  liability: "text-destructive",
  equity: "text-primary",
  income: "text-success",
  expense: "text-destructive",
};

const PERIOD_LABELS: Record<GLPeriod, string> = {
  "2026-01": "Jan 2026",
  "2026-02": "Feb 2026",
  "2026-03": "Mar 2026",
  "2026-04": "Apr 2026",
  "2026-05": "May 2026",
};

export function GLView() {
  const { data: trialBalance = [] } = useTrialBalance();
  const { data: glSummary } = useGLSummary();

  const [activePeriod, setActivePeriod] = React.useState<GLPeriod>("2026-05");

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

  const subtotals = React.useMemo(() => {
    const result: Record<string, { debits: number; credits: number; balance: number }> = {};
    for (const type of TYPE_ORDER) {
      const lines = grouped[type] ?? [];
      result[type] = {
        debits: lines.reduce((s, l) => s + l.totalDebits, 0),
        credits: lines.reduce((s, l) => s + l.totalCredits, 0),
        balance: lines.reduce((s, l) => s + l.closingBalance, 0),
      };
    }
    return result;
  }, [grouped]);

  const grandTotalDebits = trialBalance.reduce((s, l) => s + l.totalDebits, 0);
  const grandTotalCredits = trialBalance.reduce((s, l) => s + l.totalCredits, 0);

  const isBalanced = glSummary?.isBalanced ?? true;
  const STAT_CARDS = [
    { label: "Total Debits", value: formatCurrency(glSummary?.totalDebits ?? 0, "AED"), icon: TrendingUp, color: "text-primary", bg: "bg-primary/10" },
    { label: "Total Credits", value: formatCurrency(glSummary?.totalCredits ?? 0, "AED"), icon: BarChart3, color: "text-primary", bg: "bg-primary/10" },
    {
      label: "Balance Status",
      value: isBalanced ? "Balanced" : "Unbalanced",
      icon: isBalanced ? CheckCircle2 : AlertTriangle,
      color: isBalanced ? "text-success" : "text-destructive",
      bg: isBalanced ? "bg-success/10" : "bg-destructive/10",
    },
    { label: "Accounts", value: `${glSummary?.accounts ?? trialBalance.length} accounts`, icon: BookOpen, color: "text-primary", bg: "bg-primary/10" },
    { label: "Period", value: PERIOD_LABELS[activePeriod], icon: Calendar, color: "text-muted-foreground", bg: "bg-muted" },
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
          {(glSummary?.periods ?? (["2026-01", "2026-02", "2026-03", "2026-04", "2026-05"] as GLPeriod[])).map((period) => (
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
              {PERIOD_LABELS[period]}
            </button>
          ))}
        </div>
      </div>

      {/* Trial Balance Table */}
      <div className="space-y-4">
        {TYPE_ORDER.map((type) => {
          const lines = grouped[type];
          if (!lines?.length) return null;
          const sub = subtotals[type];
          return (
            <div key={type} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
                <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-semibold", TYPE_BG[type])}>
                  {TYPE_LABELS[type]}
                </span>
                <div className="flex items-center gap-6 text-xs font-semibold">
                  <span className="text-muted-foreground">
                    Dr: <span className="text-foreground">{formatCurrency(sub.debits, "AED")}</span>
                  </span>
                  <span className="text-muted-foreground">
                    Cr: <span className="text-foreground">{formatCurrency(sub.credits, "AED")}</span>
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
                    <tr key={line.accountCode} className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{line.accountCode}</td>
                      <td className="px-4 py-3 text-sm font-medium">{line.accountName}</td>
                      <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                        {line.openingBalance !== 0 ? formatCurrency(line.openingBalance, "AED") : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-sm">
                        {line.totalDebits !== 0 ? formatCurrency(line.totalDebits, "AED") : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-sm">
                        {line.totalCredits !== 0 ? formatCurrency(line.totalCredits, "AED") : "—"}
                      </td>
                      <td className={cn("px-4 py-3 text-right text-sm font-bold", TYPE_BALANCE_COLOR[type])}>
                        {formatCurrency(Math.abs(line.closingBalance), "AED")}
                        {line.closingBalance < 0 && <span className="text-xs ml-1">(Cr)</span>}
                      </td>
                    </tr>
                  ))}
                  {/* Subtotal row */}
                  <tr className="bg-muted/20 border-t border-border">
                    <td colSpan={2} className="px-4 py-2.5 text-xs font-bold text-muted-foreground">
                      {TYPE_LABELS[type]} Subtotal
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs font-bold"></td>
                    <td className="px-4 py-2.5 text-right text-xs font-bold">{formatCurrency(sub.debits, "AED")}</td>
                    <td className="px-4 py-2.5 text-right text-xs font-bold">{formatCurrency(sub.credits, "AED")}</td>
                    <td className={cn("px-4 py-2.5 text-right text-xs font-bold", TYPE_BALANCE_COLOR[type])}>
                      {formatCurrency(Math.abs(sub.balance), "AED")}
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
              Total Dr: <span className="text-foreground">{formatCurrency(grandTotalDebits, "AED")}</span>
            </span>
            <span className="text-muted-foreground">
              Total Cr: <span className="text-foreground">{formatCurrency(grandTotalCredits, "AED")}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

