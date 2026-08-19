import * as React from "react";
import { useTranslation } from "react-i18next";
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

/** Labels come from i18n (reports.tabs.*); ids double as the translation keys. */
const TABS = [
  "sales-daily", "sales-category", "sales-employee", "voids-discounts",
  "kitchen-prep", "table-turnover", "tax-summary", "z-x-report",
] as const;
type TabId = typeof TABS[number];

function EmptyState() {
  const { t } = useTranslation("restaurant");
  return <p className="text-center text-sm text-muted-foreground py-10">{t("reports.noData")}</p>;
}

function ReportTable({ columns, rows }: { columns: string[]; rows: (string | number)[][] }) {
  if (rows.length === 0) return <EmptyState />;
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
  const { t } = useTranslation("restaurant");
  const [tab, setTab] = React.useState<TabId>("sales-daily");
  const [from, setFrom] = React.useState(daysAgoIso(30));
  const [to, setTo] = React.useState(todayIso());
  const currency = useCurrency();
  const range = { from, to };

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" /> {t("reports.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("reports.description")}</p>
      </div>

      <div className="flex gap-2 border-b border-border pb-2 overflow-x-auto scrollbar-none">
        {TABS.map(tabKey => (
          <button key={tabKey} onClick={() => setTab(tabKey)}
            className={cn("px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap",
              tab === tabKey ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/30")}>
            {t(`reports.tabs.${tabKey}`)}
          </button>
        ))}
      </div>

      {tab !== "z-x-report" && (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-muted-foreground">{t("reports.from")}</label>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} max={to} className="h-9 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{t("reports.to")}</label>
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
  const { t } = useTranslation("restaurant");
  return <div className="flex items-center justify-center h-40 text-muted-foreground"><Loader2 className="animate-spin mr-2 h-5 w-5" /> {t("reports.loading")}</div>;
}

function SalesDailyTab({ range, currency }: { range: { from: string; to: string }; currency: string }) {
  const { t } = useTranslation("restaurant");
  const { data = [], isLoading } = useSalesDailyReport(range);
  if (isLoading) return <Loading />;
  const cols = [t("reports.col.date"), t("reports.col.orders"), t("reports.col.gross"), t("reports.col.discounts"), t("reports.col.tax"), t("reports.col.net")];
  const rows = data.map(r => [r.date, r.orderCount, formatCurrency(r.grossSales, currency), formatCurrency(r.discounts, currency), formatCurrency(r.tax, currency), formatCurrency(r.netSales, currency)]);
  // CSV headers stay English — it's a data-interchange format consumed by other tooling.
  const exportCsv = () => downloadFile(`sales_daily_${range.from}_${range.to}.csv`,
    toCsv(data.map(r => ({ Date: r.date, Orders: r.orderCount, Gross: r.grossSales, Discounts: r.discounts, Tax: r.tax, Net: r.netSales })),
      ["Date", "Orders", "Gross", "Discounts", "Tax", "Net"]));
  const exportPdfReport = () => exportPdf({
    title: t("reports.pdfTitle.salesDaily"), subtitle: t("reports.rangeSubtitle", { from: range.from, to: range.to }),
    columns: cols, rows,
  });
  return (
    <div className="p-2">
      <div className="flex justify-end p-2"><ExportMenu onCsv={exportCsv} onPdf={exportPdfReport} disabled={data.length === 0} /></div>
      <ReportTable columns={cols} rows={rows} />
    </div>
  );
}

function SalesByCategoryTab({ range, currency }: { range: { from: string; to: string }; currency: string }) {
  const { t } = useTranslation("restaurant");
  const { data = [], isLoading } = useSalesByCategoryReport(range);
  if (isLoading) return <Loading />;
  const rows = data.map(r => [r.categoryName, r.qty, formatCurrency(r.revenue, currency)]);
  const exportCsv = () => downloadFile(`sales_by_category_${range.from}_${range.to}.csv`,
    toCsv(data.map(r => ({ Category: r.categoryName, Qty: r.qty, Revenue: r.revenue })), ["Category", "Qty", "Revenue"]));
  const exportPdfReport = () => exportPdf({
    title: t("reports.pdfTitle.salesCategory"), subtitle: t("reports.rangeSubtitle", { from: range.from, to: range.to }),
    columns: [t("reports.col.category"), t("reports.col.qty"), t("reports.col.revenue")], rows,
  });
  return (
    <div className="p-2">
      <div className="flex justify-end p-2"><ExportMenu onCsv={exportCsv} onPdf={exportPdfReport} disabled={data.length === 0} /></div>
      <ReportTable columns={[t("reports.col.category"), t("reports.col.qtySold"), t("reports.col.revenue")]} rows={rows} />
    </div>
  );
}

function SalesByEmployeeTab({ range, currency }: { range: { from: string; to: string }; currency: string }) {
  const { t } = useTranslation("restaurant");
  const { data = [], isLoading } = useSalesByEmployeeReport(range);
  if (isLoading) return <Loading />;
  const cols = [t("reports.col.waiter"), t("reports.col.orders"), t("reports.col.revenue"), t("reports.col.tips")];
  const rows = data.map(r => [r.waiter, r.orderCount, formatCurrency(r.revenue, currency), formatCurrency(r.tipTotal, currency)]);
  const exportCsv = () => downloadFile(`sales_by_employee_${range.from}_${range.to}.csv`,
    toCsv(data.map(r => ({ Waiter: r.waiter, Orders: r.orderCount, Revenue: r.revenue, Tips: r.tipTotal })), ["Waiter", "Orders", "Revenue", "Tips"]));
  const exportPdfReport = () => exportPdf({
    title: t("reports.pdfTitle.salesEmployee"), subtitle: t("reports.rangeSubtitle", { from: range.from, to: range.to }),
    columns: cols, rows,
  });
  return (
    <div className="p-2">
      <div className="flex justify-end p-2"><ExportMenu onCsv={exportCsv} onPdf={exportPdfReport} disabled={data.length === 0} /></div>
      <ReportTable columns={cols} rows={rows} />
    </div>
  );
}

function VoidsDiscountsTab({ range, currency }: { range: { from: string; to: string }; currency: string }) {
  const { t } = useTranslation("restaurant");
  const { data = [], isLoading } = useVoidsDiscountsReport(range);
  const { data: usersPage } = useUsers({ pageSize: 500 });
  const userName = React.useCallback(
    (id: string) => usersPage?.items.find(u => u.id === id)?.fullName ?? id.slice(0, 8),
    [usersPage],
  );
  if (isLoading) return <Loading />;
  const cols = [t("reports.col.user"), t("reports.col.voids"), t("reports.col.voidValue"), t("reports.col.discounts"), t("reports.col.discountValue")];
  const rows = data.map(r => [userName(r.userId), r.voidCount, formatCurrency(r.voidValue, currency), r.discountCount, formatCurrency(r.discountValue, currency)]);
  const exportCsv = () => downloadFile(`voids_discounts_${range.from}_${range.to}.csv`,
    toCsv(data.map(r => ({ User: userName(r.userId), Voids: r.voidCount, "Void Value": r.voidValue, Discounts: r.discountCount, "Discount Value": r.discountValue })),
      ["User", "Voids", "Void Value", "Discounts", "Discount Value"]));
  const exportPdfReport = () => exportPdf({
    title: t("reports.pdfTitle.voidsDiscounts"), subtitle: t("reports.rangeSubtitle", { from: range.from, to: range.to }),
    columns: cols, rows,
  });
  return (
    <div className="p-2">
      <div className="flex justify-end p-2"><ExportMenu onCsv={exportCsv} onPdf={exportPdfReport} disabled={data.length === 0} /></div>
      <ReportTable columns={cols} rows={rows} />
    </div>
  );
}

function KitchenPrepTab({ range }: { range: { from: string; to: string } }) {
  const { t } = useTranslation("restaurant");
  const { data = [], isLoading } = useKitchenPrepTimesReport(range);
  if (isLoading) return <Loading />;
  const cols = [t("reports.col.item"), t("reports.col.orders"), t("reports.col.avgMin"), t("reports.col.p90Min")];
  const rows = data.map(r => [r.menuItemName, r.ordersCount, r.avgPrepMinutes, r.p90PrepMinutes]);
  const exportCsv = () => downloadFile(`kitchen_prep_times_${range.from}_${range.to}.csv`,
    toCsv(data.map(r => ({ Item: r.menuItemName, Orders: r.ordersCount, "Avg (min)": r.avgPrepMinutes, "P90 (min)": r.p90PrepMinutes })),
      ["Item", "Orders", "Avg (min)", "P90 (min)"]));
  const exportPdfReport = () => exportPdf({
    title: t("reports.pdfTitle.kitchenPrep"), subtitle: t("reports.rangeSubtitle", { from: range.from, to: range.to }),
    columns: cols, rows,
  });
  return (
    <div className="p-2">
      <div className="flex justify-end p-2"><ExportMenu onCsv={exportCsv} onPdf={exportPdfReport} disabled={data.length === 0} /></div>
      {data.length === 0 && <p className="text-center text-xs text-muted-foreground pb-4">{t("reports.kitchenPrepHint")}</p>}
      <ReportTable columns={cols} rows={rows} />
    </div>
  );
}

function TableTurnoverTab({ range }: { range: { from: string; to: string } }) {
  const { t } = useTranslation("restaurant");
  const { data = [], isLoading } = useTableTurnoverReport(range);
  if (isLoading) return <Loading />;
  const cols = [t("reports.col.table"), t("reports.col.turns"), t("reports.col.avgOccupiedMin")];
  const rows = data.map(r => [r.tableNumber, r.turnCount, r.avgOccupiedMinutes]);
  const exportCsv = () => downloadFile(`table_turnover_${range.from}_${range.to}.csv`,
    toCsv(data.map(r => ({ Table: r.tableNumber, Turns: r.turnCount, "Avg Occupied (min)": r.avgOccupiedMinutes })),
      ["Table", "Turns", "Avg Occupied (min)"]));
  const exportPdfReport = () => exportPdf({
    title: t("reports.pdfTitle.tableTurnover"), subtitle: t("reports.rangeSubtitle", { from: range.from, to: range.to }),
    columns: cols, rows,
  });
  return (
    <div className="p-2">
      <div className="flex justify-end p-2"><ExportMenu onCsv={exportCsv} onPdf={exportPdfReport} disabled={data.length === 0} /></div>
      <ReportTable columns={cols} rows={rows} />
    </div>
  );
}

function TaxSummaryTab({ range, currency }: { range: { from: string; to: string }; currency: string }) {
  const { t } = useTranslation("restaurant");
  const { data = [], isLoading } = useTaxSummaryReport(range);
  if (isLoading) return <Loading />;
  const rows = data.map(r => [r.date, formatCurrency(r.taxableAmount, currency), formatCurrency(r.taxCollected, currency)]);
  const exportCsv = () => downloadFile(`tax_summary_${range.from}_${range.to}.csv`,
    toCsv(data.map(r => ({ Date: r.date, Taxable: r.taxableAmount, Tax: r.taxCollected })), ["Date", "Taxable", "Tax"]));
  const exportPdfReport = () => exportPdf({
    title: t("reports.pdfTitle.taxSummary"), subtitle: t("reports.rangeSubtitle", { from: range.from, to: range.to }),
    columns: [t("reports.col.date"), t("reports.col.taxable"), t("reports.col.tax")], rows,
  });
  return (
    <div className="p-2">
      <div className="flex justify-end p-2"><ExportMenu onCsv={exportCsv} onPdf={exportPdfReport} disabled={data.length === 0} /></div>
      <ReportTable columns={[t("reports.col.date"), t("reports.col.taxableAmount"), t("reports.col.taxCollected")]} rows={rows} />
    </div>
  );
}

function SessionReportTab({ currency }: { currency: string }) {
  const { t } = useTranslation("restaurant");
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
          <label className="text-xs text-muted-foreground">{t("reports.session.sessionId")}</label>
          <Input value={sessionId} onChange={e => setSessionId(e.target.value)} placeholder={t("reports.session.sessionIdPlaceholder")} className="h-9 text-sm font-mono" />
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" variant={mode === "x" ? "default" : "outline"} onClick={() => setMode("x")}>{t("reports.session.xReport")}</Button>
          <Button size="sm" variant={mode === "z" ? "default" : "outline"} onClick={() => setMode("z")}>{t("reports.session.zReport")}</Button>
        </div>
      </div>

      {!sessionId && <p className="text-sm text-muted-foreground">{activeSessionId ? t("reports.session.enterIdPrefilled") : t("reports.session.enterId")}</p>}
      {sessionId && isLoading && <Loading />}
      {sessionId && !isLoading && report && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { key: "status",     label: t("reports.session.status"),     value: report.sessionStatus },
              { key: "orders",     label: t("reports.session.orders"),     value: report.orderCount },
              { key: "grossSales", label: t("reports.session.grossSales"), value: formatCurrency(report.grossSales, currency) },
              { key: "netSales",   label: t("reports.session.netSales"),   value: formatCurrency(report.netSales, currency) },
              { key: "discounts",  label: t("reports.session.discounts"),  value: formatCurrency(report.discounts, currency) },
              { key: "tax",        label: t("reports.session.tax"),        value: formatCurrency(report.tax, currency) },
              { key: "tips",       label: t("reports.session.tips"),       value: formatCurrency(report.tips, currency) },
              { key: "refunds",    label: t("reports.session.refunds"),    value: formatCurrency(report.refunds, currency) },
              { key: "voids",      label: t("reports.session.voids"),      value: t("reports.session.voidsValue", { count: report.voidCount, amount: formatCurrency(report.voidValue, currency) }) },
            ].map(({ key, label, value }) => (
              <div key={key} className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-semibold mt-0.5 capitalize">{value}</p>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t("reports.session.paymentBreakdown")}</p>
            {Object.keys(report.paymentMethodBreakdown).length === 0
              ? <p className="text-sm text-muted-foreground">{t("reports.session.noPayments")}</p>
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
