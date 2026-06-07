"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2, AlertTriangle, BarChart3, BookOpen, Calendar, TrendingUp,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useGLSummary, useTrialBalance } from "@/hooks/finance/use-general-ledger";
import type { TrialBalanceLineDto } from "@/lib/finance/general-ledger.api";

const TYPE_LABELS: Record<string, string> = {
  asset:     "Assets",
  liability: "Liabilities",
  equity:    "Equity",
  revenue:   "Revenue",
  expense:   "Expenses",
};

const TYPE_ORDER = ["asset", "liability", "equity", "revenue", "expense"];

const TYPE_BG: Record<string, string> = {
  asset:     "bg-success/10 text-success",
  liability: "bg-destructive/10 text-destructive",
  equity:    "bg-primary/10 text-primary",
  revenue:   "bg-success/10 text-success",
  expense:   "bg-destructive/10 text-destructive",
};

const TYPE_BALANCE_COLOR: Record<string, string> = {
  asset:     "text-success",
  liability: "text-destructive",
  equity:    "text-primary",
  revenue:   "text-success",
  expense:   "text-destructive",
};

export function GLView() {
  const { data: summary, isLoading: summaryLoading } = useGLSummary();
  const [activePeriod, setActivePeriod] = React.useState<string | undefined>(undefined);

  // Set default period from summary once loaded
  React.useEffect(() => {
    if (summary && !activePeriod) {
      setActivePeriod(summary.currentPeriod);
    }
  }, [summary, activePeriod]);

  const { data: trialBalance, isLoading: tbLoading } = useTrialBalance(activePeriod);

  const grouped = React.useMemo(() => {
    const groups: Record<string, TrialBalanceLineDto[]> = {};
    for (const line of trialBalance?.lines ?? []) {
      const t = line.accountType.toLowerCase();
      if (!groups[t]) groups[t] = [];
      groups[t].push(line);
    }
    return groups;
  }, [trialBalance]);

  const subtotals = React.useMemo(() => {
    const result: Record<string, { debits: number; credits: number; balance: number }> = {};
    for (const type of TYPE_ORDER) {
      const lines = grouped[type] ?? [];
      result[type] = {
        debits:  lines.reduce((s, l) => s + l.totalDebits,    0),
        credits: lines.reduce((s, l) => s + l.totalCredits,   0),
        balance: lines.reduce((s, l) => s + l.closingBalance, 0),
      };
    }
    return result;
  }, [grouped]);

  const grandTotalDebits  = trialBalance?.totalDebits  ?? 0;
  const grandTotalCredits = trialBalance?.totalCredits ?? 0;
  const isBalanced        = trialBalance?.isBalanced   ?? summary?.isBalanced ?? true;
  const accountCount      = summary?.accountCount ?? 0;
  const availablePeriods  = summary?.availablePeriods ?? [];

  const STAT_CARDS = [
    { label: "Total Debits",   value: formatCurrency(grandTotalDebits,  "AED"), icon: TrendingUp,   color: "text-primary",     bg: "bg-primary/10" },
    { label: "Total Credits",  value: formatCurrency(grandTotalCredits, "AED"), icon: BarChart3,    color: "text-primary",     bg: "bg-primary/10" },
    {
      label: "Balance Status", value: isBalanced ? "Balanced" : "Unbalanced",
      icon: isBalanced ? CheckCircle2 : AlertTriangle,
      color: isBalanced ? "text-success" : "text-destructive",
      bg:    isBalanced ? "bg-success/10" : "bg-destructive/10",
    },
    { label: "Accounts",       value: `${accountCount} accounts`, icon: BookOpen,     color: "text-primary",     bg: "bg-primary/10" },
    { label: "Period",         value: activePeriod ?? "—",        icon: Calendar,     color: "text-muted-foreground", bg: "bg-muted" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">General Ledger</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Trial balance and account activity across all periods.</p>
        </div>
        {!summaryLoading && (
          isBalanced ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-success/10 border border-success/20">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="text-sm font-semibold text-success">Ledger Balanced</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-semibold text-destructive">Imbalance Detected</span>
            </div>
          )
        )}
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
            <p className={cn("text-sm font-bold leading-tight", card.color)}>{card.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Period Selector */}
      {availablePeriods.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Period:</span>
          <div className="flex gap-1.5 flex-wrap">
            {availablePeriods.map(period => (
              <button key={period} onClick={() => setActivePeriod(period)}
                className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                  activePeriod === period
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80")}>
                {period}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Trial Balance Table */}
      {tbLoading ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : (
        <div className="space-y-4">
          {TYPE_ORDER.map(type => {
            const lines = grouped[type];
            if (!lines?.length) return null;
            const sub = subtotals[type];
            return (
              <div key={type} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
                  <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-semibold", TYPE_BG[type] ?? "bg-muted text-muted-foreground")}>
                    {TYPE_LABELS[type] ?? type}
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
                    {lines.map((line: TrialBalanceLineDto) => (
                      <tr key={line.accountId} className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors">
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
                        <td className={cn("px-4 py-3 text-right text-sm font-bold",
                          TYPE_BALANCE_COLOR[type] ?? "text-foreground")}>
                          {formatCurrency(Math.abs(line.closingBalance), "AED")}
                          {line.closingBalance < 0 && <span className="text-xs ml-1">(Cr)</span>}
                        </td>
                      </tr>
                    ))}
                    {/* Subtotal row */}
                    <tr className="bg-muted/20 border-t border-border">
                      <td colSpan={2} className="px-4 py-2.5 text-xs font-bold text-muted-foreground">
                        {TYPE_LABELS[type] ?? type} Subtotal
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs font-bold" />
                      <td className="px-4 py-2.5 text-right text-xs font-bold">{formatCurrency(sub.debits, "AED")}</td>
                      <td className="px-4 py-2.5 text-right text-xs font-bold">{formatCurrency(sub.credits, "AED")}</td>
                      <td className={cn("px-4 py-2.5 text-right text-xs font-bold", TYPE_BALANCE_COLOR[type] ?? "text-foreground")}>
                        {formatCurrency(Math.abs(sub.balance), "AED")}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}
          {Object.keys(grouped).length === 0 && (
            <div className="bg-card border border-border rounded-xl p-12 text-center text-sm text-muted-foreground">
              No trial balance data for this period.
            </div>
          )}
        </div>
      )}

      {/* Grand Total */}
      {trialBalance && (
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
      )}
    </div>
  );
}
