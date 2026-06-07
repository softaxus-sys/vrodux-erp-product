"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, TrendingDown, Target, AlertTriangle, CheckCircle2, BarChart3,
  X, Plus, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency } from "@/lib/utils";
import { useBudgets, useBudget } from "@/hooks/finance/use-budgets";
import type { BudgetSummaryDto } from "@/lib/finance/budgets.api";
import { AddBudgetForm } from "./add-budget-form";

const STATUS_STYLES: Record<string, string> = {
  draft:    "bg-muted text-muted-foreground",
  approved: "bg-primary/10 text-primary",
  active:   "bg-success/10 text-success",
  closed:   "bg-muted text-muted-foreground",
};

function UtilisationBar({ actual, budget }: { actual: number; budget: number }) {
  const pct = Math.min(budget > 0 ? (actual / budget) * 100 : 0, 120);
  const isOver = actual > budget;
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", isOver ? "bg-destructive" : "bg-success")}
          style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className={cn("text-xs font-medium w-12 text-right shrink-0", isOver ? "text-destructive" : "text-muted-foreground")}>
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

function BudgetDetailDrawer({ budgetId, onClose }: { budgetId: string; onClose: () => void }) {
  const { data: budget, isLoading } = useBudget(budgetId);

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="fixed top-0 right-0 h-full w-full max-w-[620px] bg-background border-l border-border shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Budget Detail</p>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        {isLoading || !budget ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading…</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">{budget.name}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Period: {budget.period}</p>
              </div>
              <span className={cn("px-3 py-1 rounded-full text-xs font-semibold capitalize",
                STATUS_STYLES[budget.status] ?? "bg-muted text-muted-foreground")}>
                {budget.status}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Total Budget", value: formatCurrency(budget.totalBudgeted, "AED"), color: "text-primary" },
                { label: "Actual Spend", value: formatCurrency(budget.totalActual, "AED"),
                  color: budget.totalActual > budget.totalBudgeted ? "text-destructive" : "text-success" },
                { label: "Variance", value: formatCurrency(Math.abs(budget.variance), "AED"),
                  color: budget.variance > 0 ? "text-destructive" : "text-success" },
              ].map(item => (
                <div key={item.label} className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className={cn("text-lg font-bold mt-1", item.color)}>{item.value}</p>
                </div>
              ))}
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2">Budget Utilisation</p>
              <UtilisationBar actual={budget.totalActual} budget={budget.totalBudgeted} />
            </div>

            {budget.lines.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3">Budget Line Items</h3>
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/30 border-b border-border">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Category</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Budget</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Actual</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Variance</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground w-32">Utilisation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {budget.lines.map(line => (
                        <tr key={line.id} className="border-b border-border/30 last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-3 text-sm">
                            <p>{line.category}</p>
                            {line.accountName && <p className="text-xs text-muted-foreground">{line.accountName}</p>}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                            {formatCurrency(line.budgetedAmount, "AED")}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-medium">
                            {formatCurrency(line.actualAmount, "AED")}
                          </td>
                          <td className={cn("px-4 py-3 text-right text-sm font-semibold",
                            line.variance > 0 ? "text-destructive" : "text-success")}>
                            {line.variance > 0 ? "+" : ""}{formatCurrency(line.variance, "AED")}
                          </td>
                          <td className="px-4 py-3">
                            <UtilisationBar actual={line.actualAmount} budget={line.budgetedAmount} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {budget.notes && (
              <div className="bg-muted/30 rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">Notes</p>
                <p className="text-sm">{budget.notes}</p>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

export function BudgetingView() {
  const [statusFilter, setStatus]   = React.useState("all");
  const [search, setSearch]         = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [showAdd, setShowAdd]       = React.useState(false);

  const { data: budgets = [], isLoading } = useBudgets({
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const filtered = React.useMemo(() => {
    if (!search) return budgets;
    const q = search.toLowerCase();
    return budgets.filter(b =>
      b.name.toLowerCase().includes(q) || b.period.toLowerCase().includes(q)
    );
  }, [budgets, search]);

  const totalBudgeted = filtered.reduce((s, b) => s + b.totalBudgeted, 0);
  const totalActual   = filtered.reduce((s, b) => s + b.totalActual, 0);
  const totalVariance = filtered.reduce((s, b) => s + b.variance, 0);
  const overBudget    = filtered.filter(b => b.totalActual > b.totalBudgeted).length;
  const underBudget   = filtered.filter(b => b.totalActual <= b.totalBudgeted).length;
  const utilisation   = totalBudgeted > 0 ? ((totalActual / totalBudgeted) * 100).toFixed(1) : "0.0";

  const STAT_CARDS = [
    { label: "Total Budget",  value: formatCurrency(totalBudgeted, "AED"),            icon: Target,        color: "text-primary",     bg: "bg-primary/10" },
    { label: "Actual Spend",  value: formatCurrency(totalActual, "AED"),              icon: BarChart3,     color: "text-warning",     bg: "bg-warning/10" },
    { label: "Variance",      value: formatCurrency(Math.abs(totalVariance), "AED"),  icon: TrendingDown,  color: totalVariance > 0 ? "text-destructive" : "text-success", bg: totalVariance > 0 ? "bg-destructive/10" : "bg-success/10" },
    { label: "Over Budget",   value: overBudget,                                      icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Under Budget",  value: underBudget,                                     icon: CheckCircle2,  color: "text-success",     bg: "bg-success/10" },
    { label: "Utilisation",   value: `${utilisation}%`,                               icon: TrendingUp,    color: "text-primary",     bg: "bg-primary/10" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Budget Planning</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Track budget allocations vs. actual spending.</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" /> New Budget
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input placeholder="Search budgets…" value={search}
            onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {["all", "draft", "approved", "active", "closed"].map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize",
                statusFilter === s
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground")}>
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Budget Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Period</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Budget</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Actual</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Variance</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell w-48">Utilisation</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-12 text-sm text-muted-foreground">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-sm text-muted-foreground">No budgets found.</td></tr>
            ) : filtered.map((budget: BudgetSummaryDto, i) => (
              <motion.tr key={budget.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04 }} onClick={() => setSelectedId(budget.id)}
                className="border-b border-border/40 last:border-0 hover:bg-muted/20 cursor-pointer transition-colors">
                <td className="px-4 py-3.5">
                  <p className="text-sm font-semibold">{budget.name}</p>
                  <p className="text-xs text-muted-foreground">{budget.lineCount} line items</p>
                </td>
                <td className="px-4 py-3.5 text-sm text-muted-foreground hidden md:table-cell">{budget.period}</td>
                <td className="px-4 py-3.5 text-right text-sm text-muted-foreground">{formatCurrency(budget.totalBudgeted, "AED")}</td>
                <td className="px-4 py-3.5 text-right text-sm font-medium hidden md:table-cell">{formatCurrency(budget.totalActual, "AED")}</td>
                <td className={cn("px-4 py-3.5 text-right text-sm font-semibold hidden lg:table-cell",
                  budget.variance > 0 ? "text-destructive" : "text-success")}>
                  {budget.variance > 0 ? "+" : ""}{formatCurrency(budget.variance, "AED")}
                </td>
                <td className="px-4 py-3.5 hidden lg:table-cell">
                  <UtilisationBar actual={budget.totalActual} budget={budget.totalBudgeted} />
                </td>
                <td className="px-4 py-3.5 text-center">
                  <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold capitalize",
                    STATUS_STYLES[budget.status] ?? "bg-muted text-muted-foreground")}>
                    {budget.status}
                  </span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </motion.div>

      {selectedId && <BudgetDetailDrawer budgetId={selectedId} onClose={() => setSelectedId(null)} />}
      <AddBudgetForm open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  );
}
