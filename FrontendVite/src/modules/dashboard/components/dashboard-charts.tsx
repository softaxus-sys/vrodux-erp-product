import * as React from "react";
import { motion } from "framer-motion";
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
import { cn, formatCurrency } from "@/lib/utils";

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

// ─ Finance ─
const FINANCE_MONTHLY = MONTHS.map((m, i) => ({
  month:    m,
  revenue:  820_000 + Math.round(Math.sin(i * 0.7 + 1) * 120_000) + i * 14_000,
  expenses: 540_000 + Math.round(Math.cos(i * 0.5 + 1) * 80_000)  + i * 8_000,
  profit:   0,
})).map(d => ({ ...d, profit: d.revenue - d.expenses }));

const EXPENSE_CATS = [
  { name: "Payroll",     value: 45, amount: 2_025_000 },
  { name: "Operations",  value: 20, amount: 900_000   },
  { name: "Marketing",   value: 15, amount: 675_000   },
  { name: "IT & Tech",   value: 12, amount: 540_000   },
  { name: "Other",       value: 8,  amount: 360_000   },
];

// ─ HR ─
const DEPT_HEADCOUNT = [
  { dept: "Engineering", count: 28, target: 32 },
  { dept: "Sales",       count: 22, target: 25 },
  { dept: "Finance",     count: 14, target: 15 },
  { dept: "HR",          count: 10, target: 12 },
  { dept: "Operations",  count: 18, target: 20 },
  { dept: "Support",     count: 16, target: 18 },
];

const WEEKLY_ATT = [
  { day: "Mon", present: 92, absent: 6, late: 5  },
  { day: "Tue", present: 88, absent: 9, late: 7  },
  { day: "Wed", present: 95, absent: 4, late: 3  },
  { day: "Thu", present: 91, absent: 7, late: 6  },
  { day: "Fri", present: 86, absent: 11, late: 8 },
  { day: "Sat", present: 62, absent: 15, late: 4 },
];

const LEAVE_TYPES = [
  { name: "Annual",    value: 45 },
  { name: "Sick",      value: 28 },
  { name: "Maternity", value: 12 },
  { name: "Unpaid",    value: 8  },
  { name: "Other",     value: 7  },
];

// ─ Sales ─
const SALES_PIPELINE = MONTHS.map((m, i) => ({
  month:     m,
  leads:     120 + Math.round(Math.sin(i * 0.8 + 0.5) * 30) + i * 4,
  qualified: 70  + Math.round(Math.sin(i * 0.6 + 0.3) * 20) + i * 3,
  closed:    35  + Math.round(Math.sin(i * 0.4 + 0.2) * 15) + i * 2,
}));

const TOP_PRODUCTS = [
  { name: "Product Alpha",   revenue: 124_000 },
  { name: "Product Beta",    revenue: 98_000  },
  { name: "Product Gamma",   revenue: 87_000  },
  { name: "Product Delta",   revenue: 72_000  },
  { name: "Product Epsilon", revenue: 61_000  },
];

// ─ CRM ─
const LEAD_STAGES = [
  { name: "New",       value: 35 },
  { name: "Contacted", value: 25 },
  { name: "Qualified", value: 20 },
  { name: "Proposal",  value: 12 },
  { name: "Won",       value: 8  },
];

const CRM_MONTHLY = MONTHS.map((m, i) => ({
  month:      m,
  newLeads:   45 + Math.round(Math.sin(i * 0.9) * 12) + i,
  converted:  18 + Math.round(Math.sin(i * 0.7) * 6)  + i,
}));

// ─ Inventory ─
const STOCK_BY_CAT = [
  { category: "Electronics", inStock: 450, lowStock: 23, outOfStock: 5  },
  { category: "Furniture",   inStock: 180, lowStock: 12, outOfStock: 2  },
  { category: "Clothing",    inStock: 830, lowStock: 45, outOfStock: 8  },
  { category: "Food & Bev",  inStock: 620, lowStock: 34, outOfStock: 11 },
  { category: "Stationery",  inStock: 290, lowStock: 18, outOfStock: 3  },
];

const INVENTORY_VAL = [
  { name: "Electronics", value: 4_500_000 },
  { name: "Furniture",   value: 1_800_000 },
  { name: "Clothing",    value: 2_300_000 },
  { name: "Food & Bev",  value: 890_000   },
  { name: "Other",       value: 650_000   },
];

// ─ POS ─
const POS_HOURLY = [
  { hour: "08:00", sales: 3_200,  txn: 12 },
  { hour: "09:00", sales: 5_800,  txn: 21 },
  { hour: "10:00", sales: 7_400,  txn: 28 },
  { hour: "11:00", sales: 9_100,  txn: 34 },
  { hour: "12:00", sales: 12_300, txn: 46 },
  { hour: "13:00", sales: 11_200, txn: 42 },
  { hour: "14:00", sales: 8_600,  txn: 33 },
  { hour: "15:00", sales: 7_800,  txn: 30 },
  { hour: "16:00", sales: 9_400,  txn: 36 },
  { hour: "17:00", sales: 10_500, txn: 40 },
  { hour: "18:00", sales: 8_200,  txn: 31 },
  { hour: "19:00", sales: 5_600,  txn: 21 },
];

const PAYMENT_METHODS = [
  { name: "Card",       value: 42 },
  { name: "Cash",       value: 35 },
  { name: "Mobile Pay", value: 18 },
  { name: "Credit",     value: 5  },
];

// ─ Purchase ─
const PURCHASE_MONTHLY = MONTHS.map((m, i) => ({
  month: m,
  orders:  22 + Math.round(Math.sin(i * 0.6) * 6) + i,
  amount:  450_000 + Math.round(Math.cos(i * 0.4) * 80_000) + i * 10_000,
}));

const TOP_VENDORS = [
  { vendor: "Alpha Supplies",  amount: 850_000 },
  { vendor: "Beta Corp",       amount: 620_000 },
  { vendor: "Gamma Trading",   amount: 480_000 },
  { vendor: "Delta Imports",   amount: 320_000 },
  { vendor: "Epsilon Ltd",     amount: 210_000 },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, currency }: any) {
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
              ? formatCurrency(entry.value, "PKR")
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
  const totalRevenue  = FINANCE_MONTHLY.reduce((s, d) => s + d.revenue, 0);
  const totalExpenses = FINANCE_MONTHLY.reduce((s, d) => s + d.expenses, 0);
  const netProfit     = totalRevenue - totalExpenses;
  const margin        = Math.round((netProfit / totalRevenue) * 100);

  return (
    <ChartSection delay={0.05}>
      <SectionHeader
        icon={DollarSign}
        title="Finance Overview"
        color={P.blue}
        description={`YTD · Revenue ${fmt(totalRevenue)} · Net Profit ${margin}%`}
      />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Revenue vs Expenses — Area */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Revenue vs Expenses</CardTitle>
            <CardDescription className="text-xs">Monthly trend (PKR)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={FINANCE_MONTHLY} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
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
                <Area type="monotone" dataKey="revenue"  name="Revenue"  stroke={P.blue} fill="url(#gradRev)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="expenses" name="Expenses" stroke={P.red}  fill="url(#gradExp)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Expense breakdown — Donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Expense Breakdown</CardTitle>
            <CardDescription className="text-xs">By category (YTD)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie
                    data={EXPENSE_CATS}
                    cx="50%" cy="50%"
                    innerRadius={42} outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                    startAngle={90} endAngle={-270}
                  >
                    {EXPENSE_CATS.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <DonutLegend data={EXPENSE_CATS} colors={PIE_COLORS} />
          </CardContent>
        </Card>

      </div>

      {/* Net Profit trend */}
      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Net Profit Trend</CardTitle>
          <CardDescription className="text-xs">Monthly profit (revenue − expenses)</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={FINANCE_MONTHLY} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={42} />
              <Tooltip content={<ChartTooltip currency />} />
              <Bar dataKey="profit" name="Net Profit" radius={[4, 4, 0, 0]}>
                {FINANCE_MONTHLY.map((d, i) => (
                  <Cell key={i} fill={d.profit >= 0 ? P.green : P.red} />
                ))}
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
  return (
    <ChartSection delay={0.1}>
      <SectionHeader
        icon={Users}
        title="HR Overview"
        color={P.teal}
        description="Workforce, attendance & leave distribution"
      />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Department headcount — grouped bar */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Department Headcount</CardTitle>
            <CardDescription className="text-xs">Actual vs target headcount</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={DEPT_HEADCOUNT} layout="vertical" margin={{ top: 4, right: 8, left: 60, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis dataKey="dept" type="category" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={58} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="count"  name="Current" fill={P.teal}  radius={[0, 4, 4, 0]} barSize={10} />
                <Bar dataKey="target" name="Target"  fill={P.teal} fillOpacity={0.25} radius={[0, 4, 4, 0]} barSize={10} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Leave distribution — donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Leave Types</CardTitle>
            <CardDescription className="text-xs">Active leave distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie
                    data={LEAVE_TYPES}
                    cx="50%" cy="50%"
                    innerRadius={42} outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                    startAngle={90} endAngle={-270}
                  >
                    {LEAVE_TYPES.map((_, i) => (
                      <Cell key={i} fill={[P.teal, P.amber, P.pink, P.orange, P.violet][i % 5]} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <DonutLegend data={LEAVE_TYPES} colors={[P.teal, P.amber, P.pink, P.orange, P.violet]} />
          </CardContent>
        </Card>

      </div>

      {/* Weekly attendance stacked */}
      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Weekly Attendance</CardTitle>
          <CardDescription className="text-xs">Present / Absent / Late breakdown this week</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={WEEKLY_ATT} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="present" name="Present" stackId="a" fill={P.green}  radius={[0, 0, 0, 0]} />
              <Bar dataKey="absent"  name="Absent"  stackId="a" fill={P.red}    radius={[0, 0, 0, 0]} />
              <Bar dataKey="late"    name="Late"    stackId="a" fill={P.amber}  radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </ChartSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SALES CHARTS
// ─────────────────────────────────────────────────────────────────────────────

function SalesCharts() {
  return (
    <ChartSection delay={0.15}>
      <SectionHeader
        icon={ShoppingCart}
        title="Sales Overview"
        color={P.violet}
        description="Pipeline, top products & monthly trends"
      />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Sales pipeline — area */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Sales Pipeline</CardTitle>
            <CardDescription className="text-xs">Leads → Qualified → Closed</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={SALES_PIPELINE} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={P.violet} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={P.violet} stopOpacity={0}   />
                  </linearGradient>
                  <linearGradient id="gradQual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={P.blue}   stopOpacity={0.2} />
                    <stop offset="95%" stopColor={P.blue}   stopOpacity={0}   />
                  </linearGradient>
                  <linearGradient id="gradClosed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={P.green}  stopOpacity={0.25} />
                    <stop offset="95%" stopColor={P.green}  stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="leads"     name="Leads"     stroke={P.violet} fill="url(#gradLeads)"  strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="qualified" name="Qualified" stroke={P.blue}   fill="url(#gradQual)"   strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="closed"    name="Closed"   stroke={P.green}  fill="url(#gradClosed)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top products — horizontal bar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Top Products</CardTitle>
            <CardDescription className="text-xs">By revenue (PKR)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 mt-1">
              {TOP_PRODUCTS.map((p, i) => {
                const max = TOP_PRODUCTS[0].revenue;
                const pct = Math.round((p.revenue / max) * 100);
                return (
                  <div key={p.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground truncate max-w-[120px]">{p.name}</span>
                      <span className="font-semibold">{fmt(p.revenue)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, delay: i * 0.1, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
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
  return (
    <ChartSection delay={0.2}>
      <SectionHeader
        icon={TrendingUp}
        title="CRM Overview"
        color={P.pink}
        description="Lead pipeline & conversion trends"
      />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* CRM monthly area */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Lead Acquisition & Conversion</CardTitle>
            <CardDescription className="text-xs">Monthly new leads vs converted</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={CRM_MONTHLY} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
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
                <Area type="monotone" dataKey="newLeads"  name="New Leads" stroke={P.pink}  fill="url(#gradNewL)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="converted" name="Converted" stroke={P.green} fill="url(#gradConv)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Lead stage donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Lead Stage Distribution</CardTitle>
            <CardDescription className="text-xs">Current pipeline breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie
                    data={LEAD_STAGES}
                    cx="50%" cy="50%"
                    innerRadius={42} outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                    startAngle={90} endAngle={-270}
                  >
                    {LEAD_STAGES.map((_, i) => (
                      <Cell key={i} fill={[P.pink, P.violet, P.blue, P.amber, P.green][i % 5]} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <DonutLegend data={LEAD_STAGES} colors={[P.pink, P.violet, P.blue, P.amber, P.green]} />
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
  return (
    <ChartSection delay={0.25}>
      <SectionHeader
        icon={Package}
        title="Inventory Overview"
        color={P.orange}
        description="Stock levels, valuation & alerts"
      />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Stock by category */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Stock Levels by Category</CardTitle>
            <CardDescription className="text-xs">In stock · Low stock · Out of stock</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={STOCK_BY_CAT} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="category" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={32} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="inStock"    name="In Stock"     fill={P.green}  radius={[4, 4, 0, 0]} />
                <Bar dataKey="lowStock"   name="Low Stock"    fill={P.amber}  radius={[4, 4, 0, 0]} />
                <Bar dataKey="outOfStock" name="Out of Stock" fill={P.red}    radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Inventory valuation donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Inventory Valuation</CardTitle>
            <CardDescription className="text-xs">By category (PKR)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie
                    data={INVENTORY_VAL}
                    cx="50%" cy="50%"
                    innerRadius={42} outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                    startAngle={90} endAngle={-270}
                  >
                    {INVENTORY_VAL.map((_, i) => (
                      <Cell key={i} fill={[P.orange, P.blue, P.teal, P.green, P.violet][i % 5]} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip currency />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <DonutLegend
              data={INVENTORY_VAL.map(d => ({ name: d.name, value: d.value }))}
              colors={[P.orange, P.blue, P.teal, P.green, P.violet]}
              total={INVENTORY_VAL.reduce((s, d) => s + d.value, 0)}
            />
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
  const totalSales = POS_HOURLY.reduce((s, d) => s + d.sales, 0);
  const totalTxn   = POS_HOURLY.reduce((s, d) => s + d.txn, 0);

  return (
    <ChartSection delay={0.3}>
      <SectionHeader
        icon={CreditCard}
        title="POS Overview"
        color={P.sky}
        description={`Today · ${totalTxn} transactions · ${formatCurrency(totalSales, "PKR")} sales`}
      />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Hourly sales */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Hourly Sales (Today)</CardTitle>
            <CardDescription className="text-xs">Sales amount by hour</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={POS_HOURLY} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
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
                <Area type="monotone" dataKey="sales" name="Sales" stroke={P.sky} fill="url(#gradPos)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Payment methods donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Payment Methods</CardTitle>
            <CardDescription className="text-xs">Transaction split by method</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie
                    data={PAYMENT_METHODS}
                    cx="50%" cy="50%"
                    innerRadius={42} outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                    startAngle={90} endAngle={-270}
                  >
                    {PAYMENT_METHODS.map((_, i) => (
                      <Cell key={i} fill={[P.sky, P.green, P.violet, P.amber][i % 4]} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <DonutLegend data={PAYMENT_METHODS} colors={[P.sky, P.green, P.violet, P.amber]} />
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
  return (
    <ChartSection delay={0.35}>
      <SectionHeader
        icon={Truck}
        title="Purchase Overview"
        color={P.lime}
        description="Vendor spend & purchase order trends"
      />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Monthly purchase trend */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Monthly Purchase Orders</CardTitle>
            <CardDescription className="text-xs">Order count & total amount trend</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={PURCHASE_MONTHLY} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left"  tickFormatter={fmt} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={42} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip content={<ChartTooltip currency />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left"  dataKey="amount" name="Amount (PKR)" fill={P.lime}   fillOpacity={0.85} radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="orders" name="Orders"       fill={P.violet} fillOpacity={0.7}  radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top vendors */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Top Vendors</CardTitle>
            <CardDescription className="text-xs">By purchase amount (PKR)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 mt-1">
              {TOP_VENDORS.map((v, i) => {
                const max = TOP_VENDORS[0].amount;
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
                        style={{ background: [P.lime, P.green, P.teal, P.blue, P.violet][i % 5] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </ChartSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INDUSTRY CHARTS (Hospitality / Real-Estate / Construction)
// ─────────────────────────────────────────────────────────────────────────────

const ROOM_OCC = [
  { day: "Mon", occupied: 78, available: 22 },
  { day: "Tue", occupied: 82, available: 18 },
  { day: "Wed", occupied: 91, available: 9  },
  { day: "Thu", occupied: 87, available: 13 },
  { day: "Fri", occupied: 96, available: 4  },
  { day: "Sat", occupied: 99, available: 1  },
  { day: "Sun", occupied: 94, available: 6  },
];

const BOOKING_TYPES = [
  { name: "Direct",   value: 40 },
  { name: "Online",   value: 35 },
  { name: "Agency",   value: 15 },
  { name: "Walk-in",  value: 10 },
];

function HospitalityCharts() {
  return (
    <ChartSection delay={0.4}>
      <SectionHeader
        icon={Building2}
        title="Hospitality Overview"
        color={P.teal}
        description="Room occupancy & booking channels"
      />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Room Occupancy (This Week)</CardTitle>
            <CardDescription className="text-xs">Occupied vs available rooms</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ROOM_OCC} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="occupied"  name="Occupied"  fill={P.teal}  radius={[0, 0, 0, 0]} stackId="a" />
                <Bar dataKey="available" name="Available" fill={P.teal} fillOpacity={0.2} radius={[4, 4, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Booking Channels</CardTitle>
            <CardDescription className="text-xs">Reservation source split</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={BOOKING_TYPES} cx="50%" cy="50%" innerRadius={42} outerRadius={65} paddingAngle={3} dataKey="value" startAngle={90} endAngle={-270}>
                    {BOOKING_TYPES.map((_, i) => <Cell key={i} fill={[P.teal, P.sky, P.violet, P.amber][i]} stroke="transparent" />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <DonutLegend data={BOOKING_TYPES} colors={[P.teal, P.sky, P.violet, P.amber]} />
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
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <BarChart2 className="h-12 w-12 text-muted-foreground/20 mb-4" />
      <p className="text-sm font-medium text-muted-foreground">No chart data available</p>
      <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">
        Charts appear when your role has access to Finance, HR, Sales, Inventory, POS, or other modules.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export function DashboardCharts() {
  const { hasModuleAccess, isRole, user } = useAuthStore();

  const isAdmin        = isRole(["super_admin", "tenant_admin"]);
  const isManager      = isRole(["manager"]) || isAdmin;
  const isHR           = isRole(["hr_manager"]) || isManager;
  const isAccountant   = isRole(["accountant"]) || isManager;
  const isSalesRep     = isRole(["sales_rep"]) || isManager;
  const isPurchase     = isRole(["purchase_officer"]) || isManager;
  const isWarehouse    = isRole(["warehouse_manager"]) || isManager;

  const showFinance     = isAccountant  || hasModuleAccess("finance");
  const showHR          = isHR          || hasModuleAccess("hr");
  const showSales       = isSalesRep    || hasModuleAccess("sales");
  const showCRM         = isSalesRep    || hasModuleAccess("crm");
  const showInventory   = isWarehouse   || hasModuleAccess("inventory");
  const showPOS         = hasModuleAccess("pos");
  const showPurchase    = isPurchase    || hasModuleAccess("purchase");
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
