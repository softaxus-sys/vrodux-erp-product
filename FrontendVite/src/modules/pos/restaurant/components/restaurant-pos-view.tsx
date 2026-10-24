import * as React from "react";
import { useTranslation } from "react-i18next";
import { Plus, Users, Loader2, Clock, LayoutGrid, ListOrdered, ShoppingBag, Bike, ChevronRight, UtensilsCrossed, BellRing, Timer, Receipt, Gauge, Armchair, Wallet } from "lucide-react";
import { Pager } from "@/components/ui/pager";
import { cn, formatCurrency, parseApiDate } from "@/lib/utils";
import { useTables, useOrders, useOrdersSummary } from "@/hooks/restaurant/use-restaurant";
import { useDeviceRegistration } from "@/hooks/restaurant/use-devices";
import { useRestaurantRealtime } from "@/hooks/restaurant/use-restaurant-realtime";
import { useCurrency } from "@/hooks/use-currency";
import { HardwareStatusBar } from "@/components/pos/hardware-status-bar";
import { Can } from "@/components/auth/can";
import type { RestaurantTable, RestaurantOrder, TableStatus, TableShape } from "@/lib/restaurant/restaurant.api";
import { BranchSwitcher } from "./branch-switcher";
import { CloseShiftButton } from "./close-shift-button";
import { AddTableForm } from "./add-table-form";
import { OrderScreen, ORDER_STATUS_STYLE } from "./order-screen";
import { useOrderStatusLabel } from "./order-status-label";

const ORDERS_PAGE_SIZE = 30;
/** The floor needs one live order per table, so this is bounded by floor size, not history. */
const OPEN_ORDERS_LIMIT = 200;

const STATUS_DOT: Record<TableStatus, string> = {
  available: "bg-success", occupied: "bg-primary", reserved: "bg-blue-500", cleaning: "bg-muted-foreground",
};

/** One colour story per status, shared by the strip, the table top and the chairs so a floor reads at a glance. */
const LOOK: Record<TableStatus, { card: string; strip: string; top: string; chair: string; text: string }> = {
  available: { card: "border-success/30 hover:border-success", strip: "bg-success",
    top: "bg-success/15 border-success/50", chair: "bg-success/40", text: "text-success" },
  occupied:  { card: "border-primary/40 hover:border-primary", strip: "bg-primary",
    top: "bg-primary/20 border-primary/60", chair: "bg-primary/30", text: "text-primary" },
  reserved:  { card: "border-blue-500/40 hover:border-blue-500", strip: "bg-blue-500",
    top: "bg-blue-500/15 border-blue-500/50", chair: "bg-blue-500/40", text: "text-blue-500" },
  cleaning:  { card: "border-border hover:border-muted-foreground", strip: "bg-muted-foreground/60",
    top: "bg-muted border-muted-foreground/30 border-dashed", chair: "bg-muted-foreground/25", text: "text-muted-foreground" },
};

/** Minutes after which a seated table is worth a second look, and after which it is clearly overdue. */
const LONG_STAY = 90, VERY_LONG_STAY = 150;

type Screen = null | { kind: "table"; tableId: string } | { kind: "order"; orderId: string | null; delivery?: boolean };

/** Re-renders once a minute so "seated 42 min" stays honest without a timer per tile. */
function useMinuteTick() {
  const [, tick] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => { const id = setInterval(tick, 60_000); return () => clearInterval(id); }, []);
}

function minutesSince(iso: string | null | undefined) {
  return iso ? Math.max(0, Math.floor((Date.now() - parseApiDate(iso).getTime()) / 60_000)) : null;
}

/**
 * A top-down drawing of the table in its real shape, one chair per seat, chairs filled for the
 * guests sitting there. Capped at 12 drawn chairs so a banquet table stays legible.
 */
function TableGlyph({ shape, capacity, covers, status, label }: {
  shape: TableShape; capacity: number; covers: number; status: TableStatus; label: string;
}) {
  const look = LOOK[status] ?? LOOK.cleaning;
  const seats = Math.max(1, Math.min(capacity || 1, 12));
  const W = 132, H = 96, cx = W / 2, cy = H / 2;
  const round = shape === "round";
  const long = !round && (shape === "rect" || seats > 6);
  const tw = round ? 50 : long ? 84 : 52, th = round ? 50 : long ? 40 : 52;

  const chairs: { x: number; y: number; r: number }[] = [];
  if (round) {
    for (let i = 0; i < seats; i++) {
      const a = (i / seats) * Math.PI * 2 - Math.PI / 2;
      chairs.push({ x: cx + Math.cos(a) * 37, y: cy + Math.sin(a) * 37, r: (a * 180) / Math.PI + 90 });
    }
  } else {
    // Long sides first, then the ends — the way people are actually seated.
    const ends = seats <= 2 ? 0 : long ? Math.min(2, seats - 2) : seats >= 4 ? 2 : 0;
    const sides = seats - ends, top = Math.ceil(sides / 2), bottom = sides - top;
    const row = (n: number, y: number, r: number) => {
      for (let i = 0; i < n; i++) chairs.push({ x: cx - tw / 2 + (tw / (n + 1)) * (i + 1), y, r });
    };
    row(top, cy - th / 2 - 9, 0);
    row(bottom, cy + th / 2 + 9, 180);
    if (ends >= 1) chairs.push({ x: cx - tw / 2 - 9, y: cy, r: 270 });
    if (ends >= 2) chairs.push({ x: cx + tw / 2 + 9, y: cy, r: 90 });
  }

  return (
    <div className="relative mx-auto" style={{ width: W, height: H }} aria-hidden>
      {chairs.map((c, i) => (
        <span key={i}
          className={cn("absolute w-[18px] h-[10px] rounded-t-lg rounded-b-sm transition-colors",
            i < covers ? cn(look.strip, "shadow-sm") : look.chair)}
          style={{ left: c.x - 9, top: c.y - 5, transform: `rotate(${c.r}deg)` }} />
      ))}
      <div className={cn("absolute flex items-center justify-center border-2 shadow-inner",
          round ? "rounded-full" : "rounded-xl", look.top)}
        style={{ left: cx - tw / 2, top: cy - th / 2, width: tw, height: th }}>
        <span className="text-2xl font-black text-foreground leading-none tracking-tight truncate px-1">{label}</span>
      </div>
    </div>
  );
}

function TableTile({ table, order, currency, onClick }: {
  table: RestaurantTable; order: RestaurantOrder | undefined; currency: string; onClick: () => void;
}) {
  const { t } = useTranslation("restaurant");
  const status: TableStatus = order ? "occupied" : table.status;
  const look = LOOK[status] ?? LOOK.cleaning;
  const ready = order?.status === "ready";
  const mins = minutesSince(table.occupiedSince ?? order?.createdAt);
  const elapsed = mins == null ? null
    : mins < 60 ? t("posView.floor.mins", { n: mins }) : t("posView.floor.hours", { h: Math.floor(mins / 60), m: mins % 60 });
  const stay = mins == null ? "ok" : mins >= VERY_LONG_STAY ? "very" : mins >= LONG_STAY ? "long" : "ok";
  const covers = order?.covers ?? 0;
  const items = order?.items.length ?? 0;
  const waiter = order?.waiter || table.currentWaiter;

  return (
    <button onClick={onClick}
      className={cn("group relative overflow-hidden rounded-2xl border-2 bg-card text-start flex flex-col",
        "shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.97]",
        ready ? "border-success ring-4 ring-success/25" : look.card)}>
      {/* Status strip; for seated guests, a bar showing how long they have been at the table. */}
      <div className={cn("h-1.5 w-full", look.strip, ready && "animate-pulse")} />
      {mins != null && order && (
        <div className="h-1 w-full bg-muted">
          <div className={cn("h-full transition-all",
              stay === "very" ? "bg-destructive" : stay === "long" ? "bg-warning" : look.strip)}
            style={{ width: `${Math.min(100, (mins / VERY_LONG_STAY) * 100)}%` }} />
        </div>
      )}

      <div className="flex items-center justify-between gap-2 px-3 pt-2.5">
        <span className={cn("flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider truncate", ready ? "text-success" : look.text)}>
          <span className={cn("h-2 w-2 rounded-full shrink-0", ready ? "bg-success" : STATUS_DOT[status] ?? STATUS_DOT.cleaning, status === "occupied" && "animate-pulse")} />
          {ready ? t("orders.status.ready", { defaultValue: "Ready" }) : t(`posView.tableStatus.${status}`, { defaultValue: status })}
        </span>
        <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground tabular-nums shrink-0">
          <Users className="h-3.5 w-3.5" />{order ? `${covers}/${table.capacity}` : table.capacity}
        </span>
      </div>

      <div className="py-1">
        <TableGlyph shape={table.shape} capacity={table.capacity} covers={covers} status={status} label={table.tableNumber} />
      </div>

      <div className="mt-auto px-3 pb-3">
        {order ? (
          <>
            <div className="flex items-end justify-between gap-2">
              <p className="text-lg font-black text-foreground tabular-nums truncate leading-tight">{formatCurrency(order.total, currency)}</p>
              {elapsed && (
                <span className={cn("flex items-center gap-1 text-xs font-extrabold tabular-nums shrink-0 rounded-md px-1.5 py-0.5",
                  stay === "very" ? "bg-destructive/15 text-destructive" : stay === "long" ? "bg-warning/15 text-warning" : "text-muted-foreground")}>
                  {stay === "ok" ? <Clock className="h-3.5 w-3.5" /> : <Timer className="h-3.5 w-3.5" />}{elapsed}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 mt-1.5">
              <span className={cn("px-2 py-0.5 rounded-md text-[11px] font-extrabold flex items-center gap-1 truncate",
                ready ? "bg-success text-white" : ORDER_STATUS_STYLE[order.status])}>
                {ready && <BellRing className="h-3 w-3 animate-bounce" />}
                {t(`orders.status.${order.status}`, { defaultValue: order.status })}
              </span>
              <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground truncate">
                <Receipt className="h-3.5 w-3.5 shrink-0" />{t("posView.floor.itemCount", { count: items })}
              </span>
            </div>
            {waiter && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground min-w-0">
                <span className="h-5 w-5 shrink-0 rounded-full bg-primary/15 text-primary text-[10px] font-black flex items-center justify-center">
                  {waiter.trim().charAt(0).toUpperCase()}
                </span>
                <span className="truncate">{waiter}</span>
              </p>
            )}
          </>
        ) : (
          <p className="text-center text-xs font-bold text-muted-foreground group-hover:text-foreground transition-colors">
            {status === "available" ? t("posView.floor.tapToSeat")
              : status === "reserved" ? t("posView.floor.reservedHint") : t("posView.floor.cleaningHint")}
          </p>
        )}
      </div>
    </button>
  );
}

/** Live numbers for the whole floor: how full it is, what is on the tables, how long people have sat. */
function FloorStats({ tables, orderByTable, currency }: {
  tables: RestaurantTable[]; orderByTable: Map<string, RestaurantOrder>; currency: string;
}) {
  const { t } = useTranslation("restaurant");
  const seats = tables.reduce((n, tb) => n + (tb.capacity || 0), 0);
  let occupied = 0, guests = 0, onTables = 0, stayTotal = 0, stayN = 0, overdue = 0, ready = 0;
  for (const tb of tables) {
    const o = orderByTable.get(tb.id);
    if (!o) continue;
    occupied++; guests += o.covers || 0; onTables += o.total || 0;
    if (o.status === "ready") ready++;
    const m = minutesSince(tb.occupiedSince ?? o.createdAt);
    if (m != null) { stayTotal += m; stayN++; if (m >= LONG_STAY) overdue++; }
  }
  const pct = tables.length ? Math.round((occupied / tables.length) * 100) : 0;
  const avg = stayN ? Math.round(stayTotal / stayN) : 0;
  const dur = (m: number) => m < 60 ? t("posView.floor.mins", { n: m }) : t("posView.floor.hours", { h: Math.floor(m / 60), m: m % 60 });

  const tiles: { icon: typeof Gauge; label: string; value: string; sub: string; tone: string; bar?: number }[] = [
    { icon: Gauge, label: t("posView.floor.occupancy"), value: `${pct}%`, sub: `${occupied}/${tables.length}`, bar: pct, tone: "text-primary bg-primary/10" },
    { icon: Armchair, label: t("posView.floor.guestsSeated"), value: String(guests), sub: t("posView.floor.ofSeats", { n: seats }),
      bar: seats ? (guests / seats) * 100 : 0, tone: "text-blue-500 bg-blue-500/10" },
    { icon: Wallet, label: t("posView.floor.onTables"), value: formatCurrency(onTables, currency),
      sub: t("posView.floor.openBills", { count: occupied }), tone: "text-success bg-success/10" },
    { icon: Timer, label: t("posView.floor.avgStay"), value: dur(avg),
      sub: overdue ? t("posView.floor.longStays", { count: overdue }) : t("posView.floor.allOnTime"),
      tone: overdue ? "text-warning bg-warning/10" : "text-muted-foreground bg-muted" },
    { icon: BellRing, label: t("posView.floor.readyToServe"), value: String(ready),
      sub: ready ? t("posView.floor.pickUp") : t("posView.floor.nothingWaiting"),
      tone: ready ? "text-success bg-success/15" : "text-muted-foreground bg-muted" },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
      {tiles.map(s => (
        <div key={s.label} className="rounded-2xl border-2 border-border bg-card p-3.5 flex items-center gap-3 shadow-sm">
          <span className={cn("h-11 w-11 rounded-xl flex items-center justify-center shrink-0", s.tone)}><s.icon className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground truncate">{s.label}</p>
            <p className="text-xl font-black tabular-nums leading-tight truncate">{s.value}</p>
            <p className="text-xs font-semibold text-muted-foreground truncate">{s.sub}</p>
            {s.bar != null && (
              <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, s.bar)}%` }} />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function RestaurantPOSView() {
  const { t } = useTranslation("restaurant");
  useRestaurantRealtime();
  useDeviceRegistration();
  useMinuteTick();
  const currency = useCurrency();
  const statusLabel = useOrderStatusLabel();

  const [screen, setScreen] = React.useState<Screen>(null);
  /** Covers the moment between an order being created and the next refresh carrying it. */
  const [justCreated, setJustCreated] = React.useState<RestaurantOrder | null>(null);
  const [tab, setTab] = React.useState<"floor" | "orders">("floor");
  const [section, setSection] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState<"all" | TableStatus>("all");
  const [showAddTable, setShowAddTable] = React.useState(false);

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
        newDelivery={screen.kind === "order" && !!screen.delivery}
        table={table} order={order} tables={tables} allOrders={openOrders} currency={currency}
        onBack={close}
        onOrderCreated={created => {
          setJustCreated(created);
          if (screen.kind === "order") setScreen({ kind: "order", orderId: created.id, delivery: screen.delivery });
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
          <CloseShiftButton className={cn(headBtn, "border-2 border-destructive/40 text-destructive hover:bg-destructive/10")} />
          <Can permission="restaurant.tables.create">
            <button onClick={() => setShowAddTable(true)} title={t("posView.addTable")} className={cn(headBtn, "border-2 border-border hover:border-primary")}>
              <Plus className="h-5 w-5" />{t("posView.addTable")}
            </button>
          </Can>
          <Can permission="restaurant.delivery.create">
            <button onClick={() => setScreen({ kind: "order", orderId: null, delivery: true })} className={cn(headBtn, "border-2 border-border hover:border-primary")}>
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
            {tables.length > 0 && <FloorStats tables={tables} orderByTable={orderByTable} currency={currency} />}

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
                          {statusLabel(o)}
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
              <div className="space-y-6">
                {(section === "all" && sections.length > 1 ? sections : [null]).map(sec => {
                  const list = sec == null ? shownTables : shownTables.filter(tb => tb.section === sec);
                  if (list.length === 0) return null;
                  const busy = list.filter(tb => orderByTable.has(tb.id)).length;
                  return (
                    <section key={sec ?? "all"}>
                      {sec != null && (
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-sm font-black uppercase tracking-wider text-foreground">{sectionName(sec)}</h3>
                          <span className="text-xs font-bold text-muted-foreground tabular-nums">{busy}/{list.length}</span>
                          <span className="flex-1 h-px bg-border" />
                        </div>
                      )}
                      <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(176px,1fr))]">
                        {list.map(tb => (
                          <TableTile key={tb.id} table={tb} order={orderByTable.get(tb.id)} currency={currency}
                            onClick={() => setScreen({ kind: "table", tableId: tb.id })} />
                        ))}
                      </div>
                    </section>
                  );
                })}
                {shownTables.length === 0 && (
                  <p className="py-16 text-center text-base font-semibold text-muted-foreground">{t("posView.floor.noMatch")}</p>
                )}
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
                    {statusLabel(o)}
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
    </div>
  );
}
