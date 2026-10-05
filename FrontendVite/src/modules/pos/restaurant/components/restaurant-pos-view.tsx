import * as React from "react";
import { useTranslation } from "react-i18next";
import { Plus, Users, Loader2, Clock, LayoutGrid, ListOrdered, ShoppingBag, Bike, ChevronRight, UtensilsCrossed, BellRing } from "lucide-react";
import { Pager } from "@/components/ui/pager";
import { cn, formatCurrency, parseApiDate } from "@/lib/utils";
import { useTables, useOrders, useOrdersSummary } from "@/hooks/restaurant/use-restaurant";
import { useDeviceRegistration } from "@/hooks/restaurant/use-devices";
import { useRestaurantRealtime } from "@/hooks/restaurant/use-restaurant-realtime";
import { useCurrency } from "@/hooks/use-currency";
import { HardwareStatusBar } from "@/components/pos/hardware-status-bar";
import { Can } from "@/components/auth/can";
import type { RestaurantTable, RestaurantOrder, TableStatus } from "@/lib/restaurant/restaurant.api";
import { BranchSwitcher } from "./branch-switcher";
import { AddTableForm } from "./add-table-form";
import { NewDeliveryOrderModal } from "./order-dialogs";
import { OrderScreen, ORDER_STATUS_STYLE } from "./order-screen";

const ORDERS_PAGE_SIZE = 30;
/** The floor needs one live order per table, so this is bounded by floor size, not history. */
const OPEN_ORDERS_LIMIT = 200;

const STATUS_DOT: Record<TableStatus, string> = {
  available: "bg-success", occupied: "bg-primary", reserved: "bg-blue-500", cleaning: "bg-muted-foreground",
};
const TILE: Record<TableStatus, string> = {
  available: "border-success/40 bg-success/5 hover:border-success",
  occupied:  "border-primary bg-primary/10 hover:shadow-lg",
  reserved:  "border-blue-500/50 bg-blue-500/10 hover:border-blue-500",
  cleaning:  "border-border bg-muted/50 hover:border-muted-foreground",
};

type Screen = null | { kind: "table"; tableId: string } | { kind: "order"; orderId: string | null };

/** Re-renders once a minute so "seated 42 min" stays honest without a timer per tile. */
function useMinuteTick() {
  const [, tick] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => { const id = setInterval(tick, 60_000); return () => clearInterval(id); }, []);
}

function TableTile({ table, order, currency, onClick }: {
  table: RestaurantTable; order: RestaurantOrder | undefined; currency: string; onClick: () => void;
}) {
  const { t } = useTranslation("restaurant");
  const status: TableStatus = order ? "occupied" : table.status;
  const ready = order?.status === "ready";
  const since = table.occupiedSince ?? order?.createdAt;
  const mins = since ? Math.max(0, Math.floor((Date.now() - parseApiDate(since).getTime()) / 60_000)) : null;
  const elapsed = mins == null ? null
    : mins < 60 ? t("posView.floor.mins", { n: mins }) : t("posView.floor.hours", { h: Math.floor(mins / 60), m: mins % 60 });

  return (
    <button onClick={onClick}
      className={cn("relative min-h-[136px] p-4 rounded-2xl border-2 text-start flex flex-col transition-all active:scale-[0.97]",
        ready ? "border-success bg-success/15 shadow-lg shadow-success/20" : TILE[status] ?? TILE.cleaning)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-4xl font-black text-foreground leading-none">{table.tableNumber}</p>
        <span className="flex items-center gap-1 text-sm font-bold text-muted-foreground"><Users className="h-4 w-4" />{order ? order.covers : table.capacity}</span>
      </div>
      <div className="flex-1" />
      {order ? (
        <>
          <p className="text-xl font-black text-foreground tabular-nums truncate">{formatCurrency(order.total, currency)}</p>
          <div className="flex items-center justify-between gap-2 mt-1">
            <span className={cn("px-2 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1",
              ready ? "bg-success text-white animate-pulse" : ORDER_STATUS_STYLE[order.status])}>
              {ready && <BellRing className="h-3.5 w-3.5" />}
              {t(`orders.status.${order.status}`, { defaultValue: order.status })}
            </span>
            {elapsed && (
              <span className="flex items-center gap-1 text-sm font-bold text-muted-foreground tabular-nums"><Clock className="h-3.5 w-3.5" />{elapsed}</span>
            )}
          </div>
        </>
      ) : (
        <p className="flex items-center gap-2 text-base font-extrabold text-foreground">
          <span className={cn("h-2.5 w-2.5 rounded-full", STATUS_DOT[status] ?? STATUS_DOT.cleaning)} />
          {t(`posView.tableStatus.${status}`, { defaultValue: status })}
        </p>
      )}
    </button>
  );
}

export function RestaurantPOSView() {
  const { t } = useTranslation("restaurant");
  useRestaurantRealtime();
  useDeviceRegistration();
  useMinuteTick();
  const currency = useCurrency();

  const [screen, setScreen] = React.useState<Screen>(null);
  /** Covers the moment between an order being created and the next refresh carrying it. */
  const [justCreated, setJustCreated] = React.useState<RestaurantOrder | null>(null);
  const [tab, setTab] = React.useState<"floor" | "orders">("floor");
  const [section, setSection] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState<"all" | TableStatus>("all");
  const [showAddTable, setShowAddTable] = React.useState(false);
  const [showDelivery, setShowDelivery] = React.useState(false);

  const { data: tables = [], isLoading: tablesLoading } = useTables();
  // The floor only wants what is live right now; history is a separate, paged query.
  const { data: openPage } = useOrders({ status: "open", pageSize: OPEN_ORDERS_LIMIT });
  const openOrders = React.useMemo(() => openPage?.items ?? [], [openPage]);
  const [orderPage, setOrderPage] = React.useState(1);
  const { data: historyPage, isFetching: historyFetching } = useOrders({ page: orderPage, pageSize: ORDERS_PAGE_SIZE });
  const history = historyPage?.items ?? [];
  const { data: summary } = useOrdersSummary();

  const orderByTable = React.useMemo(() => {
    const m = new Map<string, RestaurantOrder>();
    for (const o of openOrders) {
      if (o.parentOrderId || !o.tableId) continue; // parts of a split bill share the parent's table
      m.set(o.tableId, o);
    }
    return m;
  }, [openOrders]);
  const counterOrders = React.useMemo(
    () => openOrders.filter(o => !o.parentOrderId && o.orderType !== "dine_in"), [openOrders]);

  const liveStatus = (tb: RestaurantTable): TableStatus => orderByTable.has(tb.id) ? "occupied" : tb.status;
  const counts = React.useMemo(() => {
    const c: Record<string, number> = { available: 0, occupied: 0, reserved: 0, cleaning: 0 };
    for (const tb of tables) { const s = orderByTable.has(tb.id) ? "occupied" : tb.status; c[s] = (c[s] ?? 0) + 1; }
    return c;
  }, [tables, orderByTable]);
  const sections = React.useMemo(() => [...new Set(tables.map(tb => tb.section))].sort(), [tables]);
  const sectionName = (s: string) => t(`posView.section.${s}`, { defaultValue: s.charAt(0).toUpperCase() + s.slice(1) });
  const shownTables = tables.filter(tb =>
    (section === "all" || tb.section === section) && (statusFilter === "all" || liveStatus(tb) === statusFilter));

  const close = () => { setScreen(null); setJustCreated(null); };
  const findOrder = (id: string) =>
    openOrders.find(o => o.id === id) ?? history.find(o => o.id === id) ?? (justCreated?.id === id ? justCreated : null);

  // ── Order-taking takes the whole screen ──────────────────────────────────
  if (screen) {
    let table: RestaurantTable | null = null;
    let order: RestaurantOrder | null = null;
    if (screen.kind === "table") {
      table = tables.find(tb => tb.id === screen.tableId) ?? null;
      order = orderByTable.get(screen.tableId) ?? (justCreated?.tableId === screen.tableId ? justCreated : null);
    } else if (screen.orderId) {
      order = findOrder(screen.orderId);
      const tableId = order?.tableId;
      table = tableId ? tables.find(tb => tb.id === tableId) ?? null : null;
    }
    return (
      <OrderScreen
        key={screen.kind === "table" ? screen.tableId : "counter"}
        table={table} order={order} tables={tables} allOrders={openOrders} currency={currency}
        onBack={close}
        onOrderCreated={created => {
          setJustCreated(created);
          if (screen.kind === "order") setScreen({ kind: "order", orderId: created.id });
        }}
      />
    );
  }

  const chip = (active: boolean) => cn(
    "h-12 px-4 rounded-xl border-2 text-base font-bold whitespace-nowrap flex items-center gap-2 transition-colors",
    active ? "bg-foreground border-foreground text-background" : "bg-card border-border text-foreground hover:border-primary");
  const headBtn = "h-12 px-5 rounded-xl text-base font-extrabold flex items-center gap-2 whitespace-nowrap transition-colors";
  const tabs = [
    { id: "floor" as const, icon: LayoutGrid, label: t("posView.floor.tables") },
    { id: "orders" as const, icon: ListOrdered, label: t("posView.ordersTab") },
  ];

  return (
    <div className="flex flex-col h-full bg-muted/20 touch-manipulation">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b-2 border-border bg-card shrink-0 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl border-2 border-border p-1 bg-muted/40">
            {tabs.map(tb => (
              <button key={tb.id} onClick={() => setTab(tb.id)}
                className={cn("h-10 px-4 rounded-lg text-base font-extrabold flex items-center gap-2",
                  tab === tb.id ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground")}>
                <tb.icon className="h-5 w-5" />{tb.label}
              </button>
            ))}
          </div>
          <BranchSwitcher />
          <HardwareStatusBar />
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden lg:block text-end me-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("posView.stat.todaySales")}</p>
            <p className="text-lg font-black tabular-nums leading-tight">{formatCurrency(summary?.todayRevenue ?? 0, currency)}</p>
          </div>
          <Can permission="restaurant.tables.create">
            <button onClick={() => setShowAddTable(true)} title={t("posView.addTable")} className={cn(headBtn, "border-2 border-border hover:border-primary")}>
              <Plus className="h-5 w-5" />{t("posView.addTable")}
            </button>
          </Can>
          <Can permission="restaurant.delivery.create">
            <button onClick={() => setShowDelivery(true)} className={cn(headBtn, "border-2 border-border hover:border-primary")}>
              <Bike className="h-5 w-5" />{t("posView.delivery")}
            </button>
          </Can>
          <Can permission="restaurant.orders.create">
            <button onClick={() => setScreen({ kind: "order", orderId: null })} className={cn(headBtn, "bg-primary text-primary-foreground shadow-md hover:brightness-110")}>
              <ShoppingBag className="h-5 w-5" />{t("posView.takeaway")}
            </button>
          </Can>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {tab === "floor" ? (
          <>
            {/* Filters that are also the at-a-glance numbers */}
            <div className="flex gap-2 flex-wrap items-center">
              <button onClick={() => setStatusFilter("all")} className={chip(statusFilter === "all")}>
                {t("posView.drawer.all")}<span className="tabular-nums opacity-70">{tables.length}</span>
              </button>
              {(["available", "occupied", "reserved", "cleaning"] as TableStatus[]).map(s => (
                <button key={s} onClick={() => setStatusFilter(statusFilter === s ? "all" : s)} className={chip(statusFilter === s)}>
                  <span className={cn("h-2.5 w-2.5 rounded-full", STATUS_DOT[s])} />
                  {t(`posView.tableStatus.${s}`)}<span className="tabular-nums opacity-70">{counts[s]}</span>
                </button>
              ))}
              {sections.length > 1 && (
                <>
                  <span className="w-px h-8 bg-border mx-1" />
                  <button onClick={() => setSection("all")} className={chip(section === "all")}>{t("posView.allSections")}</button>
                  {sections.map(s => (
                    <button key={s} onClick={() => setSection(s)} className={chip(section === s)}>{sectionName(s)}</button>
                  ))}
                </>
              )}
            </div>

            {/* Counter orders still open — previously only reachable by digging through history */}
            {counterOrders.length > 0 && (
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground mb-2">{t("posView.floor.counterOrders")}</p>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {counterOrders.map(o => (
                    <button key={o.id} onClick={() => setScreen({ kind: "order", orderId: o.id })}
                      className="shrink-0 w-56 p-3 rounded-2xl border-2 border-border bg-card text-start hover:border-primary active:scale-[0.97] transition-all">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-sm font-extrabold text-foreground">
                          {o.orderType === "delivery" ? <Bike className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
                          {o.orderNumber.slice(-6)}
                        </span>
                        <span className={cn("px-2 py-1 rounded-lg text-xs font-extrabold", ORDER_STATUS_STYLE[o.status])}>
                          {t(`orders.status.${o.status}`, { defaultValue: o.status })}
                        </span>
                      </div>
                      <p className="text-xl font-black tabular-nums mt-2">{formatCurrency(o.total, currency)}</p>
                      <p className="text-sm font-semibold text-muted-foreground truncate">{o.waiter}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tablesLoading ? (
              <div className="flex justify-center py-24"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
            ) : tables.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <UtensilsCrossed className="h-14 w-14 text-muted-foreground/30 mb-3" />
                <p className="text-xl font-extrabold text-foreground">{t("posView.floor.noTables")}</p>
                <p className="text-base font-medium text-muted-foreground mt-1">{t("posView.floor.noTablesHint")}</p>
              </div>
            ) : (
              <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(160px,1fr))]">
                {shownTables.map(tb => (
                  <TableTile key={tb.id} table={tb} order={orderByTable.get(tb.id)} currency={currency}
                    onClick={() => setScreen({ kind: "table", tableId: tb.id })} />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="bg-card border-2 border-border rounded-2xl overflow-hidden">
            <div className="divide-y divide-border">
              {history.map(o => (
                <button key={o.id}
                  onClick={() => setScreen(o.orderType === "dine_in" && orderByTable.get(o.tableId)?.id === o.id
                    ? { kind: "table", tableId: o.tableId } : { kind: "order", orderId: o.id })}
                  className="w-full flex items-center gap-4 px-5 py-3.5 text-start hover:bg-muted/40">
                  <span className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center text-xl font-black shrink-0">
                    {o.orderType === "dine_in" ? o.tableNumber : o.orderType === "delivery" ? <Bike className="h-6 w-6" /> : <ShoppingBag className="h-6 w-6" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold text-foreground truncate">{o.orderNumber}</p>
                    <p className="text-sm font-semibold text-muted-foreground truncate">
                      {o.waiter} · {t("posView.floor.itemCount", { count: o.items.length })}
                    </p>
                  </div>
                  <span className={cn("px-3 py-1.5 rounded-xl text-sm font-extrabold whitespace-nowrap", ORDER_STATUS_STYLE[o.status])}>
                    {t(`orders.status.${o.status}`, { defaultValue: o.status })}
                  </span>
                  <p className="w-32 text-end text-lg font-black tabular-nums">{formatCurrency(o.total, currency)}</p>
                  <ChevronRight className="h-5 w-5 text-muted-foreground rtl:rotate-180 shrink-0" />
                </button>
              ))}
              {(historyPage?.totalCount ?? 0) === 0 && (
                <p className="px-4 py-16 text-center text-base font-semibold text-muted-foreground">{t("posView.noOrders")}</p>
              )}
            </div>
            {(historyPage?.totalCount ?? 0) > 0 && (
              <div className="border-t-2 border-border">
                <Pager page={orderPage} totalPages={historyPage?.totalPages ?? 1} totalCount={historyPage?.totalCount ?? 0}
                  pageSize={ORDERS_PAGE_SIZE} busy={historyFetching} onPage={setOrderPage} />
              </div>
            )}
          </div>
        )}
      </div>

      <AddTableForm open={showAddTable} onClose={() => setShowAddTable(false)} />
      {showDelivery && <NewDeliveryOrderModal currency={currency} onClose={() => setShowDelivery(false)} />}
    </div>
  );
}
