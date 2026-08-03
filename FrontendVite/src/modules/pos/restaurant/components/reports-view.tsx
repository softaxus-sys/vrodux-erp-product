import * as React from "react";
import { BarChart3, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ExportMenu } from "@/components/ui/export-menu";
import { toCsv, downloadFile } from "@/lib/csv";
import { exportPdf } from "@/lib/pdf";
import { cn, formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useUsers } from "@/hooks/identity/use-users";
import {
  useSalesDailyReport, useSalesByCategoryReport, useSalesByEmployeeReport, useVoidsDiscountsReport,
  useKitchenPrepTimesReport, useTableTurnoverReport, useTaxSummaryReport, useXReport, useZReport,
} from "@/hooks/restaurant/use-restaurant-reports";
import { useShift } from "@/modules/pos/retail/components/shift-gate";

function todayIso() { return new Date().toISOString().split("T")[0]; }
function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

const TABS = [
  { id: "sales-daily", label: "Sales (Daily)" },
  { id: "sales-category", label: "By Category" },
  { id: "sales-employee", label: "By Employee" },
  { id: "voids-discounts", label: "Voids & Discounts" },
  { id: "kitchen-prep", label: "Kitchen Prep Times" },
  { id: "table-turnover", label: "Table Turnover" },
  { id: "tax-summary", label: "Tax Summary" },
  { id: "z-x-report", label: "Z / X Report" },
] as const;
type TabId = typeof TABS[number]["id"];

function EmptyState({ label }: { label: string }) {
  return <p className="text-center text-sm text-muted-foreground py-10">No {label} in this range.</p>;
}

function ReportTable({ columns, rows }: { columns: string[]; rows: (string | number)[][] }) {
  if (rows.length === 0) return <EmptyState label="data" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            {columns.map(c => <th key={c} className="px-4 py-2.5 font-medium">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
              {r.map((cell, j) => <td key={j} className="px-4 py-2.5">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReportsView() {
  const [tab, setTab] = React.useState<TabId>("sales-daily");
  const [from, setFrom] = React.useState(daysAgoIso(30));
  const [to, setTo] = React.useState(todayIso());
  const currency = useCurrency();
  const range = { from, to };

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" /> Reports
        </h1>
        <p className="text-sm text-muted-foreground">Sales, kitchen, table, tax, and shift reconciliation reports.</p>
      </div>

      <div className="flex gap-2 border-b border-border pb-2 overflow-x-auto scrollbar-none">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap",
              tab === t.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/30")}>
            {t.label}
          </button>
        ))}
      </div>

      {tab !== "z-x-report" && (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-muted-foreground">From</label>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} max={to} className="h-9 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">To</label>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} min={from} max={todayIso()} className="h-9 text-sm" />
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {tab === "sales-daily" && <SalesDailyTab range={range} currency={currency} />}
        {tab === "sales-category" && <SalesByCategoryTab range={range} currency={currency} />}
        {tab === "sales-employee" && <SalesByEmployeeTab range={range} currency={currency} />}
        {tab === "voids-discounts" && <VoidsDiscountsTab range={range} currency={currency} />}
        {tab === "kitchen-prep" && <KitchenPrepTab range={range} />}
        {tab === "table-turnover" && <TableTurnoverTab range={range} />}
        {tab === "tax-summary" && <TaxSummaryTab range={range} currency={currency} />}
        {tab === "z-x-report" && <SessionReportTab currency={currency} />}
      </div>
    </div>
  );
}

function Loading() {
  return <div className="flex items-center justify-center h-40 text-muted-foreground"><Loader2 className="animate-spin mr-2 h-5 w-5" /> Loading…</div>;
}

function SalesDailyTab({ range, currency }: { range: { from: string; to: string }; currency: string }) {
  const { data = [], isLoading } = useSalesDailyReport(range);
  if (isLoading) return <Loading />;
  const exportCsv = () => downloadFile(`sales_daily_${range.from}_${range.to}.csv`,
    toCsv(data.map(r => ({ Date: r.date, Orders: r.orderCount, Gross: r.grossSales, Discounts: r.discounts, Tax: r.tax, Net: r.netSales })),
      ["Date", "Orders", "Gross", "Discounts", "Tax", "Net"]));
  const exportPdfReport = () => exportPdf({
    title: "Sales — Daily", subtitle: `${range.from} to ${range.to}`,
    columns: ["Date", "Orders", "Gross", "Discounts", "Tax", "Net"],
    rows: data.map(r => [r.date, r.orderCount, formatCurrency(r.grossSales, currency), formatCurrency(r.discounts, currency), formatCurrency(r.tax, currency), formatCurrency(r.netSales, currency)]),
  });
  return (
    <div className="p-2">
      <div className="flex justify-end p-2"><ExportMenu onCsv={exportCsv} onPdf={exportPdfReport} disabled={data.length === 0} /></div>
      <ReportTable columns={["Date", "Orders", "Gross", "Discounts", "Tax", "Net"]}
        rows={data.map(r => [r.date, r.orderCount, formatCurrency(r.grossSales, currency), formatCurrency(r.discounts, currency), formatCurrency(r.tax, currency), formatCurrency(r.netSales, currency)])} />
    </div>
  );
}

function SalesByCategoryTab({ range, currency }: { range: { from: string; to: string }; currency: string }) {
  const { data = [], isLoading } = useSalesByCategoryReport(range);
  if (isLoading) return <Loading />;
  const exportCsv = () => downloadFile(`sales_by_category_${range.from}_${range.to}.csv`,
    toCsv(data.map(r => ({ Category: r.categoryName, Qty: r.qty, Revenue: r.revenue })), ["Category", "Qty", "Revenue"]));
  const exportPdfReport = () => exportPdf({
    title: "Sales — By Category", subtitle: `${range.from} to ${range.to}`,
    columns: ["Category", "Qty", "Revenue"], rows: data.map(r => [r.categoryName, r.qty, formatCurrency(r.revenue, currency)]),
  });
  return (
    <div className="p-2">
      <div className="flex justify-end p-2"><ExportMenu onCsv={exportCsv} onPdf={exportPdfReport} disabled={data.length === 0} /></div>
      <ReportTable columns={["Category", "Qty Sold", "Revenue"]} rows={data.map(r => [r.categoryName, r.qty, formatCurrency(r.revenue, currency)])} />
    </div>
  );
}

function SalesByEmployeeTab({ range, currency }: { range: { from: string; to: string }; currency: string }) {
  const { data = [], isLoading } = useSalesByEmployeeReport(range);
  if (isLoading) return <Loading />;
  const exportCsv = () => downloadFile(`sales_by_employee_${range.from}_${range.to}.csv`,
    toCsv(data.map(r => ({ Waiter: r.waiter, Orders: r.orderCount, Revenue: r.revenue, Tips: r.tipTotal })), ["Waiter", "Orders", "Revenue", "Tips"]));
  const exportPdfReport = () => exportPdf({
    title: "Sales — By Employee", subtitle: `${range.from} to ${range.to}`,
    columns: ["Waiter", "Orders", "Revenue", "Tips"],
    rows: data.map(r => [r.waiter, r.orderCount, formatCurrency(r.revenue, currency), formatCurrency(r.tipTotal, currency)]),
  });
  return (
    <div className="p-2">
      <div className="flex justify-end p-2"><ExportMenu onCsv={exportCsv} onPdf={exportPdfReport} disabled={data.length === 0} /></div>
      <ReportTable columns={["Waiter", "Orders", "Revenue", "Tips"]}
        rows={data.map(r => [r.waiter, r.orderCount, formatCurrency(r.revenue, currency), formatCurrency(r.tipTotal, currency)])} />
    </div>
  );
}

function VoidsDiscountsTab({ range, currency }: { range: { from: string; to: string }; currency: string }) {
  const { data = [], isLoading } = useVoidsDiscountsReport(range);
  const { data: usersPage } = useUsers({ pageSize: 500 });
  const userName = React.useCallback(
    (id: string) => usersPage?.items.find(u => u.id === id)?.fullName ?? id.slice(0, 8),
    [usersPage],
  );
  if (isLoading) return <Loading />;
  const exportCsv = () => downloadFile(`voids_discounts_${range.from}_${range.to}.csv`,
    toCsv(data.map(r => ({ User: userName(r.userId), Voids: r.voidCount, "Void Value": r.voidValue, Discounts: r.discountCount, "Discount Value": r.discountValue })),
      ["User", "Voids", "Void Value", "Discounts", "Discount Value"]));
  const exportPdfReport = () => exportPdf({
    title: "Voids & Discounts — Fraud Signal", subtitle: `${range.from} to ${range.to}`,
    columns: ["User", "Voids", "Void Value", "Discounts", "Discount Value"],
    rows: data.map(r => [userName(r.userId), r.voidCount, formatCurrency(r.voidValue, currency), r.discountCount, formatCurrency(r.discountValue, currency)]),
  });
  return (
    <div className="p-2">
      <div className="flex justify-end p-2"><ExportMenu onCsv={exportCsv} onPdf={exportPdfReport} disabled={data.length === 0} /></div>
      <ReportTable columns={["User", "Voids", "Void Value", "Discounts", "Discount Value"]}
        rows={data.map(r => [userName(r.userId), r.voidCount, formatCurrency(r.voidValue, currency), r.discountCount, formatCurrency(r.discountValue, currency)])} />
    </div>
  );
}

function KitchenPrepTab({ range }: { range: { from: string; to: string } }) {
  const { data = [], isLoading } = useKitchenPrepTimesReport(range);
  if (isLoading) return <Loading />;
  const exportCsv = () => downloadFile(`kitchen_prep_times_${range.from}_${range.to}.csv`,
    toCsv(data.map(r => ({ Item: r.menuItemName, Orders: r.ordersCount, "Avg (min)": r.avgPrepMinutes, "P90 (min)": r.p90PrepMinutes })),
      ["Item", "Orders", "Avg (min)", "P90 (min)"]));
  const exportPdfReport = () => exportPdf({
    title: "Kitchen Prep Times", subtitle: `${range.from} to ${range.to}`,
    columns: ["Item", "Orders", "Avg (min)", "P90 (min)"],
    rows: data.map(r => [r.menuItemName, r.ordersCount, r.avgPrepMinutes, r.p90PrepMinutes]),
  });
  return (
    <div className="p-2">
      <div className="flex justify-end p-2"><ExportMenu onCsv={exportCsv} onPdf={exportPdfReport} disabled={data.length === 0} /></div>
      {data.length === 0 && <p className="text-center text-xs text-muted-foreground pb-4">No kitchen timing data yet — items only appear once served through a flow that stamps a ready time.</p>}
      <ReportTable columns={["Item", "Orders", "Avg (min)", "P90 (min)"]} rows={data.map(r => [r.menuItemName, r.ordersCount, r.avgPrepMinutes, r.p90PrepMinutes])} />
    </div>
  );
}

function TableTurnoverTab({ range }: { range: { from: string; to: string } }) {
  const { data = [], isLoading } = useTableTurnoverReport(range);
  if (isLoading) return <Loading />;
  const exportCsv = () => downloadFile(`table_turnover_${range.from}_${range.to}.csv`,
    toCsv(data.map(r => ({ Table: r.tableNumber, Turns: r.turnCount, "Avg Occupied (min)": r.avgOccupiedMinutes })),
      ["Table", "Turns", "Avg Occupied (min)"]));
  const exportPdfReport = () => exportPdf({
    title: "Table Turnover", subtitle: `${range.from} to ${range.to}`,
    columns: ["Table", "Turns", "Avg Occupied (min)"], rows: data.map(r => [r.tableNumber, r.turnCount, r.avgOccupiedMinutes]),
  });
  return (
    <div className="p-2">
      <div className="flex justify-end p-2"><ExportMenu onCsv={exportCsv} onPdf={exportPdfReport} disabled={data.length === 0} /></div>
      <ReportTable columns={["Table", "Turns", "Avg Occupied (min)"]} rows={data.map(r => [r.tableNumber, r.turnCount, r.avgOccupiedMinutes])} />
    </div>
  );
}

function TaxSummaryTab({ range, currency }: { range: { from: string; to: string }; currency: string }) {
  const { data = [], isLoading } = useTaxSummaryReport(range);
  if (isLoading) return <Loading />;
  const exportCsv = () => downloadFile(`tax_summary_${range.from}_${range.to}.csv`,
    toCsv(data.map(r => ({ Date: r.date, Taxable: r.taxableAmount, Tax: r.taxCollected })), ["Date", "Taxable", "Tax"]));
  const exportPdfReport = () => exportPdf({
    title: "Tax Summary", subtitle: `${range.from} to ${range.to}`,
    columns: ["Date", "Taxable", "Tax"], rows: data.map(r => [r.date, formatCurrency(r.taxableAmount, currency), formatCurrency(r.taxCollected, currency)]),
  });
  return (
    <div className="p-2">
      <div className="flex justify-end p-2"><ExportMenu onCsv={exportCsv} onPdf={exportPdfReport} disabled={data.length === 0} /></div>
      <ReportTable columns={["Date", "Taxable Amount", "Tax Collected"]} rows={data.map(r => [r.date, formatCurrency(r.taxableAmount, currency), formatCurrency(r.taxCollected, currency)])} />
    </div>
  );
}

function SessionReportTab({ currency }: { currency: string }) {
  const { sessionId: activeSessionId } = useShift();
  const [sessionId, setSessionId] = React.useState(activeSessionId ?? "");
  const [mode, setMode] = React.useState<"x" | "z">("x");
  const xReport = useXReport(sessionId, mode === "x" && !!sessionId);
  const zReport = useZReport(sessionId, mode === "z" && !!sessionId);
  const report = mode === "x" ? xReport.data : zReport.data;
  const isLoading = mode === "x" ? xReport.isLoading : zReport.isLoading;

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[240px]">
          <label className="text-xs text-muted-foreground">Session ID</label>
          <Input value={sessionId} onChange={e => setSessionId(e.target.value)} placeholder="POS session id" className="h-9 text-sm font-mono" />
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" variant={mode === "x" ? "default" : "outline"} onClick={() => setMode("x")}>X-Report (open)</Button>
          <Button size="sm" variant={mode === "z" ? "default" : "outline"} onClick={() => setMode("z")}>Z-Report (close)</Button>
        </div>
      </div>

      {!sessionId && <p className="text-sm text-muted-foreground">Enter a POS session id to view its reconciliation report{activeSessionId ? " (your current shift's id is pre-filled)" : ""}.</p>}
      {sessionId && isLoading && <Loading />}
      {sessionId && !isLoading && report && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Status", value: report.sessionStatus },
              { label: "Orders", value: report.orderCount },
              { label: "Gross Sales", value: formatCurrency(report.grossSales, currency) },
              { label: "Net Sales", value: formatCurrency(report.netSales, currency) },
              { label: "Discounts", value: formatCurrency(report.discounts, currency) },
              { label: "Tax", value: formatCurrency(report.tax, currency) },
              { label: "Tips", value: formatCurrency(report.tips, currency) },
              { label: "Refunds", value: formatCurrency(report.refunds, currency) },
              { label: "Voids", value: `${report.voidCount} (${formatCurrency(report.voidValue, currency)})` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-semibold mt-0.5 capitalize">{value}</p>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Payment Method Breakdown</p>
            {Object.keys(report.paymentMethodBreakdown).length === 0
              ? <p className="text-sm text-muted-foreground">No payments recorded.</p>
              : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {Object.entries(report.paymentMethodBreakdown).map(([method, amount]) => (
                    <div key={method} className="bg-muted/30 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground capitalize">{method}</p>
                      <p className="font-semibold">{formatCurrency(amount, currency)}</p>
                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
}
