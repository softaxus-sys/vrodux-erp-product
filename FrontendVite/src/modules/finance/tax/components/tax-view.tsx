import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Receipt, CheckCircle2, Clock, AlertCircle, DollarSign,
  Calendar, X, ArrowUpRight, ArrowDownRight, FileText, Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import type { TaxPeriodDto as TaxPeriod } from "@/lib/finance/finance.api";
import { useTaxPeriods, useTaxTransactions, useTaxSummary, useFileTaxPeriod, usePayTaxPeriod } from "@/hooks/finance/use-finance";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  open:    { label: "Open",    color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-900/20",    dot: "bg-blue-500" },
  filed:   { label: "Filed",   color: "text-warning",     bg: "bg-warning/10",                     dot: "bg-warning" },
  paid:    { label: "Paid",    color: "text-success",     bg: "bg-success/10",                     dot: "bg-success" },
  overdue: { label: "Overdue", color: "text-destructive", bg: "bg-destructive/10",                 dot: "bg-destructive" },
};

function TaxDrawer({ period, open, onClose, taxTransactions }: { period: TaxPeriod | null; open: boolean; onClose: () => void; taxTransactions: { id: string; date: string; type: "sale" | "purchase"; reference: string; amount: number; vatAmount: number; vatRate: number; description: string; period: string }[] }) {
  const currency = useCurrency();
  const [tab, setTab] = React.useState<"overview" | "sales" | "purchases">("overview");
  const fileReturn = useFileTaxPeriod();
  const payReturn  = usePayTaxPeriod();
  React.useEffect(() => { if (open) setTab("overview"); }, [open]);
  if (!period) return null;
  const busy = fileReturn.isPending || payReturn.isPending;
  const sc = STATUS_CONFIG[period.status];
  const salesTxns = taxTransactions.filter(t => t.period === period.period && t.type === "sale");
  const purchaseTxns = taxTransactions.filter(t => t.period === period.period && t.type === "purchase");

  return (
    <AnimatePresence>
      {open && (<>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
        <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 280 }}
          className="fixed top-0 right-0 h-full w-full max-w-[600px] bg-background border-l border-border shadow-2xl z-50 flex flex-col">
          <div className="flex items-start justify-between px-6 py-5 border-b border-border">
            <div>
              <p className="font-bold text-base">{period.period}</p>
              <p className="text-sm text-muted-foreground">{formatDate(period.from, "short")} — {formatDate(period.to, "short")}</p>
              <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold mt-1.5", sc.color, sc.bg)}>
                <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />{sc.label}
              </span>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>
          <div className="flex border-b border-border px-6">
            {(["overview", "sales", "purchases"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={cn("px-4 py-3 text-sm font-medium capitalize transition-colors border-b-2 -mb-px",
                  tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
                {t === "sales" ? `Sales (${salesTxns.length})` : t === "purchases" ? `Purchases (${purchaseTxns.length})` : "Overview"}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {tab === "overview" && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-success/5 border border-success/20 rounded-xl p-4 text-center">
                    <p className="text-[10px] text-muted-foreground mb-1">Output VAT</p>
                    <p className="font-bold text-lg text-success">{formatCurrency(period.outputVat, currency)}</p>
                    <p className="text-[10px] text-muted-foreground">From sales</p>
                  </div>
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
                    <p className="text-[10px] text-muted-foreground mb-1">Input VAT</p>
                    <p className="font-bold text-lg text-primary">{formatCurrency(period.inputVat, currency)}</p>
                    <p className="text-[10px] text-muted-foreground">From purchases</p>
                  </div>
                  <div className={cn("border rounded-xl p-4 text-center", period.netVat >= 0 ? "bg-warning/5 border-warning/20" : "bg-success/5 border-success/20")}>
                    <p className="text-[10px] text-muted-foreground mb-1">Net VAT</p>
                    <p className={cn("font-bold text-lg", period.netVat >= 0 ? "text-warning" : "text-success")}>{formatCurrency(Math.abs(period.netVat), currency)}</p>
                    <p className="text-[10px] text-muted-foreground">{period.netVat >= 0 ? "Payable" : "Refundable"}</p>
                  </div>
                </div>
                <div className="bg-muted/30 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Filing Due</span><span className={cn(period.status === "overdue" ? "text-destructive font-semibold" : "")}>{formatDate(period.dueDate, "medium")}</span></div>
                  {period.filedDate && <div className="flex justify-between"><span className="text-muted-foreground">Filed On</span><span className="text-success">{formatDate(period.filedDate, "medium")}</span></div>}
                  {period.paidDate && <div className="flex justify-between"><span className="text-muted-foreground">Paid On</span><span className="text-success">{formatDate(period.paidDate, "medium")}</span></div>}
                  {period.penalty && <div className="flex justify-between"><span className="text-muted-foreground">Penalty</span><span className="text-destructive font-semibold">{formatCurrency(period.penalty, currency)}</span></div>}
                </div>
              </>
            )}
            {(tab === "sales" || tab === "purchases") && (
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="bg-muted/40 text-xs text-muted-foreground">
                    <th className="text-left px-4 py-3 font-semibold">Date</th>
                    <th className="text-left px-4 py-3 font-semibold">Description</th>
                    <th className="text-right px-4 py-3 font-semibold">Amount</th>
                    <th className="text-right px-4 py-3 font-semibold">VAT</th>
                  </tr></thead>
                  <tbody>
                    {(tab === "sales" ? salesTxns : purchaseTxns).map((t, i) => (
                      <motion.tr key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                        className="border-t border-border/40 hover:bg-muted/20">
                        <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(t.date, "short")}</td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium">{t.description}</p>
                          <p className="text-xs text-muted-foreground font-mono">{t.reference}</p>
                        </td>
                        <td className="px-4 py-3 text-right text-sm">{formatCurrency(t.amount, currency)}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-warning">{formatCurrency(t.vatAmount, currency)}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="border-t border-border px-6 py-4 flex items-center gap-2">
            {period.status === "open" && <Button size="sm" disabled={busy} className="gap-1.5 h-9" onClick={() => fileReturn.mutate(period.id, { onSuccess: onClose })}><FileText className="h-3.5 w-3.5" />File Return</Button>}
            {period.status === "filed" && <Button size="sm" disabled={busy} className="gap-1.5 h-9 bg-success hover:bg-success/90" onClick={() => payReturn.mutate(period.id, { onSuccess: onClose })}><CheckCircle2 className="h-3.5 w-3.5" />Mark Paid</Button>}
          </div>
        </motion.div>
      </>)}
    </AnimatePresence>
  );
}

export function TaxView() {
  const currency = useCurrency();
  const { data: taxPeriods = [] } = useTaxPeriods();
  const { data: taxTransactions = [] } = useTaxTransactions();
  const { data: taxSummary } = useTaxSummary();
  const fileRow = useFileTaxPeriod();
  const payRow  = usePayTaxPeriod();

  const [selected, setSelected] = React.useState<TaxPeriod | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const STATS = [
    { label: "Output VAT (Current)", value: formatCurrency(taxSummary?.currentPeriodOutput ?? 0, currency), icon: ArrowUpRight, color: "text-success", bg: "bg-success/10" },
    { label: "Input VAT (Current)", value: formatCurrency(taxSummary?.currentPeriodInput ?? 0, currency), icon: ArrowDownRight, color: "text-primary", bg: "bg-primary/10" },
    { label: "Net VAT Payable", value: formatCurrency(taxSummary?.currentNetVat ?? 0, currency), icon: Receipt, color: "text-warning", bg: "bg-warning/10" },
    { label: "YTD VAT Paid", value: formatCurrency(taxSummary?.ytdVatPaid ?? 0, currency), icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
    { label: "Next Filing Due", value: taxSummary?.nextDueDate ? formatDate(taxSummary.nextDueDate, "short") : "—", icon: Calendar, color: "text-destructive", bg: "bg-destructive/10" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Tax & VAT</h1><p className="text-sm text-muted-foreground mt-0.5">UAE VAT returns, filing, and tax transaction tracking</p></div>
        <Button className="gap-2 h-9"><Plus className="h-4 w-4" />New Return</Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {STATS.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", s.bg)}><Icon className={cn("h-5 w-5", s.color)} /></div>
              <div className="min-w-0"><p className="text-xs text-muted-foreground truncate">{s.label}</p><p className="font-bold text-sm leading-tight">{s.value}</p></div>
            </motion.div>
          );
        })}
      </div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <h3 className="text-sm font-semibold">VAT Return Periods</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/10">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Period</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">From — To</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Output VAT</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Input VAT</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Net VAT</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Due Date</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Action</th>
            </tr>
          </thead>
          <tbody>
            {taxPeriods.map((p, i) => {
              const sc = STATUS_CONFIG[p.status];
              return (
                <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                  onClick={() => { setSelected(p); setDrawerOpen(true); }}
                  className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors cursor-pointer">
                  <td className="px-4 py-4 font-semibold text-sm">{p.period}</td>
                  <td className="px-4 py-4 text-sm text-muted-foreground hidden md:table-cell">{formatDate(p.from, "short")} — {formatDate(p.to, "short")}</td>
                  <td className="px-4 py-4 text-right font-medium text-success text-sm">{formatCurrency(p.outputVat, currency)}</td>
                  <td className="px-4 py-4 text-right text-muted-foreground text-sm hidden lg:table-cell">{formatCurrency(p.inputVat, currency)}</td>
                  <td className="px-4 py-4 text-right font-bold text-sm">{formatCurrency(p.netVat, currency)}</td>
                  <td className="px-4 py-4 text-sm text-muted-foreground hidden md:table-cell">
                    <span className={cn(p.status === "overdue" ? "text-destructive font-semibold" : "")}>{formatDate(p.dueDate, "short")}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />{sc.label}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right" onClick={e => e.stopPropagation()}>
                    {p.status === "open" && <Button size="sm" className="h-7 text-xs" disabled={fileRow.isPending} onClick={() => fileRow.mutate(p.id)}>File</Button>}
                    {p.status === "filed" && <Button size="sm" className="h-7 text-xs bg-success hover:bg-success/90" disabled={payRow.isPending} onClick={() => payRow.mutate(p.id)}>Pay</Button>}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </motion.div>
      <TaxDrawer period={selected} open={drawerOpen} onClose={() => setDrawerOpen(false)} taxTransactions={taxTransactions} />
    </div>
  );
}

