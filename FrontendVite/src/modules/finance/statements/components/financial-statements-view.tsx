import * as React from "react";
import { motion } from "framer-motion";
import { BarChart3, Scale, TrendingUp, Wallet, Printer, Download, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency } from "@/lib/utils";
import { useProfitLoss, useBalanceSheet, useCashFlow } from "@/hooks/finance/use-finance";
import type { StatementLine } from "@/lib/finance/finance.api";
import { toCsv, downloadFile } from "@/lib/csv";

type Tab = "pl" | "bs" | "cf";
const CUR = "AED";

const todayIso = () => new Date().toISOString().slice(0, 10);
const yearStartIso = () => `${new Date().getFullYear()}-01-01`;

export function FinancialStatementsView() {
  const [tab, setTab]   = React.useState<Tab>("pl");
  const [from, setFrom] = React.useState(yearStartIso());
  const [to, setTo]     = React.useState(todayIso());

  const pl = useProfitLoss(from, to);
  const bs = useBalanceSheet(to);
  const cf = useCashFlow(from, to);

  const TABS: { key: Tab; label: string; icon: typeof BarChart3 }[] = [
    { key: "pl", label: "Profit & Loss", icon: TrendingUp },
    { key: "bs", label: "Balance Sheet", icon: Scale },
    { key: "cf", label: "Cash Flow",     icon: Wallet },
  ];

  const exportCsv = () => {
    if (tab === "pl" && pl.data) {
      const rows = [
        ...pl.data.revenue.map(r => ({ Section: "Revenue", Account: r.accountName, Amount: r.amount })),
        { Section: "Revenue", Account: "Total Revenue", Amount: pl.data.totalRevenue },
        ...pl.data.expenses.map(r => ({ Section: "Expense", Account: r.accountName, Amount: r.amount })),
        { Section: "Expense", Account: "Total Expenses", Amount: pl.data.totalExpenses },
        { Section: "Result", Account: "Net Profit", Amount: pl.data.netProfit },
      ];
      downloadFile(`profit-loss_${from}_${to}.csv`, toCsv(rows, ["Section", "Account", "Amount"]));
    } else if (tab === "bs" && bs.data) {
      const rows = [
        ...bs.data.assets.map(r => ({ Section: "Asset", Account: r.accountName, Amount: r.amount })),
        ...bs.data.liabilities.map(r => ({ Section: "Liability", Account: r.accountName, Amount: r.amount })),
        ...bs.data.equity.map(r => ({ Section: "Equity", Account: r.accountName, Amount: r.amount })),
        { Section: "Equity", Account: "Retained Earnings", Amount: bs.data.retainedEarnings },
      ];
      downloadFile(`balance-sheet_${to}.csv`, toCsv(rows, ["Section", "Account", "Amount"]));
    } else if (tab === "cf" && cf.data) {
      const d = cf.data;
      downloadFile(`cash-flow_${from}_${to}.csv`, toCsv([
        { Item: "Opening Cash", Amount: d.openingCash },
        { Item: "Inflows", Amount: d.inflows },
        { Item: "Outflows", Amount: d.outflows },
        { Item: "Net Cash Flow", Amount: d.netCashFlow },
        { Item: "Closing Cash", Amount: d.closingCash },
      ], ["Item", "Amount"]));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Financial Statements</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Profit &amp; Loss, Balance Sheet and Cash Flow — from posted journal entries</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={exportCsv}><Download className="h-4 w-4" />Export</Button>
          <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={() => window.print()}><Printer className="h-4 w-4" />Print</Button>
        </div>
      </div>

      {/* Tabs + date controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1.5">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={cn("flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all",
                  tab === t.key ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground")}>
                <Icon className="h-4 w-4" />{t.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 text-sm">
          {tab === "bs" ? (
            <label className="flex items-center gap-1.5"><span className="text-muted-foreground text-xs">As of</span>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9 w-40 text-sm" /></label>
          ) : (
            <>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9 w-40 text-sm" />
              <span className="text-muted-foreground">→</span>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9 w-40 text-sm" />
            </>
          )}
        </div>
      </div>

      <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        {tab === "pl" && <ProfitLoss data={pl.data} loading={pl.isLoading} />}
        {tab === "bs" && <BalanceSheet data={bs.data} loading={bs.isLoading} />}
        {tab === "cf" && <CashFlow data={cf.data} loading={cf.isLoading} />}
      </motion.div>
    </div>
  );
}

// ── Section table ─────────────────────────────────────────────────────────────

function Section({ title, lines, total, tone = "default" }: { title: string; lines: StatementLine[]; total: number; tone?: "default" | "good" | "bad" }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-muted/30 border-b border-border">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</h3>
      </div>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-border/60">
          {lines.length === 0 ? (
            <tr><td className="px-4 py-3 text-muted-foreground text-xs">No entries</td></tr>
          ) : lines.map(l => (
            <tr key={l.accountCode} className="hover:bg-muted/20">
              <td className="px-4 py-2.5"><span className="font-mono text-xs text-muted-foreground mr-2">{l.accountCode}</span>{l.accountName}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(l.amount, CUR)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border bg-muted/20">
            <td className="px-4 py-2.5 font-bold">Total {title}</td>
            <td className={cn("px-4 py-2.5 text-right font-bold tabular-nums",
              tone === "good" ? "text-success" : tone === "bad" ? "text-destructive" : "")}>{formatCurrency(total, CUR)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function Loading() {
  return <div className="bg-card border border-border rounded-xl p-12 text-center text-sm text-muted-foreground">Loading…</div>;
}

// ── P&L ─────────────────────────────────────────────────────────────────────────

function ProfitLoss({ data, loading }: { data: ReturnType<typeof useProfitLoss>["data"]; loading: boolean }) {
  if (loading || !data) return <Loading />;
  const margin = data.totalRevenue > 0 ? Math.round((data.netProfit / data.totalRevenue) * 100) : 0;
  return (
    <div className="space-y-4">
      <Section title="Revenue" lines={data.revenue} total={data.totalRevenue} tone="good" />
      <Section title="Expenses" lines={data.expenses} total={data.totalExpenses} tone="bad" />
      <div className={cn("rounded-xl p-5 flex items-center justify-between", data.netProfit >= 0 ? "bg-success/10 border border-success/20" : "bg-destructive/10 border border-destructive/20")}>
        <div>
          <p className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">Net Profit</p>
          <p className="text-[11px] text-muted-foreground">Margin {margin}% · {data.from} → {data.to}</p>
        </div>
        <p className={cn("text-2xl font-bold tabular-nums", data.netProfit >= 0 ? "text-success" : "text-destructive")}>{formatCurrency(data.netProfit, CUR)}</p>
      </div>
    </div>
  );
}

// ── Balance Sheet ────────────────────────────────────────────────────────────────

function BalanceSheet({ data, loading }: { data: ReturnType<typeof useBalanceSheet>["data"]; loading: boolean }) {
  if (loading || !data) return <Loading />;
  return (
    <div className="space-y-4">
      <div className={cn("rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm font-medium",
        data.isBalanced ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
        {data.isBalanced ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
        {data.isBalanced ? "Balanced — Assets = Liabilities + Equity" : "Out of balance — check posted entries"}
      </div>
      <div className="grid md:grid-cols-2 gap-4 items-start">
        <Section title="Assets" lines={data.assets} total={data.totalAssets} />
        <div className="space-y-4">
          <Section title="Liabilities" lines={data.liabilities} total={data.totalLiabilities} />
          <Section title="Equity"
            lines={[...data.equity, { accountCode: "—", accountName: "Retained Earnings", amount: data.retainedEarnings }]}
            total={data.totalEquity} />
          <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="font-bold text-sm">Total Liabilities + Equity</span>
            <span className="font-bold tabular-nums">{formatCurrency(data.totalLiabilitiesAndEquity, CUR)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Cash Flow ─────────────────────────────────────────────────────────────────────

function CashFlow({ data, loading }: { data: ReturnType<typeof useCashFlow>["data"]; loading: boolean }) {
  if (loading || !data) return <Loading />;
  const rows: { label: string; value: number; tone?: "good" | "bad" }[] = [
    { label: "Opening Cash Balance", value: data.openingCash },
    { label: "Cash Inflows", value: data.inflows, tone: "good" },
    { label: "Cash Outflows", value: -data.outflows, tone: "bad" },
    { label: "Net Cash Flow", value: data.netCashFlow, tone: data.netCashFlow >= 0 ? "good" : "bad" },
  ];
  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-border/60">
            {rows.map(r => (
              <tr key={r.label} className="hover:bg-muted/20">
                <td className="px-4 py-3 font-medium">{r.label}</td>
                <td className={cn("px-4 py-3 text-right tabular-nums font-semibold",
                  r.tone === "good" ? "text-success" : r.tone === "bad" ? "text-destructive" : "")}>{formatCurrency(r.value, CUR)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-primary/5">
              <td className="px-4 py-3 font-bold">Closing Cash Balance</td>
              <td className="px-4 py-3 text-right font-bold tabular-nums text-primary">{formatCurrency(data.closingCash, CUR)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-muted-foreground px-1">Direct method over cash &amp; bank accounts · {data.from} → {data.to}</p>
    </div>
  );
}
