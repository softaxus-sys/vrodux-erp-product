"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign, Users, FileText, CheckCircle2, Clock,
  Plus, X, ChevronLeft, ChevronRight, Play, CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  usePayrollRuns, usePayrollRun,
  useGeneratePayroll, useProcessPayroll, usePayPayroll,
} from "@/hooks/hr/use-payroll";
import type { PayrollRunDto } from "@/lib/hr/payroll.api";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: "Draft",     color: "text-muted-foreground", bg: "bg-muted" },
  processing:{ label: "Processing",color: "text-warning",          bg: "bg-warning/10" },
  processed: { label: "Processed", color: "text-primary",          bg: "bg-primary/10" },
  paid:      { label: "Paid",      color: "text-success",          bg: "bg-success/10" },
};

function PayrollDetailDrawer({ runId, onClose }: { runId: string; onClose: () => void }) {
  const { data: run, isLoading } = usePayrollRun(runId);
  const processPayroll = useProcessPayroll();
  const payPayroll     = usePayPayroll();

  if (isLoading || !run) return null;
  const sc = STATUS_CONFIG[run.status] ?? { label: run.status, color: "text-foreground", bg: "bg-muted" };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="fixed top-0 right-0 h-full w-full max-w-[620px] bg-background border-l border-border shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <p className="font-bold text-base">{run.runNumber}</p>
            <p className="text-sm text-muted-foreground">Period: {run.period}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold capitalize", sc.color, sc.bg)}>{sc.label}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Totals */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Basic Salary", value: run.totalBasicSalary },
              { label: "Allowances",   value: run.totalAllowances },
              { label: "Deductions",   value: run.totalDeductions },
              { label: "Net Salary",   value: run.totalNetSalary },
            ].map(item => (
              <div key={item.label} className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-lg font-bold text-primary mt-1">{formatCurrency(item.value, "AED")}</p>
              </div>
            ))}
          </div>

          {/* Slips Table */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Payroll Slips ({run.slips.length})</h3>
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Employee</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Basic</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Allow.</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Deduct.</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {run.slips.map(slip => (
                    <tr key={slip.id} className="border-b border-border/30 last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <p className="font-medium">{slip.employeeName}</p>
                        <p className="text-xs text-muted-foreground">{slip.departmentName ?? slip.jobTitle ?? "—"}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(slip.basicSalary, "AED")}</td>
                      <td className="px-4 py-3 text-right text-success hidden sm:table-cell">{formatCurrency(slip.allowances, "AED")}</td>
                      <td className="px-4 py-3 text-right text-destructive hidden sm:table-cell">{formatCurrency(slip.deductions, "AED")}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(slip.netSalary, "AED")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Timestamps */}
          <div className="space-y-2 text-sm">
            {run.processedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Processed At</span>
                <span>{formatDate(run.processedAt, "medium")}</span>
              </div>
            )}
            {run.paidAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid At</span>
                <span>{formatDate(run.paidAt, "medium")}</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-border px-6 py-4 flex gap-2">
          {run.status === "draft" && (
            <Button size="sm" className="gap-1.5" disabled={processPayroll.isPending}
              onClick={() => { processPayroll.mutate(run.id); onClose(); }}>
              <Play className="h-3.5 w-3.5" /> Process
            </Button>
          )}
          {run.status === "processed" && (
            <Button size="sm" className="gap-1.5 bg-success hover:bg-success/90" disabled={payPayroll.isPending}
              onClick={() => { payPayroll.mutate(run.id); onClose(); }}>
              <CreditCard className="h-3.5 w-3.5" /> Mark as Paid
            </Button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function GeneratePayrollModal({ onClose }: { onClose: () => void }) {
  const generate = useGeneratePayroll();
  const thisMonth = new Date().toISOString().slice(0, 7);
  const [period, setPeriod] = React.useState(thisMonth);
  const [notes, setNotes]   = React.useState("");

  const handleSubmit = async () => {
    await generate.mutateAsync({ period, notes: notes || null });
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Generate Payroll</h2>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>
          <p className="text-sm text-muted-foreground">Auto-generates payroll slips from all active employees.</p>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Period (YYYY-MM) *</label>
            <Input value={period} onChange={e => setPeriod(e.target.value)} placeholder="2026-05" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. May 2026 payroll" className="h-9" />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!period || generate.isPending}>
              {generate.isPending ? "Generating…" : "Generate"}
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export function PayrollView() {
  const [page, setPage]             = React.useState(1);
  const [statusFilter, setStatus]   = React.useState<string>("all");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [showGenerate, setGenerate] = React.useState(false);

  const { data, isLoading } = usePayrollRuns({
    page,
    pageSize: 20,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const runs       = data?.items      ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalCount = data?.totalCount ?? 0;

  const totalNet = runs.reduce((s, r) => s + r.totalNetSalary, 0);

  const STAT_CARDS = [
    { label: "Runs",       value: runs.length,                     icon: FileText,    color: "text-primary",   bg: "bg-primary/10" },
    { label: "Draft",      value: runs.filter(r => r.status === "draft").length,     icon: Clock,       color: "text-muted-foreground", bg: "bg-muted" },
    { label: "Processed",  value: runs.filter(r => r.status === "processed").length, icon: CheckCircle2,color: "text-primary",   bg: "bg-primary/10" },
    { label: "Paid",       value: runs.filter(r => r.status === "paid").length,      icon: DollarSign,  color: "text-success",   bg: "bg-success/10" },
    { label: "Net Salary", value: formatCurrency(totalNet, "AED"), icon: Users,       color: "text-primary",   bg: "bg-primary/10", isText: true },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Payroll</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Manage payroll runs and employee salaries.</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => setGenerate(true)}>
          <Plus className="h-4 w-4" /> Generate Payroll
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {STAT_CARDS.map((card, i) => (
          <motion.div key={card.label}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-card border border-border rounded-xl p-4 space-y-2">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", card.bg)}>
              <card.icon className={cn("h-4 w-4", card.color)} />
            </div>
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className={cn("text-base font-bold leading-tight", card.color)}>{card.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-1.5 flex-wrap">
        {(["all", ...Object.keys(STATUS_CONFIG)] as const).map(s => (
          <button key={s} onClick={() => { setStatus(s); setPage(1); }}
            className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize",
              statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
            {s === "all" ? "All" : STATUS_CONFIG[s]?.label ?? s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/30 border-b border-border">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Run #</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Period</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden md:table-cell">Employees</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Total Basic</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Net Salary</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">Loading…</td></tr>
            ) : runs.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">No payroll runs found.</td></tr>
            ) : runs.map((run: PayrollRunDto) => {
              const sc = STATUS_CONFIG[run.status] ?? { label: run.status, color: "text-foreground", bg: "bg-muted" };
              return (
                <tr key={run.id} onClick={() => setSelectedId(run.id)}
                  className="border-b border-border/30 last:border-0 hover:bg-muted/20 cursor-pointer transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{run.runNumber}</td>
                  <td className="px-4 py-3 text-sm font-medium">{run.period}</td>
                  <td className="px-4 py-3 text-sm text-center hidden md:table-cell">{run.slipCount}</td>
                  <td className="px-4 py-3 text-sm text-right text-muted-foreground hidden sm:table-cell">
                    {formatCurrency(run.totalBasicSalary, "AED")}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-semibold">
                    {formatCurrency(run.totalNetSalary, "AED")}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold capitalize", sc.color, sc.bg)}>
                      {sc.label}
                    </span>
                  </td>
                </tr>
              );
            })}
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

      {selectedId && <PayrollDetailDrawer runId={selectedId} onClose={() => setSelectedId(null)} />}
      {showGenerate && <GeneratePayrollModal onClose={() => setGenerate(false)} />}
    </div>
  );
}
