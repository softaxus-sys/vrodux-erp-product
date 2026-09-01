import * as React from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, DollarSign, Users, ShoppingCart, Package,
  BarChart2, CreditCard, Building2, ShoppingBag, Truck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuthStore } from "@/store/auth.store";
import { useCurrency } from "@/hooks/use-currency";
import { useCrmDashboard } from "@/hooks/crm/use-crm";
import { useInvoices, useExpenses } from "@/hooks/finance/use-finance";
import type { InvoiceDto, ExpenseDto } from "@/lib/finance/finance.api";
import { useEmployees, useLeaveRequests, useAttendance } from "@/hooks/hr/use-hr";
import { useInventoryDashboard } from "@/hooks/inventory/use-inventory-products";
import { useSalesDashboard } from "@/hooks/sales/use-sales-orders";
import { usePurchaseDashboard } from "@/hooks/purchase/use-purchase-orders";
import { usePosDashboard } from "@/hooks/pos/use-transactions";
import { useRooms, useBookingsSummary } from "@/hooks/hospitality/use-hospitality";
import { formatCurrency } from "@/lib/utils";

// ── Palette ────────────────────────────────────────────────────────────────────

const P = {
  blue:    "#3b82f6",
  green:   "#22c55e",
  amber:   "#f59e0b",
  violet:  "#8b5cf6",
  teal:    "#14b8a6",
  pink:    "#ec4899",
  orange:  "#f97316",
  red:     "#ef4444",
  sky:     "#0ea5e9",
  lime:    "#84cc16",
};

const PIE_COLORS = [P.blue, P.green, P.amber, P.violet, P.teal, P.pink, P.orange];

// ── Mock Data ─────────────────────────────────────────────────────────────────

const MONTHS_ALL = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_IDX  = new Date().getMonth();
const MONTHS     = MONTHS_ALL.slice(0, MONTH_IDX + 1);

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

/** "checked_in" / "half-day" → "Checked In" / "Half Day" */
function titleCase(s: string) {
  return (s || "").replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

/** Empty-state placeholder so charts show "no records" instead of fabricated data. */
function EmptyChart({ label, height = 180 }: { label: string; height?: number }) {
  return (
    <div
      style={{ height }}
      className="flex items-center justify-center text-center text-xs text-muted-foreground"
    >
      {label}
    </div>
  );
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, currency }: any) {
  const currencyCode = useCurrency();
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-popover/95 backdrop-blur p-3 shadow-xl text-xs">
      {label && <p className="font-semibold text-foreground mb-2">{label}</p>}
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 mb-0.5">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-semibold text-foreground ml-auto pl-3">
            {currency
              ? formatCurrency(entry.value, currencyCode)
              : typeof entry.value === "number" && entry.value > 1000
                ? fmt(entry.value)
                : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Donut Legend ───────────────────────────────────────────────────────────────

function DonutLegend({ data, colors, total, suffix = "%" }: {
  data: { name: string; value: number }[];
  colors: string[];
  total?: number;
  suffix?: string;
}) {
  return (
    <div className="space-y-2 mt-2">
      {data.map((d, i) => {
        const pct = total ? Math.round((d.value / total) * 100) : d.value;
        return (
          <div key={d.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: colors[i % colors.length] }} />
            <span className="text-xs text-muted-foreground flex-1 truncate">{d.name}</span>
            <span className="text-xs font-semibold tabular-nums">{pct}{suffix}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Section Header ─────────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon, title, color, description,
}: { icon: React.ElementType; title: string; color: string; description?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div
        className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${color}18` }}
      >
        <Icon className="h-4.5 w-4.5" style={{ color }} />
      </div>
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
}

// ─── Animated section wrapper ─────────────────────────────────────────────────

function ChartSection({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      {children}
    </motion.section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FINANCE CHARTS
// ─────────────────────────────────────────────────────────────────────────────

function FinanceCharts() {
  const { t } = useTranslation("dashboard");
  const currency = useCurrency();
  const invoices = (useInvoices().data ?? []) as InvoiceDto[];
  const expenses = (useExpenses().data ?? []) as ExpenseDto[];

  // ── Real monthly revenue (billed) vs expenses (this year, up to current month) ──
  const financeMonthly = React.useMemo(() => {
    const year = new Date().getFullYear();
    const b = MONTHS.map((m) => ({ month: m, revenue: 0, expenses: 0, profit: 0 }));
    for (const inv of invoices) {
      const d = inv.invoiceDate ? new Date(inv.invoiceDate) : null;
      if (!d || isNaN(d.getTime()) || d.getFullYear() !== year || d.getMonth() > MONTH_IDX) continue;
      b[d.getMonth()].revenue += inv.total ?? 0;
    }
    for (const ex of expenses) {
      const d = ex.expenseDate ? new Date(ex.expenseDate) : null;
      if (!d || isNaN(d.getTime()) || d.getFullYear() !== year || d.getMonth() > MONTH_IDX) continue;
      b[d.getMonth()].expenses += ex.amount ?? 0;
    }
    return b.map((x) => ({ ...x, profit: x.revenue - x.expenses }));
  }, [invoices, expenses]);

  // ── Real expense breakdown by category (top 6, rest → Other) ──
  const expenseCats = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const ex of expenses) {
      const key = (ex.category?.trim() || "Uncategorised");
      map.set(key, (map.get(key) ?? 0) + (ex.amount ?? 0));
    }
    const sorted = [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b2) => b2.value - a.value);
    if (sorted.length <= 6) return sorted;
    const top = sorted.slice(0, 5);
    const other = sorted.slice(5).reduce((s, d) => s + d.value, 0);
    return [...top, { name: "Other", value: other }];
  }, [expenses]);

  const totalRevenue  = financeMonthly.reduce((s, d) => s + d.revenue, 0);
  const totalExpenses = financeMonthly.reduce((s, d) => s + d.expenses, 0);
  const netProfit     = totalRevenue - totalExpenses;
  const margin        = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;
  const hasExpenseCats = expenseCats.length > 0;

  return (
    <ChartSection delay={0.05}>
      <SectionHeader
        icon={DollarSign}
        title={t("charts.finance.title")}
        color={P.blue}
        description={t("charts.finance.desc", { revenue: fmt(totalRevenue), margin })}
      />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Revenue vs Expenses — Area */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{t("charts.finance.revVsExp")}</CardTitle>
            <CardDescription className="text-xs">{t("charts.finance.revVsExpDesc", { currency })}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={financeMonthly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={P.blue}  stopOpacity={0.25} />
                    <stop offset="95%" stopColor={P.blue}  stopOpacity={0}    />
                  </linearGradient>
                  <linearGradient id="gradExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={P.red}   stopOpacity={0.2}  />
                    <stop offset="95%" stopColor={P.red}   stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={42} />
                <Tooltip content={<ChartTooltip currency />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="revenue"  name={t("charts.series.revenue")}  stroke={P.blue} fill="url(#gradRev)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="expenses" name={t("charts.series.expenses")} stroke={P.red}  fill="url(#gradExp)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Expense breakdown — Donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{t("charts.finance.breakdown")}</CardTitle>
            <CardDescription className="text-xs">{t("charts.finance.breakdownDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {hasExpenseCats ? (
              <>
                <div className="flex justify-center">
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie
                        data={expenseCats}
                        cx="50%" cy="50%"
                        innerRadius={42} outerRadius={65}
                        paddingAngle={3}
                        dataKey="value"
                        startAngle={90} endAngle={-270}
                      >
                        {expenseCats.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="transparent" />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip currency />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <DonutLegend data={expenseCats} colors={PIE_COLORS} total={expenseCats.reduce((s, d) => s + d.value, 0)} />
              </>
            ) : (
              <div className="flex h-[180px] items-center justify-center text-center text-xs text-muted-foreground">
                {t("charts.finance.breakdownEmpty")}
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Net Profit trend */}
      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">{t("charts.finance.netProfit")}</CardTitle>
          <CardDescription className="text-xs">{t("charts.finance.netProfitDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={financeMonthly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={42} />
              <Tooltip content={<ChartTooltip currency />} />
              <Bar dataKey="profit" name={t("charts.series.netProfit")} radius={[4, 4, 0, 0]}>
                {financeMonthly.map((d, i) => {
                  const palette = [P.blue, P.green, P.violet, P.amber, P.teal];
                  return (
                    <Cell key={i} fill={d.profit >= 0 ? palette[i % palette.length] : P.red} />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </ChartSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HR CHARTS
// ─────────────────────────────────────────────────────────────────────────────

function HrCharts() {
  const { t } = useTranslation("dashboard");
  const { data: employees = [] } = useEmployees();
  const { data: leaves = [] }    = useLeaveRequests();
  const { data: attendance = [] } = useAttendance();

  // Real headcount grouped by department (top 8)
  const deptHeadcount = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const e of employees) {
      const key = e.department?.trim() || "Unassigned";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([dept, count]) => ({ dept, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [employees]);

  // Real leave-type distribution
  const leaveTypes = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const l of leaves) {
      const key = titleCase(l.leaveType || "other");
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [leaves]);

  // Real attendance for the current week (Mon–Sun)
  const weeklyAtt = React.useMemo(() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return { day, key: d.toISOString().slice(0, 10), present: 0, absent: 0, late: 0 };
    });
    const byKey = new Map(days.map((d) => [d.key, d]));
    for (const a of attendance) {
      const bucket = byKey.get((a.date ?? "").slice(0, 10));
      if (!bucket) continue;
      if (a.status === "late") bucket.late += 1;
      else if (a.status === "absent") bucket.absent += 1;
      else if (a.status === "present" || a.status === "remote" || a.status === "half_day") bucket.present += 1;
    }
    return days.map((d) => ({ day: d.day, present: d.present, absent: d.absent, late: d.late }));
  }, [attendance]);

  const leaveColors = [P.teal, P.amber, P.pink, P.orange, P.violet, P.blue, P.green];
  const hasDept   = deptHeadcount.length > 0;
  const hasLeaves = leaveTypes.length > 0;
  const hasAtt    = weeklyAtt.some((d) => d.present + d.absent + d.late > 0);

  return (
    <ChartSection delay={0.1}>
      <SectionHeader
        icon={Users}
        title={t("charts.hr.title")}
        color={P.teal}
        description={t("charts.hr.desc", { employees: employees.length, leaves: leaves.length })}
      />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Department headcount — bar */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{t("charts.hr.headcount")}</CardTitle>
            <CardDescription className="text-xs">{t("charts.hr.headcountDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {hasDept ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={deptHeadcount} layout="vertical" margin={{ top: 4, right: 8, left: 60, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="dept" type="category" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={58} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" name={t("charts.series.employees")} fill={P.teal} radius={[0, 4, 4, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label={t("charts.hr.headcountEmpty")} height={220} />
            )}
          </CardContent>
        </Card>

        {/* Leave distribution — donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{t("charts.hr.leaveTypes")}</CardTitle>
            <CardDescription className="text-xs">{t("charts.hr.leaveTypesDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {hasLeaves ? (
              <>
                <div className="flex justify-center">
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie
                        data={leaveTypes}
                        cx="50%" cy="50%"
                        innerRadius={42} outerRadius={65}
                        paddingAngle={3}
                        dataKey="value"
                        startAngle={90} endAngle={-270}
                      >
                        {leaveTypes.map((_, i) => (
                          <Cell key={i} fill={leaveColors[i % leaveColors.length]} stroke="transparent" />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <DonutLegend data={leaveTypes} colors={leaveColors} total={leaveTypes.reduce((s, d) => s + d.value, 0)} />
              </>
            ) : (
              <EmptyChart label={t("charts.hr.leaveTypesEmpty")} />
            )}
          </CardContent>
        </Card>

      </div>

      {/* Weekly attendance stacked */}
      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">{t("charts.hr.weekly")}</CardTitle>
          <CardDescription className="text-xs">{t("charts.hr.weeklyDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {hasAtt ? (
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={weeklyAtt} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="present" name={t("charts.series.present")} stackId="a" fill={P.green}  radius={[0, 0, 0, 0]} />
                <Bar dataKey="absent"  name={t("charts.series.absent")}  stackId="a" fill={P.red}    radius={[0, 0, 0, 0]} />
                <Bar dataKey="late"    name={t("charts.series.late")}    stackId="a" fill={P.amber}  radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label={t("charts.hr.weeklyEmpty")} height={150} />
          )}
        </CardContent>
      </Card>
    </ChartSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SALES CHARTS
// ─────────────────────────────────────────────────────────────────────────────

function SalesCharts() {
  const { t } = useTranslation("dashboard");
  const currency = useCurrency();
  // One aggregate call. This used to total a 500-row page of orders here, so past 500 orders
  // the chart described a subset with nothing on screen saying so.
  const { data } = useSalesDashboard();

  // The server returns only the months that have orders; the chart wants all twelve up to today.
  const monthly = React.useMemo(() => {
    const b = MONTHS.map((m) => ({ month: m, value: 0, orders: 0 }));
    for (const row of data?.monthly ?? []) {
      const i = row.month - 1;
      if (i < 0 || i > MONTH_IDX) continue;
      b[i].value = row.value;
      b[i].orders = row.orders;
    }
    return b;
  }, [data]);

  const statusDist = React.useMemo(
    () => (data?.byStatus ?? []).map((s) => ({ name: titleCase(s.status || "unknown"), value: s.count })),
    [data]);

  const orderCount = (data?.byStatus ?? []).reduce((n, s) => n + s.count, 0);

  const totalValue = monthly.reduce((s, d) => s + d.value, 0);
  const statusColors = [P.violet, P.blue, P.teal, P.green, P.amber, P.red, P.pink];
  const hasOrders = orderCount > 0;

  return (
    <ChartSection delay={0.15}>
      <SectionHeader
        icon={ShoppingCart}
        title={t("charts.sales.title")}
        color={P.violet}
        description={t("charts.sales.desc", { orders: orderCount, value: fmt(totalValue) })}
      />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Monthly sales — area */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{t("charts.sales.monthly")}</CardTitle>
            <CardDescription className="text-xs">{t("charts.sales.monthlyDesc", { currency })}</CardDescription>
          </CardHeader>
          <CardContent>
            {hasOrders ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={monthly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradSalesVal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={P.violet} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={P.violet} stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={42} />
                  <Tooltip content={<ChartTooltip currency />} />
                  <Area type="monotone" dataKey="value" name={t("charts.series.orderValue")} stroke={P.violet} fill="url(#gradSalesVal)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label={t("charts.sales.monthlyEmpty")} height={220} />
            )}
          </CardContent>
        </Card>

        {/* Order status — donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{t("charts.sales.status")}</CardTitle>
            <CardDescription className="text-xs">{t("charts.sales.statusDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {hasOrders ? (
              <>
                <div className="flex justify-center">
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie
                        data={statusDist}
                        cx="50%" cy="50%"
                        innerRadius={42} outerRadius={65}
                        paddingAngle={3}
                        dataKey="value"
                        startAngle={90} endAngle={-270}
                      >
                        {statusDist.map((_, i) => (
                          <Cell key={i} fill={statusColors[i % statusColors.length]} stroke="transparent" />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <DonutLegend data={statusDist} colors={statusColors} total={statusDist.reduce((s, d) => s + d.value, 0)} />
              </>
            ) : (
              <EmptyChart label={t("charts.sales.monthlyEmpty")} />
            )}
          </CardContent>
        </Card>
      </div>
    </ChartSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CRM CHARTS
// ─────────────────────────────────────────────────────────────────────────────

function CrmCharts() {
  const { t } = useTranslation("dashboard");
  // One aggregate call. This used to be useLeads() + useDeals() — every lead and every deal
  // downloaded on every dashboard load, purely to count them in the browser. On a tenant with
  // 6,019 leads that is the unpaginated query that was timing out, run for anyone who logged in.
  const { data: dash } = useCrmDashboard();

  // ── Monthly acquisition/conversion, counted server-side ──
  const crmMonthly = React.useMemo(() => {
    const byMonth = dash?.leadsByMonth ?? [];
    return MONTHS.map((m, idx) => {
      const row = byMonth.find(b => b.month === idx + 1);
      return { month: m, newLeads: row?.newLeads ?? 0, converted: row?.converted ?? 0 };
      // Months after the current one stay at zero rather than being dropped, so the axis keeps
      // its shape across the year instead of the chart resizing every month.
    }).slice(0, MONTH_IDX + 1);
  }, [dash]);

  // ── Lead-stage distribution, from the same aggregate ──
  const leadStages = React.useMemo(() => {
    const labels: Record<string, string> = {
      new: "New", contacted: "Contacted", qualified: "Qualified",
      converted: "Converted", lost: "Lost",
    };
    return (dash?.leadFunnel ?? [])
      .map(s => ({ name: labels[s.stage] ?? s.stage, value: s.count }))
      .filter(s => s.value > 0);
  }, [dash]);

  const totalPipeline = dash?.openPipelineValue ?? 0;
  const leadCount     = dash?.totalLeads ?? 0;
  const dealCount     = dash?.totalDeals ?? 0;
  const hasStages = leadStages.length > 0;

  return (
    <ChartSection delay={0.2}>
      <SectionHeader
        icon={TrendingUp}
        title={t("charts.crm.title")}
        color={P.pink}
        description={t("charts.crm.desc", { leads: leadCount, deals: dealCount, pipeline: fmt(totalPipeline) })}
      />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* CRM monthly area */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{t("charts.crm.acquisition")}</CardTitle>
            <CardDescription className="text-xs">{t("charts.crm.acquisitionDesc", { year: new Date().getFullYear() })}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={crmMonthly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradNewL" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={P.pink} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={P.pink} stopOpacity={0}   />
                  </linearGradient>
                  <linearGradient id="gradConv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={P.green} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={P.green} stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="newLeads"  name={t("charts.series.newLeads")} stroke={P.pink}  fill="url(#gradNewL)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="converted" name={t("charts.series.converted")} stroke={P.green} fill="url(#gradConv)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Lead stage donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{t("charts.crm.stages")}</CardTitle>
            <CardDescription className="text-xs">{t("charts.crm.stagesDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {hasStages ? (
              <>
                <div className="flex justify-center">
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie
                        data={leadStages}
                        cx="50%" cy="50%"
                        innerRadius={42} outerRadius={65}
                        paddingAngle={3}
                        dataKey="value"
                        startAngle={90} endAngle={-270}
                      >
                        {leadStages.map((_, i) => (
                          <Cell key={i} fill={[P.pink, P.violet, P.blue, P.green, P.red][i % 5]} stroke="transparent" />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <DonutLegend
                  data={leadStages}
                  colors={[P.pink, P.violet, P.blue, P.green, P.red]}
                  total={leadStages.reduce((s, d) => s + d.value, 0)}
                />
              </>
            ) : (
              <div className="flex h-[180px] items-center justify-center text-center text-xs text-muted-foreground">
                {t("charts.crm.stagesEmpty")}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ChartSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INVENTORY CHARTS
// ─────────────────────────────────────────────────────────────────────────────

function InventoryCharts() {
  const { t } = useTranslation("dashboard");
  const currency = useCurrency();
  // One aggregate call. This used to read a 1,000-row page of products and total them here —
  // both a large read and quietly wrong: a tenant with more than a thousand products got figures
  // for an arbitrary subset, with nothing on screen saying so.
  const { data } = useInventoryDashboard();
  const stockByCat = data?.stockByCategory ?? [];
  const valuation  = data?.valuation ?? [];
  const productCount = stockByCat.reduce((n, c) => n + c.inStock + c.lowStock + c.outOfStock, 0);

  const valColors = [P.orange, P.blue, P.teal, P.green, P.violet];
  const hasStock = stockByCat.length > 0;
  const hasVal   = valuation.length > 0;

  return (
    <ChartSection delay={0.25}>
      <SectionHeader
        icon={Package}
        title={t("charts.inventory.title")}
        color={P.orange}
        description={t("charts.inventory.desc", { count: productCount })}
      />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Stock by category */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{t("charts.inventory.stockLevels")}</CardTitle>
            <CardDescription className="text-xs">{t("charts.inventory.stockLevelsDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {hasStock ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stockByCat} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                  <XAxis dataKey="category" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="inStock"    name={t("charts.series.inStock")}     fill={P.green}  radius={[4, 4, 0, 0]} />
                  <Bar dataKey="lowStock"   name={t("charts.series.lowStock")}    fill={P.amber}  radius={[4, 4, 0, 0]} />
                  <Bar dataKey="outOfStock" name={t("charts.series.outOfStock")} fill={P.red}    radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label={t("charts.inventory.stockLevelsEmpty")} height={220} />
            )}
          </CardContent>
        </Card>

        {/* Inventory valuation donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{t("charts.inventory.valuation")}</CardTitle>
            <CardDescription className="text-xs">{t("charts.inventory.valuationDesc", { currency })}</CardDescription>
          </CardHeader>
          <CardContent>
            {hasVal ? (
              <>
                <div className="flex justify-center">
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie
                        data={valuation}
                        cx="50%" cy="50%"
                        innerRadius={42} outerRadius={65}
                        paddingAngle={3}
                        dataKey="value"
                        startAngle={90} endAngle={-270}
                      >
                        {valuation.map((_, i) => (
                          <Cell key={i} fill={valColors[i % valColors.length]} stroke="transparent" />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip currency />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <DonutLegend
                  data={valuation}
                  colors={valColors}
                  total={valuation.reduce((s, d) => s + d.value, 0)}
                />
              </>
            ) : (
              <EmptyChart label={t("charts.inventory.valuationEmpty")} />
            )}
          </CardContent>
        </Card>
      </div>
    </ChartSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// POS CHARTS
// ─────────────────────────────────────────────────────────────────────────────

function PosCharts() {
  const { t } = useTranslation("dashboard");
  const currency = useCurrency();
  // One aggregate call, scoped to today at the till. This used to filter a 500-row page of
  // transactions here — so past 500 the day's takings were computed from a subset.
  const { data } = usePosDashboard();

  const hourly = React.useMemo(
    () => (data?.hourly ?? []).map((h) => ({
      hour: `${String(h.hour).padStart(2, "0")}:00`,
      sales: h.sales,
      txn: h.transactions,
    })),
    [data]);

  const methods = React.useMemo(
    () => (data?.methods ?? []).map((m) => ({ name: titleCase(m.method || "Other"), value: m.count })),
    [data]);

  const totalSales = data?.totalSales ?? 0;
  const txnCount   = data?.totalTransactions ?? 0;

  const methodColors = [P.sky, P.green, P.violet, P.amber, P.pink, P.teal];
  const hasHourly = hourly.length > 0;
  const hasMethods = methods.length > 0;

  return (
    <ChartSection delay={0.3}>
      <SectionHeader
        icon={CreditCard}
        title={t("charts.pos.title")}
        color={P.sky}
        description={t("charts.pos.desc", { count: txnCount, sales: formatCurrency(totalSales, currency) })}
      />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Hourly sales */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{t("charts.pos.hourly")}</CardTitle>
            <CardDescription className="text-xs">{t("charts.pos.hourlyDesc", { currency })}</CardDescription>
          </CardHeader>
          <CardContent>
            {hasHourly ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={hourly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradPos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={P.sky} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={P.sky} stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={38} />
                  <Tooltip content={<ChartTooltip currency />} />
                  <Area type="monotone" dataKey="sales" name={t("charts.series.sales")} stroke={P.sky} fill="url(#gradPos)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label={t("charts.pos.hourlyEmpty")} height={220} />
            )}
          </CardContent>
        </Card>

        {/* Payment methods donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{t("charts.pos.methods")}</CardTitle>
            <CardDescription className="text-xs">{t("charts.pos.methodsDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {hasMethods ? (
              <>
                <div className="flex justify-center">
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie
                        data={methods}
                        cx="50%" cy="50%"
                        innerRadius={42} outerRadius={65}
                        paddingAngle={3}
                        dataKey="value"
                        startAngle={90} endAngle={-270}
                      >
                        {methods.map((_, i) => (
                          <Cell key={i} fill={methodColors[i % methodColors.length]} stroke="transparent" />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <DonutLegend data={methods} colors={methodColors} total={methods.reduce((s, d) => s + d.value, 0)} />
              </>
            ) : (
              <EmptyChart label={t("charts.pos.methodsEmpty")} />
            )}
          </CardContent>
        </Card>
      </div>
    </ChartSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PURCHASE CHARTS
// ─────────────────────────────────────────────────────────────────────────────

function PurchaseCharts() {
  const { t } = useTranslation("dashboard");
  const currency = useCurrency();
  // One aggregate call. This used to total a 500-row page of orders here, so past 500 orders
  // the monthly trend and vendor ranking described a subset.
  const { data } = usePurchaseDashboard();

  // The server returns only the months that have orders; the chart wants all twelve up to today.
  const monthly = React.useMemo(() => {
    const b = MONTHS.map((m) => ({ month: m, amount: 0, orders: 0 }));
    for (const row of data?.monthly ?? []) {
      const i = row.month - 1;
      if (i < 0 || i > MONTH_IDX) continue;
      b[i].amount = row.amount;
      b[i].orders = row.orders;
    }
    return b;
  }, [data]);

  const topVendors = data?.topVendors ?? [];
  const orderCount = (data?.monthly ?? []).reduce((n, m) => n + m.orders, 0);

  const hasOrders  = orderCount > 0;
  const hasVendors = topVendors.length > 0 && topVendors[0].amount > 0;
  const vendorColors = [P.lime, P.green, P.teal, P.blue, P.violet];

  return (
    <ChartSection delay={0.35}>
      <SectionHeader
        icon={Truck}
        title={t("charts.purchase.title")}
        color={P.lime}
        description={t("charts.purchase.desc", { count: orderCount })}
      />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Monthly purchase trend */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{t("charts.purchase.monthly")}</CardTitle>
            <CardDescription className="text-xs">{t("charts.purchase.monthlyDesc", { currency })}</CardDescription>
          </CardHeader>
          <CardContent>
            {hasOrders ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left"  tickFormatter={fmt} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={42} />
                  <YAxis yAxisId="right" orientation="right" allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip content={<ChartTooltip currency />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="left"  dataKey="amount" name={t("charts.series.amount", { currency })} fill={P.lime}   fillOpacity={0.85} radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="orders" name={t("charts.series.orders")}             fill={P.violet} fillOpacity={0.7}  radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label={t("charts.purchase.monthlyEmpty")} height={220} />
            )}
          </CardContent>
        </Card>

        {/* Top vendors */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{t("charts.purchase.topVendors")}</CardTitle>
            <CardDescription className="text-xs">{t("charts.purchase.topVendorsDesc", { currency })}</CardDescription>
          </CardHeader>
          <CardContent>
            {hasVendors ? (
              <div className="space-y-3 mt-1">
                {topVendors.map((v, i) => {
                  const max = topVendors[0].amount || 1;
                  const pct = Math.round((v.amount / max) * 100);
                  return (
                    <div key={v.vendor}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground truncate max-w-[120px]">{v.vendor}</span>
                        <span className="font-semibold">{fmt(v.amount)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, delay: i * 0.1, ease: "easeOut" }}
                          className="h-full rounded-full"
                          style={{ background: vendorColors[i % vendorColors.length] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyChart label={t("charts.purchase.topVendorsEmpty")} />
            )}
          </CardContent>
        </Card>
      </div>
    </ChartSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INDUSTRY CHARTS (Hospitality / Real-Estate / Construction)
// ─────────────────────────────────────────────────────────────────────────────

function HospitalityCharts() {
  const { t } = useTranslation("dashboard");
  const { data: rooms = [] }    = useRooms();
  // The summary endpoint already returns exactly these status counts, so the chart reads that
  // instead of downloading every booking to tally them here.
  const { data: bookingsSummary } = useBookingsSummary();

  // Real room-status distribution
  const roomStatus = React.useMemo(() => {
    const order = ["available", "occupied", "reserved", "cleaning", "maintenance"];
    const map = new Map<string, number>();
    for (const r of rooms) map.set(r.status, (map.get(r.status) ?? 0) + 1);
    return order.filter((s) => map.has(s)).map((s) => ({ status: titleCase(s), count: map.get(s)! }));
  }, [rooms]);

  // Real booking-status distribution, straight from the summary.
  const bookingStatus = React.useMemo(() => ([
    { name: titleCase("confirmed"),   value: bookingsSummary?.confirmed  ?? 0 },
    { name: titleCase("checked_in"),  value: bookingsSummary?.checkedIn  ?? 0 },
    { name: titleCase("checked_out"), value: bookingsSummary?.checkedOut ?? 0 },
    { name: titleCase("cancelled"),   value: bookingsSummary?.cancelled  ?? 0 },
  ].filter(x => x.value > 0).sort((a, b) => b.value - a.value)), [bookingsSummary]);

  const bookingColors = [P.teal, P.sky, P.violet, P.amber, P.red];
  const hasRooms    = roomStatus.length > 0;
  const hasBookings = bookingStatus.length > 0;

  return (
    <ChartSection delay={0.4}>
      <SectionHeader
        icon={Building2}
        title={t("charts.hospitality.title")}
        color={P.teal}
        description={t("charts.hospitality.desc", { rooms: rooms.length, bookings: bookingsSummary?.total ?? 0 })}
      />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{t("charts.hospitality.roomsByStatus")}</CardTitle>
            <CardDescription className="text-xs">{t("charts.hospitality.roomsByStatusDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {hasRooms ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={roomStatus} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                  <XAxis dataKey="status" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" name={t("charts.series.rooms")} fill={P.teal} radius={[4, 4, 0, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label={t("charts.hospitality.roomsEmpty")} height={220} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{t("charts.hospitality.bookingsByStatus")}</CardTitle>
            <CardDescription className="text-xs">{t("charts.hospitality.bookingsByStatusDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {hasBookings ? (
              <>
                <div className="flex justify-center">
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie data={bookingStatus} cx="50%" cy="50%" innerRadius={42} outerRadius={65} paddingAngle={3} dataKey="value" startAngle={90} endAngle={-270}>
                        {bookingStatus.map((_, i) => <Cell key={i} fill={bookingColors[i % bookingColors.length]} stroke="transparent" />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <DonutLegend data={bookingStatus} colors={bookingColors} total={bookingStatus.reduce((s, d) => s + d.value, 0)} />
              </>
            ) : (
              <EmptyChart label={t("charts.hospitality.bookingsEmpty")} />
            )}
          </CardContent>
        </Card>
      </div>
    </ChartSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE (no module access)
// ─────────────────────────────────────────────────────────────────────────────

function NoCharts() {
  const { t } = useTranslation("dashboard");
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <BarChart2 className="h-12 w-12 text-muted-foreground/20 mb-4" />
      <p className="text-sm font-medium text-muted-foreground">{t("charts.none.title")}</p>
      <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">
        {t("charts.none.desc")}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export function DashboardCharts() {
  const { hasModuleAccess } = useAuthStore();

  const showFinance     = hasModuleAccess("finance");
  const showHR          = hasModuleAccess("hr");
  const showSales       = hasModuleAccess("sales");
  const showCRM         = hasModuleAccess("crm");
  const showInventory   = hasModuleAccess("inventory");
  const showPOS         = hasModuleAccess("pos");
  const showPurchase    = hasModuleAccess("purchase");
  const showHospitality = hasModuleAccess("hospitality");

  const hasAnyChart = showFinance || showHR || showSales || showCRM ||
    showInventory || showPOS || showPurchase || showHospitality;

  if (!hasAnyChart) return <NoCharts />;

  return (
    <div className="space-y-8">
      {showFinance     && <FinanceCharts     />}
      {showHR          && <HrCharts          />}
      {showSales       && <SalesCharts       />}
      {showCRM         && <CrmCharts         />}
      {showInventory   && <InventoryCharts   />}
      {showPOS         && <PosCharts         />}
      {showPurchase    && <PurchaseCharts    />}
      {showHospitality && <HospitalityCharts />}
    </div>
  );
}
