/**
 * Retail POS dashboard — takings for a date range against the previous period of equal length,
 * plus what is happening right now (open shifts, offline tills waiting to sync, low stock).
 *
 * Every figure comes from the server (tenant-scoped, aggregated in SQL). Nothing here is invented:
 * an empty range shows zeros and empty states, not sample data.
 */

import * as React from "react";
import { Link } from "react-router-dom";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, CloudUpload, LayoutDashboard, Loader2,
  Minus, Package, Receipt, RefreshCw, RotateCcw, ShoppingBag, TrendingUp, Users, Wallet, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/auth/can";
import { cn, fitTextClass, formatCurrency, parseApiDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useAuthStore } from "@/store/auth.store";
import { useUsers } from "@/hooks/identity/use-users";
import { useInventoryProducts } from "@/hooks/inventory/use-inventory-products";
import { usePosOverview } from "@/hooks/pos/use-pos-dashboard";
import type { PosKpisDto, PosOverviewDto } from "@/lib/pos/pos-dashboard.api";

// ─── Date ranges (computed on the local clock, never hardcoded) ─────────────

type Preset = "today" | "yesterday" | "7d" | "30d" | "month";

const PRESETS: { id: Preset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "month", label: "This month" },
];

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function rangeFor(preset: Preset): { from: string; to: string; compareLabel: string } {
  const now = new Date();
  const day = (offset: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  switch (preset) {
    case "today":     return { from: ymd(now), to: ymd(now), compareLabel: "vs yesterday" };
    case "yesterday": return { from: ymd(day(-1)), to: ymd(day(-1)), compareLabel: "vs the day before" };
    case "7d":        return { from: ymd(day(-6)), to: ymd(now), compareLabel: "vs previous 7 days" };
    case "30d":       return { from: ymd(day(-29)), to: ymd(now), compareLabel: "vs previous 30 days" };
    case "month":     return {
      from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: ymd(now),
      compareLabel: "vs the same number of days before",
    };
  }
}

const METHOD_LABELS: Record<string, string> = {
  Cash: "Cash", Card: "Card", DigitalWallet: "Digital wallet", StoreCredit: "Store credit",
  Cheque: "Cheque", Mixed: "Mixed", BankTransfer: "Bank transfer",
};
const methodLabel = (m: string) => METHOD_LABELS[m] ?? m.replace(/([a-z])([A-Z])/g, "$1 $2");

// ─── View ────────────────────────────────────────────────────────────────────

export function PosDashboardView() {
  return (
    <Can
      permission="pos.reports.view"
      fallback={
        <div className="p-10 text-center space-y-2">
          <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="font-semibold">You don't have access to the POS dashboard.</p>
          <p className="text-sm text-muted-foreground">It needs the POS reports permission. Ask an administrator to grant it.</p>
        </div>
      }
    >
      <Dashboard />
    </Can>
  );
}

function Dashboard() {
  const currency = useCurrency();
  const [preset, setPreset] = React.useState<Preset>("today");
  const range = React.useMemo(() => rangeFor(preset), [preset]);
  const { data, isLoading, isError, error, refetch, isFetching } = usePosOverview(range.from, range.to);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-primary" />POS Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">Retail takings, trends and what's happening at the tills.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/pos/retail"><ShoppingBag className="h-4 w-4 me-1.5" />Open POS</Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching} aria-label="Refresh">
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Filters: one row above everything they affect */}
      <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Date range">
        {PRESETS.map(p => (
          <button
            key={p.id}
            role="tab"
            aria-selected={preset === p.id}
            onClick={() => setPreset(p.id)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap border transition-colors",
              preset === p.id ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted/50",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />Loading POS figures…
        </div>
      ) : isError || !data ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-3">
          <p className="font-semibold">Couldn't load the POS dashboard.</p>
          <p className="text-sm text-muted-foreground">{(error as Error)?.message ?? "Unknown error"}</p>
          <Button size="sm" onClick={() => refetch()}>Try again</Button>
        </div>
      ) : (
        <Body data={data} currency={currency} compareLabel={range.compareLabel} />
      )}
    </div>
  );
}

function Body({ data, currency, compareLabel }: { data: PosOverviewDto; currency: string; compareLabel: string }) {
  const { hasModuleAccess, hasRawPermission } = useAuthStore();
  const showLowStock = hasModuleAccess("inventory") && hasRawPermission("inventory.stock.view");
  const c = data.current, p = data.previous;
  const money = (n: number) => formatCurrency(n, currency);

  return (
    <>
      {data.offlineModeEnabled && (
        <OfflineNotice tills={data.tillsWithUnsyncedWork} />
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={TrendingUp} label="Net sales" value={money(c.netSales)} current={c.netSales} previous={p.netSales} compareLabel={compareLabel} />
        <Kpi icon={Receipt} label="Transactions" value={c.transactions.toLocaleString()} current={c.transactions} previous={p.transactions} compareLabel={compareLabel} />
        <Kpi icon={ShoppingBag} label="Average basket" value={money(c.averageBasket)} current={c.averageBasket} previous={p.averageBasket} compareLabel={compareLabel} />
        <Kpi icon={Package} label="Items sold" value={c.itemsSold.toLocaleString()} current={c.itemsSold} previous={p.itemsSold} compareLabel={compareLabel} />
      </div>

      <SecondaryStats kpis={c} money={money} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" title={data.hourly ? "Sales by hour" : "Sales by day"}
          subtitle={data.hourly ? "Local time at the till" : "Completed sales, including ones refunded later"}>
          <TrendChart data={data} money={money} />
        </Card>
        <Card title="Payment mix" subtitle="Amount taken per method">
          <BarList
            empty="No payments in this range."
            rows={data.paymentMix.map(m => ({
              key: m.method, label: methodLabel(m.method), value: m.amount,
              display: money(m.amount), hint: `${m.count} payment${m.count === 1 ? "" : "s"}`,
            }))}
          />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Top products" subtitle="By revenue">
          <BarList
            empty="No products sold in this range."
            rows={data.topProducts.map(tp => ({
              key: tp.productId, label: tp.name, value: tp.revenue,
              display: money(tp.revenue), hint: `${tp.quantity.toLocaleString()} sold`,
            }))}
          />
        </Card>
        <CashiersCard data={data} money={money} />
      </div>

      <div className={cn("grid gap-4", showLowStock && "lg:grid-cols-2")}>
        <OpenShiftsCard data={data} money={money} />
        {showLowStock && <LowStockCard />}
      </div>
    </>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function Card({ title, subtitle, className, children, action }: {
  title: string; subtitle?: string; className?: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <section className={cn("bg-card border border-border rounded-xl p-4 space-y-3 min-w-0", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-semibold text-sm">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Kpi({ icon: Icon, label, value, current, previous, compareLabel }: {
  icon: React.ElementType; label: string; value: string; current: number; previous: number; compareLabel: string;
}) {
  // No baseline → no percentage. "+∞%" or "+100%" off a zero period is a number that means nothing.
  const change = previous === 0 ? null : ((current - previous) / Math.abs(previous)) * 100;
  const flat = change !== null && Math.abs(change) < 0.5;
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-1.5 min-w-0">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4 shrink-0" /><span className="text-xs font-medium truncate">{label}</span>
      </div>
      <p className={cn("font-bold truncate tabular-nums", fitTextClass(value, "2xl"))} title={value}>{value}</p>
      <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
        {change === null ? (
          <><Minus className="h-3 w-3" />No prior data {compareLabel.replace(/^vs /, "for ")}</>
        ) : flat ? (
          <><Minus className="h-3 w-3" />No change {compareLabel}</>
        ) : (
          <>
            {change > 0
              ? <ArrowUpRight className="h-3.5 w-3.5 text-success" aria-label="up" />
              : <ArrowDownRight className="h-3.5 w-3.5 text-destructive" aria-label="down" />}
            <span className="font-semibold text-foreground tabular-nums">{change > 0 ? "+" : ""}{change.toFixed(1)}%</span>
            <span className="truncate">{compareLabel}</span>
          </>
        )}
      </p>
    </div>
  );
}

function SecondaryStats({ kpis, money }: { kpis: PosKpisDto; money: (n: number) => string }) {
  const items = [
    { icon: Wallet, label: "Gross sales", value: money(kpis.grossSales) },
    { icon: RotateCcw, label: "Refunds", value: `${money(kpis.refunds)} · ${kpis.refundCount}` },
    { icon: XCircle, label: "Voids", value: `${money(kpis.voidedValue)} · ${kpis.voidCount}` },
    { icon: Receipt, label: "Discounts given", value: money(kpis.discounts) },
    { icon: Receipt, label: "Tax collected", value: money(kpis.tax) },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(i => (
        <div key={i.label} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs">
          <i.icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">{i.label}</span>
          <span className="font-semibold tabular-nums">{i.value}</span>
        </div>
      ))}
    </div>
  );
}

function TrendChart({ data, money }: { data: PosOverviewDto; money: (n: number) => string }) {
  const hasSales = data.trend.some(t => t.sales > 0);
  if (!hasSales) return <Empty message="No sales in this range yet." height={240} />;

  const tickLabel = (b: string) => {
    if (data.hourly) return b.slice(0, 2);
    const d = new Date(`${b}T00:00:00`);
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  };

  return (
    <div className="h-60" role="img" aria-label={data.hourly ? "Bar chart of sales by hour" : "Bar chart of sales by day"}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.trend} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="0" />
          <XAxis
            dataKey="bucket" tickFormatter={tickLabel} tickLine={false} axisLine={false}
            interval="preserveStartEnd" minTickGap={16}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          />
          <YAxis
            tickLine={false} axisLine={false} width={56}
            tickFormatter={(v: number) => new Intl.NumberFormat(undefined, { notation: "compact" }).format(v)}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const pt = payload[0].payload as PosOverviewDto["trend"][number];
              return (
                <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md space-y-0.5">
                  <p className="font-semibold">
                    {data.hourly ? `${pt.bucket}–${String((Number(pt.bucket.slice(0, 2)) + 1) % 24).padStart(2, "0")}:00`
                      : new Date(`${pt.bucket}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
                  </p>
                  <p>Sales <span className="font-semibold tabular-nums">{money(pt.sales)}</span></p>
                  <p>Transactions <span className="font-semibold tabular-nums">{pt.transactions}</span></p>
                  {pt.refunds > 0 && <p>Refunds <span className="font-semibold tabular-nums">{money(pt.refunds)}</span></p>}
                </div>
              );
            }}
          />
          <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface BarRow { key: string; label: string; value: number; display: string; hint?: string }

/** Ranked horizontal bars: one hue (magnitude), values in text ink, never a number drawn in the bar color. */
function BarList({ rows, empty }: { rows: BarRow[]; empty: string }) {
  if (!rows.length) return <Empty message={empty} />;
  const max = Math.max(...rows.map(r => r.value), 0);
  return (
    <ul className="space-y-2.5">
      {rows.map(r => (
        <li key={r.key} className="space-y-1" title={`${r.label}: ${r.display}${r.hint ? ` (${r.hint})` : ""}`}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate">{r.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">{r.display}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary" style={{ width: `${max > 0 ? Math.max(2, (r.value / max) * 100) : 0}%` }} />
            </div>
            {r.hint && <span className="w-24 shrink-0 text-end text-xs text-muted-foreground truncate">{r.hint}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}

function useUserNames() {
  const { data } = useUsers({ pageSize: 200 });
  return React.useMemo(() => {
    const map = new Map<string, string>();
    for (const u of data?.items ?? []) map.set(u.id, u.fullName || u.username || u.email);
    return map;
  }, [data]);
}

function CashiersCard({ data, money }: { data: PosOverviewDto; money: (n: number) => string }) {
  const names = useUserNames();
  return (
    <Card title="Cashiers" subtitle="By sales in this range">
      <BarList
        empty="No cashier sales in this range."
        rows={data.cashiers.map(c => ({
          key: c.cashierId, label: names.get(c.cashierId) ?? "Unknown user", value: c.sales,
          display: money(c.sales), hint: `${c.transactions} sale${c.transactions === 1 ? "" : "s"}`,
        }))}
      />
    </Card>
  );
}

function OpenShiftsCard({ data, money }: { data: PosOverviewDto; money: (n: number) => string }) {
  const names = useUserNames();
  return (
    <Card title="Open shifts" subtitle="Tills trading right now">
      {data.openShifts.length === 0 ? (
        <Empty message="No shifts are open." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border">
                <th className="text-start font-medium py-1.5">Register</th>
                <th className="text-start font-medium py-1.5">Cashier</th>
                <th className="text-start font-medium py-1.5">Opened</th>
                <th className="text-end font-medium py-1.5">Sales</th>
                <th className="text-end font-medium py-1.5">Net</th>
              </tr>
            </thead>
            <tbody>
              {data.openShifts.map(s => (
                <tr key={s.sessionId} className="border-b border-border/60 last:border-0">
                  <td className="py-2 font-medium">
                    {s.registerId}
                    {s.isOffline && <span className="ms-1.5 text-[10px] font-semibold uppercase rounded bg-warning/15 text-warning px-1.5 py-0.5">Offline</span>}
                  </td>
                  <td className="py-2 truncate max-w-[10rem]">{names.get(s.cashierId) ?? "Unknown user"}</td>
                  <td className="py-2 text-muted-foreground tabular-nums">
                    {parseApiDate(s.openedAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="py-2 text-end tabular-nums">{s.transactions}</td>
                  <td className="py-2 text-end font-semibold tabular-nums">{money(s.netSales)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function LowStockCard() {
  const { data, isLoading } = useInventoryProducts({ isLowStock: true, isActive: true, pageSize: 8 });
  const items = data?.items ?? [];
  return (
    <Card title="Low stock" subtitle="At or below reorder level"
      action={<Link to="/inventory/stock"className="text-xs text-primary hover:underline shrink-0">View all</Link>}>
      {isLoading ? (
        <Empty message="Loading…" />
      ) : items.length === 0 ? (
        <Empty message="Nothing is running low." />
      ) : (
        <ul className="divide-y divide-border/60">
          {items.map(p => (
            <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="truncate">{p.name}</span>
              <span className={cn("shrink-0 tabular-nums font-semibold", p.stockQuantity <= 0 ? "text-destructive" : "text-warning")}>
                {p.stockQuantity} left
                <span className="ms-1 font-normal text-muted-foreground">/ reorder {p.reorderLevel}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function OfflineNotice({ tills }: { tills: PosOverviewDto["tillsWithUnsyncedWork"] }) {
  if (tills.length === 0) {
    return (
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <CloudUpload className="h-3.5 w-3.5" />
        Offline mode is on — sales appear here once each till syncs. Every till is currently synced.
      </p>
    );
  }
  const records = tills.reduce((s, t) => s + t.pendingRecords, 0);
  return (
    <div className="rounded-xl border border-warning/40 bg-warning/5 p-3 text-sm space-y-1.5">
      <p className="font-semibold flex items-center gap-2">
        <CloudUpload className="h-4 w-4 text-warning" />
        {tills.length} till{tills.length === 1 ? "" : "s"} haven't synced — {records} record{records === 1 ? "" : "s"} not in these figures yet
      </p>
      <ul className="text-xs text-muted-foreground space-y-0.5">
        {tills.map(t => (
          <li key={t.deviceId} className="flex items-center gap-1.5">
            <Users className="h-3 w-3" />
            <span className="font-medium text-foreground">{t.registerId ?? "Unknown register"}</span>
            · {t.userName ?? "—"} · {t.pendingRecords} record(s) · last seen{" "}
            {parseApiDate(t.reportedAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Empty({ message, height = 120 }: { message: string; height?: number }) {
  return (
    <div style={{ height }} className="flex items-center justify-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
      {message}
    </div>
  );
}
