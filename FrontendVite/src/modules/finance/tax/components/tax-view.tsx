import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  Receipt, CheckCircle2, Clock, AlertCircle, DollarSign,
  Calendar, X, ArrowUpRight, ArrowDownRight, FileText, Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import type { TaxPeriodDto as TaxPeriod } from "@/lib/finance/finance.api";
import { useTaxPeriods, useTaxTransactions, useTaxSummary, useFileTaxPeriod, usePayTaxPeriod, useCreateTaxPeriod } from "@/hooks/finance/use-finance";
import { Can } from "@/components/auth/can";

const STATUS_CONFIG: Record<string, { color: string; bg: string; dot: string }> = {
  open:    { color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-900/20",    dot: "bg-blue-500" },
  filed:   { color: "text-warning",     bg: "bg-warning/10",                     dot: "bg-warning" },
  paid:    { color: "text-success",     bg: "bg-success/10",                     dot: "bg-success" },
  overdue: { color: "text-destructive", bg: "bg-destructive/10",                 dot: "bg-destructive" },
};

function TaxDrawer({ period, open, onClose }: { period: TaxPeriod | null; open: boolean; onClose: () => void }) {
  const { t } = useTranslation("finance");
  const currency = useCurrency();
  const [tab, setTab] = React.useState<"overview" | "sales" | "purchases">("overview");
  const fileReturn = useFileTaxPeriod();
  const payReturn  = usePayTaxPeriod();
  // Fetched here, for this period only. The list page used to load every VAT-bearing transaction
  // the tenant has ever had — derived from every invoice and bill — just to filter one period out
  // of it in the browser. Nothing loads until a period is actually opened.
  const { data: taxTransactions = [] } = useTaxTransactions(open ? period?.period : undefined);
  React.useEffect(() => { if (open) setTab("overview"); }, [open]);
  if (!period) return null;
  const busy = fileReturn.isPending || payReturn.isPending;
  const sc = STATUS_CONFIG[period.status] ?? STATUS_CONFIG.open;
  const salesTxns = taxTransactions.filter(t => t.type === "sale");
  const purchaseTxns = taxTransactions.filter(t => t.type === "purchase");

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
                <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />{t(`tax.status.${period.status}`)}
              </span>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>
          <div className="flex border-b border-border px-6">
            {(["overview", "sales", "purchases"] as const).map(tabKey => (
              <button key={tabKey} onClick={() => setTab(tabKey)}
                className={cn("px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px",
                  tab === tabKey ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
                {tabKey === "sales" ? t("tax.drawer.sales", { count: salesTxns.length }) : tabKey === "purchases" ? t("tax.drawer.purchases", { count: purchaseTxns.length }) : t("tax.drawer.overview")}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {tab === "overview" && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-success/5 border border-success/20 rounded-xl p-4 text-center">
                    <p className="text-[10px] text-muted-foreground mb-1">{t("tax.drawer.outputVat")}</p>
                    <p className="font-bold text-lg text-success">{formatCurrency(period.outputVat, currency)}</p>
                    <p className="text-[10px] text-muted-foreground">{t("tax.drawer.fromSales")}</p>
                  </div>
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
                    <p className="text-[10px] text-muted-foreground mb-1">{t("tax.drawer.inputVat")}</p>
                    <p className="font-bold text-lg text-primary">{formatCurrency(period.inputVat, currency)}</p>
                    <p className="text-[10px] text-muted-foreground">{t("tax.drawer.fromPurchases")}</p>
                  </div>
                  <div className={cn("border rounded-xl p-4 text-center", period.netVat >= 0 ? "bg-warning/5 border-warning/20" : "bg-success/5 border-success/20")}>
                    <p className="text-[10px] text-muted-foreground mb-1">{t("tax.drawer.netVat")}</p>
                    <p className={cn("font-bold text-lg", period.netVat >= 0 ? "text-warning" : "text-success")}>{formatCurrency(Math.abs(period.netVat), currency)}</p>
                    <p className="text-[10px] text-muted-foreground">{period.netVat >= 0 ? t("tax.drawer.payable") : t("tax.drawer.refundable")}</p>
                  </div>
                </div>
                <div className="bg-muted/30 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">{t("tax.drawer.filingDue")}</span><span className={cn(period.status === "overdue" ? "text-destructive font-semibold" : "")}>{formatDate(period.dueDate, "medium")}</span></div>
                  {period.filedDate && <div className="flex justify-between"><span className="text-muted-foreground">{t("tax.drawer.filedOn")}</span><span className="text-success">{formatDate(period.filedDate, "medium")}</span></div>}
                  {period.paidDate && <div className="flex justify-between"><span className="text-muted-foreground">{t("tax.drawer.paidOn")}</span><span className="text-success">{formatDate(period.paidDate, "medium")}</span></div>}
                  {period.penalty && <div className="flex justify-between"><span className="text-muted-foreground">{t("tax.drawer.penalty")}</span><span className="text-destructive font-semibold">{formatCurrency(period.penalty, currency)}</span></div>}
                </div>
              </>
            )}
            {(tab === "sales" || tab === "purchases") && (
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="bg-muted/40 text-xs text-muted-foreground">
                    <th className="text-left px-4 py-3 font-semibold">{t("tax.drawer.txDate")}</th>
                    <th className="text-left px-4 py-3 font-semibold">{t("tax.drawer.txDescription")}</th>
                    <th className="text-right px-4 py-3 font-semibold">{t("tax.drawer.txAmount")}</th>
                    <th className="text-right px-4 py-3 font-semibold">{t("tax.drawer.txVat")}</th>
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
            {period.status === "open" && <Button size="sm" disabled={busy} className="gap-1.5 h-9" onClick={() => fileReturn.mutate(period.id, { onSuccess: onClose })}><FileText className="h-3.5 w-3.5" />{t("tax.drawer.fileReturn")}</Button>}
            {period.status === "filed" && <Button size="sm" disabled={busy} className="gap-1.5 h-9 bg-success hover:bg-success/90" onClick={() => payReturn.mutate(period.id, { onSuccess: onClose })}><CheckCircle2 className="h-3.5 w-3.5" />{t("tax.drawer.markPaid")}</Button>}
          </div>
        </motion.div>
      </>)}
    </AnimatePresence>
  );
}

/** Builds the next 6 quarter options (2 past, current, 3 future) with UAE filing dates. */
function buildQuarterOptions() {
  const opts: { label: string; period: string; from: string; to: string; due: string }[] = [];
  const now = new Date();
  const baseQ = Math.floor(now.getMonth() / 3);
  for (let i = -2; i <= 3; i++) {
    const qIndex = baseQ + i;
    const year = now.getFullYear() + Math.floor(qIndex / 4);
    const q = ((qIndex % 4) + 4) % 4; // 0..3
    const startMonth = q * 3;
    const from = new Date(year, startMonth, 1);
    const to = new Date(year, startMonth + 3, 0);          // last day of quarter
    const due = new Date(year, startMonth + 3, 28);        // 28 days after quarter end
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    opts.push({
      label: `Q${q + 1}-${year}`,
      period: `Q${q + 1}-${year}`,
      from: iso(from), to: iso(to), due: iso(due),
    });
  }
  return opts;
}

function NewReturnForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation("finance");
  const create = useCreateTaxPeriod();
  const quarters = React.useMemo(buildQuarterOptions, []);
  const [idx, setIdx] = React.useState(2); // current quarter
  const sel = quarters[idx];
  const [from, setFrom] = React.useState(sel.from);
  const [to, setTo] = React.useState(sel.to);
  const [due, setDue] = React.useState(sel.due);

  React.useEffect(() => {
    if (!open) return;
    setIdx(2);
    setFrom(quarters[2].from); setTo(quarters[2].to); setDue(quarters[2].due);
  }, [open, quarters]);

  const pickQuarter = (i: number) => {
    setIdx(i);
    setFrom(quarters[i].from); setTo(quarters[i].to); setDue(quarters[i].due);
  };

  const submit = async () => {
    try {
      await create.mutateAsync({ period: quarters[idx].period, fromDate: from, toDate: to, dueDate: due });
      onClose();
    } catch { /* hook toasts the error; keep form open for retry */ }
  };

  return (
    <AnimatePresence>
      {open && (<>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
        <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 280 }}
          className="fixed top-0 right-0 h-full w-full max-w-[460px] bg-background border-l border-border shadow-2xl z-50 flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div>
              <h2 className="text-base font-bold">{t("tax.form.title")}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{t("tax.form.subtitle")}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("tax.form.periodQuarter")}</label>
              <select value={idx} onChange={e => pickQuarter(Number(e.target.value))}
                className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                {quarters.map((q, i) => <option key={q.period} value={i}>{q.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("tax.form.from")}</label>
                <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("tax.form.to")}</label>
                <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9 text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("tax.form.filingDueDate")}</label>
              <Input type="date" value={due} onChange={e => setDue(e.target.value)} className="h-9 text-sm" />
              <p className="text-[11px] text-muted-foreground">{t("tax.form.dueNote")}</p>
            </div>
          </div>
          <div className="border-t border-border px-6 py-4 flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose} disabled={create.isPending}>{t("common:action.cancel")}</Button>
            <Button onClick={submit} disabled={create.isPending || !from || !to || !due}>
              {create.isPending ? t("common:action.creating") : t("tax.form.createReturn")}
            </Button>
          </div>
        </motion.div>
      </>)}
    </AnimatePresence>
  );
}

export function TaxView() {
  const { t } = useTranslation("finance");
  const currency = useCurrency();
  const { data: taxPeriods = [] } = useTaxPeriods();
  const { data: taxSummary } = useTaxSummary();
  const fileRow = useFileTaxPeriod();
  const payRow  = usePayTaxPeriod();

  const [selected, setSelected] = React.useState<TaxPeriod | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [newReturnOpen, setNewReturnOpen] = React.useState(false);

  const STATS = [
    { label: t("tax.stat.outputVatCurrent"), value: formatCurrency(taxSummary?.currentPeriodOutput ?? 0, currency), icon: ArrowUpRight, color: "text-success", bg: "bg-success/10" },
    { label: t("tax.stat.inputVatCurrent"), value: formatCurrency(taxSummary?.currentPeriodInput ?? 0, currency), icon: ArrowDownRight, color: "text-primary", bg: "bg-primary/10" },
    { label: t("tax.stat.netVatPayable"), value: formatCurrency(taxSummary?.currentNetVat ?? 0, currency), icon: Receipt, color: "text-warning", bg: "bg-warning/10" },
    { label: t("tax.stat.ytdVatPaid"), value: formatCurrency(taxSummary?.ytdVatPaid ?? 0, currency), icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
    { label: t("tax.stat.nextFilingDue"), value: taxSummary?.nextDueDate ? formatDate(taxSummary.nextDueDate, "short") : "—", icon: Calendar, color: "text-destructive", bg: "bg-destructive/10" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">{t("tax.title")}</h1><p className="text-sm text-muted-foreground mt-0.5">{t("tax.subtitle")}</p></div>
        <Can permission="finance.tax.create"><Button className="gap-2 h-9" onClick={() => setNewReturnOpen(true)}><Plus className="h-4 w-4" />{t("tax.newReturn")}</Button></Can>
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
          <h3 className="text-sm font-semibold">{t("tax.periodsTitle")}</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/10">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("tax.table.period")}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">{t("tax.table.fromTo")}</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("tax.table.outputVat")}</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">{t("tax.table.inputVat")}</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("tax.table.netVat")}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">{t("tax.table.dueDate")}</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("tax.table.status")}</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("tax.table.action")}</th>
            </tr>
          </thead>
          <tbody>
            {taxPeriods.map((p, i) => {
              const sc = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.open;
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
                      <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />{t(`tax.status.${p.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right" onClick={e => e.stopPropagation()}>
                    {p.status === "open" && <Button size="sm" className="h-7 text-xs" disabled={fileRow.isPending} onClick={() => fileRow.mutate(p.id)}>{t("tax.table.file")}</Button>}
                    {p.status === "filed" && <Button size="sm" className="h-7 text-xs bg-success hover:bg-success/90" disabled={payRow.isPending} onClick={() => payRow.mutate(p.id)}>{t("tax.table.pay")}</Button>}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </motion.div>
      <TaxDrawer period={selected} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <NewReturnForm open={newReturnOpen} onClose={() => setNewReturnOpen(false)} />
    </div>
  );
}

