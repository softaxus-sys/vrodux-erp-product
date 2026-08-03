import * as React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  LayoutDashboard, DollarSign, ShoppingCart, TrendingUp, AlertTriangle,
  Utensils, Clock, ChefHat, Wallet, Package, Ban,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useShift } from "@/modules/pos/retail/components/shift-gate";
import {
  useOwnerDashboard, useBranchDashboard, useKitchenDashboard, useCashierDashboard, useInventoryDashboard,
} from "@/hooks/restaurant/use-restaurant-reports";

const TABS = [
  { id: "owner", label: "Owner", icon: LayoutDashboard },
  { id: "branch", label: "Branch", icon: Utensils },
  { id: "kitchen", label: "Kitchen", icon: ChefHat },
  { id: "cashier", label: "Cashier", icon: Wallet },
  { id: "inventory", label: "Inventory", icon: Package },
] as const;
type TabId = typeof TABS[number]["id"];

function StatCard({ icon: Icon, label, value, sub, tone }: {
  icon: React.ElementType; label: string; value: React.ReactNode; sub?: string; tone?: "default" | "warn";
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-2">
      <div className={cn("flex items-center gap-2", tone === "warn" ? "text-destructive" : "text-muted-foreground")}>
        <Icon className="h-4 w-4" /><span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function EmptyChart({ label, height = 160 }: { label: string; height?: number }) {
  return (
    <div style={{ height }} className="flex items-center justify-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
      No {label} yet
    </div>
  );
}

export function DashboardsView() {
  const [tab, setTab] = React.useState<TabId>("owner");

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5 text-primary" /> Dashboards
        </h1>
        <p className="text-sm text-muted-foreground">Role-scoped snapshots — Owner, Branch, Kitchen, Cashier, Inventory.</p>
      </div>

      <div className="flex gap-2 border-b border-border pb-2 overflow-x-auto scrollbar-none">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 whitespace-nowrap",
              tab === t.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/30")}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "owner" && <OwnerTab />}
      {tab === "branch" && <BranchTab />}
      {tab === "kitchen" && <KitchenTab />}
      {tab === "cashier" && <CashierTab />}
      {tab === "inventory" && <InventoryTab />}
    </div>
  );
}

function OwnerTab() {
  const currency = useCurrency();
  const { data } = useOwnerDashboard();
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="Today's Sales" value={formatCurrency(data.todaySales, currency)} sub={`Net ${formatCurrency(data.todayNetSales, currency)}`} />
        <StatCard icon={ShoppingCart} label="Today's Orders" value={data.todayOrders} />
        <StatCard icon={TrendingUp} label="7-Day Sales" value={formatCurrency(data.weekSales, currency)} sub={`Net ${formatCurrency(data.weekNetSales, currency)}`} />
        <StatCard icon={AlertTriangle} label="7-Day Void Value" value={formatCurrency(data.weekVoidValue, currency)} tone={data.weekVoidValue > 0 ? "warn" : "default"} sub={`Discounts ${formatCurrency(data.weekDiscounts, currency)}`} />
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-sm font-semibold text-foreground mb-3">Top Categories (7 days)</p>
        {data.topCategoriesWeek.length === 0 ? <EmptyChart label="category sales" /> : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.topCategoriesWeek.map(c => ({ name: c.categoryName, revenue: c.revenue }))}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatCurrency(v, currency)} />
              <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function BranchTab() {
  const currency = useCurrency();
  const { data } = useBranchDashboard();
  if (!data) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard icon={DollarSign} label="Today's Sales" value={formatCurrency(data.todaySales, currency)} sub={`Net ${formatCurrency(data.todayNetSales, currency)}`} />
      <StatCard icon={ShoppingCart} label="Today's Orders" value={data.todayOrders} />
      <StatCard icon={Utensils} label="Active Orders" value={data.activeOrders} />
      <StatCard icon={Utensils} label="Tables" value={`${data.tablesAvailable} free`}
        sub={`${data.tablesOccupied} occupied · ${data.tablesReserved} reserved · ${data.tablesCleaning} cleaning`} />
    </div>
  );
}

function KitchenTab() {
  const { data } = useKitchenDashboard();
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={ChefHat} label="Active Tickets" value={data.activeTickets} />
        <StatCard icon={Clock} label="Pending Items" value={data.pendingItems} />
        <StatCard icon={Clock} label="Preparing Items" value={data.preparingItems} />
        <StatCard icon={Clock} label="Avg Prep Today" value={data.avgPrepMinutesToday > 0 ? `${data.avgPrepMinutesToday}m` : "—"} sub={`${data.readyItems} ready now`} />
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-sm font-semibold text-foreground mb-3">Slowest Items Today</p>
        {data.slowestItemsToday.length === 0 ? <EmptyChart label="prep-time data" /> : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.slowestItemsToday.map(i => ({ name: i.menuItemName, minutes: i.avgPrepMinutes }))}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `${v} min`} />
              <Bar dataKey="minutes" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function CashierTab() {
  const currency = useCurrency();
  const { sessionId } = useShift();
  const { data } = useCashierDashboard(sessionId);
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <StatCard icon={DollarSign} label="My Sales Today" value={formatCurrency(data.todaySales, currency)} />
        <StatCard icon={ShoppingCart} label="My Orders Today" value={data.todayOrders} />
      </div>

      {data.currentSession ? (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">Current Shift ({data.currentSession.sessionStatus})</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Orders", value: data.currentSession.orderCount },
              { label: "Gross Sales", value: formatCurrency(data.currentSession.grossSales, currency) },
              { label: "Net Sales", value: formatCurrency(data.currentSession.netSales, currency) },
              { label: "Tips", value: formatCurrency(data.currentSession.tips, currency) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-semibold mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No active shift — open a shift to see live reconciliation here.</p>
      )}
    </div>
  );
}

function InventoryTab() {
  const { data } = useInventoryDashboard();
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <StatCard icon={AlertTriangle} label="Low Stock Ingredients" value={data.lowStockCount} tone={data.lowStockCount > 0 ? "warn" : "default"} />
        <StatCard icon={Ban} label="86'd Items" value={data.eightySixedCount} tone={data.eightySixedCount > 0 ? "warn" : "default"} />
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-sm font-semibold text-foreground mb-3">Low Stock (recipe-linked)</p>
        {data.lowStockItems.length === 0 ? <p className="text-sm text-muted-foreground">Nothing low on stock.</p> : (
          <div className="space-y-1.5">
            {data.lowStockItems.map(i => (
              <div key={i.productId} className="flex items-center justify-between text-sm border-b border-border/50 last:border-0 py-1.5">
                <span className="text-foreground">{i.productName}</span>
                <span className="text-destructive font-medium">{i.stockQuantity} / {i.reorderLevel} reorder level</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-sm font-semibold text-foreground mb-3">Currently 86'd</p>
        {data.eightySixedItemNames.length === 0 ? <p className="text-sm text-muted-foreground">Everything is available.</p> : (
          <div className="flex flex-wrap gap-1.5">
            {data.eightySixedItemNames.map(n => (
              <span key={n} className="px-2 py-1 rounded-full text-xs bg-destructive/10 text-destructive">{n}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
