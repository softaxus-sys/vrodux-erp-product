import * as React from "react";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  LayoutDashboard, DollarSign, ShoppingCart, TrendingUp, AlertTriangle,
  Utensils, Clock, ChefHat, Wallet, Package, Ban,
} from "lucide-react";
import { cn, formatCurrency, fitTextClass } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useShift } from "@/modules/pos/retail/components/shift-gate";
import {
  useOwnerDashboard, useBranchDashboard, useKitchenDashboard, useCashierDashboard, useInventoryDashboard,
} from "@/hooks/restaurant/use-restaurant-reports";

/** Labels come from i18n (dashboards.tabs.*); only id + icon live here. */
const TABS = [
  { id: "owner", icon: LayoutDashboard },
  { id: "branch", icon: Utensils },
  { id: "kitchen", icon: ChefHat },
  { id: "cashier", icon: Wallet },
  { id: "inventory", icon: Package },
] as const;
type TabId = typeof TABS[number]["id"];

function StatCard({ icon: Icon, label, value, sub, tone }: {
  icon: React.ElementType; label: string; value: React.ReactNode; sub?: string; tone?: "default" | "warn";
}) {
  const isPlain = typeof value === "string" || typeof value === "number";
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-2 min-w-0">
      <div className={cn("flex items-center gap-2", tone === "warn" ? "text-destructive" : "text-muted-foreground")}>
        <Icon className="h-4 w-4 shrink-0" /><span className="text-xs font-medium truncate">{label}</span>
      </div>
      <p className={cn("font-bold text-foreground truncate", isPlain ? fitTextClass(value, "2xl") : "text-2xl")}
         title={isPlain ? String(value) : undefined}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
    </div>
  );
}

/** `message` is an already-translated full sentence (English built "No {label} yet", which doesn't translate). */
function EmptyChart({ message, height = 160 }: { message: string; height?: number }) {
  return (
    <div style={{ height }} className="flex items-center justify-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
      {message}
    </div>
  );
}

export function DashboardsView() {
  const { t } = useTranslation("restaurant");
  const [tab, setTab] = React.useState<TabId>("owner");

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5 text-primary" /> {t("dashboards.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("dashboards.description")}</p>
      </div>

      <div className="flex gap-2 border-b border-border pb-2 overflow-x-auto scrollbar-none">
        {TABS.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            className={cn("px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 whitespace-nowrap",
              tab === tb.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/30")}>
            <tb.icon className="w-3.5 h-3.5" /> {t(`dashboards.tabs.${tb.id}`)}
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
  const { t } = useTranslation("restaurant");
  const currency = useCurrency();
  const { data } = useOwnerDashboard();
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label={t("dashboards.owner.todaySales")} value={formatCurrency(data.todaySales, currency)} sub={t("dashboards.owner.net", { amount: formatCurrency(data.todayNetSales, currency) })} />
        <StatCard icon={ShoppingCart} label={t("dashboards.owner.todayOrders")} value={data.todayOrders} />
        <StatCard icon={TrendingUp} label={t("dashboards.owner.weekSales")} value={formatCurrency(data.weekSales, currency)} sub={t("dashboards.owner.net", { amount: formatCurrency(data.weekNetSales, currency) })} />
        <StatCard icon={AlertTriangle} label={t("dashboards.owner.weekVoid")} value={formatCurrency(data.weekVoidValue, currency)} tone={data.weekVoidValue > 0 ? "warn" : "default"} sub={t("dashboards.owner.discounts", { amount: formatCurrency(data.weekDiscounts, currency) })} />
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-sm font-semibold text-foreground mb-3">{t("dashboards.owner.topCategories")}</p>
        {data.topCategoriesWeek.length === 0 ? <EmptyChart message={t("dashboards.empty.categorySales")} /> : (
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
  const { t } = useTranslation("restaurant");
  const currency = useCurrency();
  const { data } = useBranchDashboard();
  if (!data) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard icon={DollarSign} label={t("dashboards.owner.todaySales")} value={formatCurrency(data.todaySales, currency)} sub={t("dashboards.owner.net", { amount: formatCurrency(data.todayNetSales, currency) })} />
      <StatCard icon={ShoppingCart} label={t("dashboards.owner.todayOrders")} value={data.todayOrders} />
      <StatCard icon={Utensils} label={t("dashboards.branch.activeOrders")} value={data.activeOrders} />
      <StatCard icon={Utensils} label={t("dashboards.branch.tables")} value={t("dashboards.branch.tablesFree", { count: data.tablesAvailable })}
        sub={t("dashboards.branch.tablesSub", { occupied: data.tablesOccupied, reserved: data.tablesReserved, cleaning: data.tablesCleaning })} />
    </div>
  );
}

function KitchenTab() {
  const { t } = useTranslation("restaurant");
  const { data } = useKitchenDashboard();
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={ChefHat} label={t("dashboards.kitchen.activeTickets")} value={data.activeTickets} />
        <StatCard icon={Clock} label={t("dashboards.kitchen.pendingItems")} value={data.pendingItems} />
        <StatCard icon={Clock} label={t("dashboards.kitchen.preparingItems")} value={data.preparingItems} />
        <StatCard icon={Clock} label={t("dashboards.kitchen.avgPrep")} value={data.avgPrepMinutesToday > 0 ? t("kitchen.minutes", { count: data.avgPrepMinutesToday }) : "—"} sub={t("dashboards.kitchen.readyNow", { count: data.readyItems })} />
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-sm font-semibold text-foreground mb-3">{t("dashboards.kitchen.slowestItems")}</p>
        {data.slowestItemsToday.length === 0 ? <EmptyChart message={t("dashboards.empty.prepTime")} /> : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.slowestItemsToday.map(i => ({ name: i.menuItemName, minutes: i.avgPrepMinutes }))}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => t("dashboards.kitchen.minutesShort", { count: v })} />
              <Bar dataKey="minutes" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function CashierTab() {
  const { t } = useTranslation("restaurant");
  const currency = useCurrency();
  const { sessionId } = useShift();
  const { data } = useCashierDashboard(sessionId);
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <StatCard icon={DollarSign} label={t("dashboards.cashier.mySales")} value={formatCurrency(data.todaySales, currency)} />
        <StatCard icon={ShoppingCart} label={t("dashboards.cashier.myOrders")} value={data.todayOrders} />
      </div>

      {data.currentSession ? (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">{t("dashboards.cashier.currentShift", { status: data.currentSession.sessionStatus })}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { key: "orders",     label: t("dashboards.cashier.orders"),     value: data.currentSession.orderCount },
              { key: "grossSales", label: t("dashboards.cashier.grossSales"), value: formatCurrency(data.currentSession.grossSales, currency) },
              { key: "netSales",   label: t("dashboards.cashier.netSales"),   value: formatCurrency(data.currentSession.netSales, currency) },
              { key: "tips",       label: t("dashboards.cashier.tips"),       value: formatCurrency(data.currentSession.tips, currency) },
            ].map(({ key, label, value }) => (
              <div key={key} className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-semibold mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("dashboards.cashier.noShift")}</p>
      )}
    </div>
  );
}

function InventoryTab() {
  const { t } = useTranslation("restaurant");
  const { data } = useInventoryDashboard();
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <StatCard icon={AlertTriangle} label={t("dashboards.inventory.lowStock")} value={data.lowStockCount} tone={data.lowStockCount > 0 ? "warn" : "default"} />
        <StatCard icon={Ban} label={t("dashboards.inventory.eightySixed")} value={data.eightySixedCount} tone={data.eightySixedCount > 0 ? "warn" : "default"} />
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-sm font-semibold text-foreground mb-3">{t("dashboards.inventory.lowStockTitle")}</p>
        {data.lowStockItems.length === 0 ? <p className="text-sm text-muted-foreground">{t("dashboards.inventory.nothingLow")}</p> : (
          <div className="space-y-1.5">
            {data.lowStockItems.map(i => (
              <div key={i.productId} className="flex items-center justify-between text-sm border-b border-border/50 last:border-0 py-1.5">
                <span className="text-foreground">{i.productName}</span>
                <span className="text-destructive font-medium">{t("dashboards.inventory.reorderLevel", { qty: i.stockQuantity, level: i.reorderLevel })}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-sm font-semibold text-foreground mb-3">{t("dashboards.inventory.currentlyEightySixed")}</p>
        {data.eightySixedItemNames.length === 0 ? <p className="text-sm text-muted-foreground">{t("dashboards.inventory.allAvailable")}</p> : (
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
