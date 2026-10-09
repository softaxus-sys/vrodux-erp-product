import * as React from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft, Search, X, Plus, Minus, Users, Send, CheckCircle2, Receipt, Trash2, Loader2,
  Tag, SplitSquareHorizontal, PauseCircle, PlayCircle, ChefHat, Ban, RotateCcw, Mail,
  ArrowRightLeft, MessageSquarePlus, UserRound, Bike, EyeOff, UtensilsCrossed, Save, Sparkles, Percent, Ticket,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatCurrency } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { LeftDrawer } from "@/components/ui/left-drawer";
import { Can } from "@/components/auth/can";
import {
  useMenu, useCreateOrder, useAddItems, useVoidItem, useSendToKitchen, useServeOrder,
  useCancelOrder, useSetItemAvailability, useApplyOrderDiscount, useRemoveOrderDiscount,
  useRefundOrder, useSplitOrder, useHoldOrder, useRecallOrder, useCombos, useAddCombo,
  useFireNextCourse, useSendReceipt, useSetTableStatus, useTransferOrderTable, useSetOrderWaiter,
  useDeliveryOrders, useDrivers, useAssignDriverToDelivery, useCreateDeliveryOrder, useDeliveryZones,
} from "@/hooks/restaurant/use-restaurant";
import { useRecipes } from "@/hooks/recipe/use-recipe";
import { useUsers } from "@/hooks/identity/use-users";
import { useCurrentBranch } from "@/hooks/restaurant/use-current-branch";
import { useHardware } from "@/contexts/hardware-context";
import { buildEscPosReceipt } from "@/lib/pos/receipt-escpos";
import { vouchersApi } from "@/lib/pos/vouchers.api";
import { useAuthStore } from "@/store/auth.store";
import { useShift } from "@/modules/pos/retail/components/shift-gate";
import type {
  DiscountType, RestaurantTable, RestaurantOrder, MenuItem, Combo, Driver,
} from "@/lib/restaurant/restaurant.api";
import { RestaurantPayDialog } from "./restaurant-pay-dialog";
import { OrderReceiptModal } from "./order-receipt";
import { OrderCustomer } from "./order-customer";
import { useOrderStatusLabel } from "./order-status-label";
import { DishPhoto, coverOf } from "./dish-photos";
import { ReasonModal, RefundModal, SplitBillModal, ComboPickerModal, SendReceiptModal, PersonSheet } from "./order-dialogs";

/**
 * The order-taking screen. Menu on one side, the ticket on the other, and one obvious next step at
 * the bottom of the ticket — the person holding the tablet should never have to hunt for what to
 * press next.
 */

// Colours only — labels come from the shared `orders.status.*` vocabulary.
export const ORDER_STATUS_STYLE: Record<string, string> = {
  open:      "bg-muted text-muted-foreground",
  sent:      "bg-warning/15 text-warning",
  ready:     "bg-success/15 text-success",
  served:    "bg-primary/10 text-primary",
  paid:      "bg-muted text-foreground",
  cancelled: "bg-destructive/10 text-destructive",
  split:     "bg-blue-500/10 text-blue-500",
  held:      "bg-amber-500/15 text-amber-600",
};
const CLOSED = ["paid", "cancelled", "split", "held"];

// A stable colour per category, so staff find "the green ones" without reading.
const CATEGORY_ACCENT = [
  "border-s-emerald-500", "border-s-sky-500", "border-s-amber-500", "border-s-rose-500",
  "border-s-violet-500", "border-s-teal-500", "border-s-orange-500", "border-s-indigo-500",
];

/** `key` identifies one new line: the same dish can appear twice with different options. */
interface PendingLine { key: string; menuItem: MenuItem; quantity: number; note: string; selectedModifierIds: string[] }

const pill = (active: boolean) => cn(
  "h-12 px-5 rounded-xl text-base font-bold whitespace-nowrap shrink-0 border-2 transition-colors",
  active ? "bg-primary border-primary text-primary-foreground shadow-md" : "bg-card border-border text-foreground hover:border-primary",
);
/**
 * The category pills on one row, with a back / next arrow at each end. An arrow shows only while
 * there is more to reveal on its side, so a short menu gets a plain row with nothing to press.
 */
function CategoryRail({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [more, setMore] = React.useState({ back: false, next: false });

  const measure = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // scrollLeft runs negative in RTL, so compare distances rather than raw offsets.
    const scrolled = Math.abs(el.scrollLeft);
    const max = el.scrollWidth - el.clientWidth;
    setMore({ back: scrolled > 4, next: scrolled < max - 4 });
  }, []);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, children]);

  const step = (direction: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === "rtl";
    el.scrollBy({ left: direction * (rtl ? -1 : 1) * el.clientWidth * 0.7, behavior: "smooth" });
  };

  const arrow = "h-12 w-12 shrink-0 rounded-xl border-2 border-border bg-card text-foreground flex items-center justify-center hover:border-primary active:scale-95 transition-all";

  return (
    <div className="flex items-start gap-2 px-4 py-3 shrink-0">
      {more.back && (
        <button type="button" onClick={() => step(-1)} className={arrow} aria-label="Previous categories">
          <ChevronLeft className="h-6 w-6 rtl:rotate-180" strokeWidth={3} />
        </button>
      )}
      <div ref={ref} onScroll={measure}
        className="flex-1 min-w-0 flex gap-2 overflow-x-auto pb-1.5 [scrollbar-width:thin] [scrollbar-color:hsl(var(--border))_transparent]">
        {children}
      </div>
      {more.next && (
        <button type="button" onClick={() => step(1)} className={arrow} aria-label="More categories">
          <ChevronRight className="h-6 w-6 rtl:rotate-180" strokeWidth={3} />
        </button>
      )}
    </div>
  );
}

const dlvInput = "w-full h-11 px-3 rounded-xl border-2 border-border bg-card text-base font-semibold text-foreground placeholder:text-muted-foreground placeholder:font-medium focus:outline-none focus:border-primary";
const bigBtn = "h-16 rounded-2xl flex items-center justify-center gap-2 px-4 text-lg font-black transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100";

// ─── Options picker — one question per group, big targets ────────────────────
function OptionsSheet({ item, currency, onConfirm, onCancel }: {
  item: MenuItem; currency: string; onConfirm: (ids: string[]) => void; onCancel: () => void;
}) {
  const { t } = useTranslation("restaurant");
  const [selections, setSelections] = React.useState<Record<string, string[]>>({});

  const toggle = (groupId: string, modId: string, maxSelect: number) => setSelections(prev => {
    const current = prev[groupId] ?? [];
    if (maxSelect === 1) return { ...prev, [groupId]: current[0] === modId ? [] : [modId] };
    if (current.includes(modId)) return { ...prev, [groupId]: current.filter(id => id !== modId) };
    if (current.length >= maxSelect) return prev;
    return { ...prev, [groupId]: [...current, modId] };
  });

  const allValid = item.modifierGroups.every(g => {
    const n = (selections[g.id] ?? []).length;
    return n >= g.minSelect && n <= g.maxSelect;
  });
  const delta = item.modifierGroups.reduce((sum, g) =>
    sum + g.modifiers.filter(m => (selections[g.id] ?? []).includes(m.id)).reduce((s, m) => s + m.priceDelta, 0), 0);

  return (
    <LeftDrawer onClose={onCancel} widthClassName="max-w-md" zIndexClassName="z-[70]">
      <div>
        <p className="text-2xl font-black text-foreground">{item.name}</p>
        <p className="text-base font-bold text-muted-foreground tabular-nums">{formatCurrency(item.price + delta, currency)}</p>
      </div>
      <div className="space-y-5 pt-2">
        {item.modifierGroups.map(g => {
          const missing = (selections[g.id] ?? []).length < g.minSelect;
          return (
            <div key={g.id}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-base font-extrabold text-foreground">
                  {g.name}{" "}
                  <span className="text-sm font-semibold text-muted-foreground">
                    {g.maxSelect === 1 ? t("posView.modifier.chooseOne")
                      : g.minSelect > 0 ? t("posView.modifier.chooseUpToMin", { max: g.maxSelect, min: g.minSelect })
                      : t("posView.modifier.chooseUpTo", { max: g.maxSelect })}
                  </span>
                </p>
                {g.minSelect > 0 && (
                  <span className={cn("text-xs font-extrabold uppercase px-2 py-1 rounded-lg",
                    missing ? "bg-destructive/10 text-destructive" : "bg-success/15 text-success")}>
                    {t("posView.screen.required")}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {g.modifiers.filter(m => m.isActive).map(m => {
                  const checked = (selections[g.id] ?? []).includes(m.id);
                  return (
                    <button key={m.id} onClick={() => toggle(g.id, m.id, g.maxSelect)}
                      className={cn("min-h-14 px-3 py-2 rounded-xl border-2 text-start transition-colors",
                        checked ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/50")}>
                      <p className="text-base font-bold text-foreground leading-tight">{m.name}</p>
                      {m.priceDelta !== 0 && (
                        <p className="text-sm font-semibold text-muted-foreground tabular-nums">
                          {m.priceDelta > 0 ? "+" : ""}{formatCurrency(m.priceDelta, currency)}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 pt-3">
        <button onClick={onCancel} className={cn(bigBtn, "h-14 w-32 border-2 border-border text-base")}>{t("posView.common.cancel")}</button>
        <button disabled={!allValid} onClick={() => onConfirm(Object.values(selections).flat())}
          className={cn(bigBtn, "h-14 flex-1 bg-primary text-primary-foreground text-base")}>
          {t("posView.modifier.addWithPrice", { price: formatCurrency(item.price + delta, currency) })}
        </button>
      </div>
    </LeftDrawer>
  );
}

// ─── Discount — percent shortcuts, a fixed amount, or a voucher ──────────────
function DiscountSheet({ order, currency, onVoucher, onClose }: {
  order: RestaurantOrder; currency: string; onVoucher: (code: string | null) => void; onClose: () => void;
}) {
  const { t } = useTranslation("restaurant");
  const applyDisc  = useApplyOrderDiscount();
  const removeDisc = useRemoveOrderDiscount();
  const [tab, setTab] = React.useState<"pct" | "fixed" | "voucher">("pct");
  const [value, setValue] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [msg, setMsg] = React.useState<string | null>(null);
  const [checking, setChecking] = React.useState(false);
  const busy = applyDisc.isPending || removeDisc.isPending || checking;

  const needReason = () => {
    if (reason.trim()) return false;
    toast.error(t("posView.drawer.discountReasonRequired"));
    return true;
  };

  const apply = async () => {
    if (needReason()) return;
    setMsg(null);
    try {
      if (tab === "voucher") {
        const code = value.trim().toUpperCase();
        if (!code) return;
        setChecking(true);
        const res = await vouchersApi.validate(code, order.subTotal);
        if (!res.valid) { setMsg(res.message ?? t("posView.drawer.voucherInvalid")); return; }
        await applyDisc.mutateAsync({ id: order.id, type: "voucher" as DiscountType,
          amount: res.discountAmount, reason: `Voucher ${code}: ${reason.trim()}` });
        onVoucher(code);
      } else {
        const v = parseFloat(value) || 0;
        if (v <= 0 || (tab === "pct" && v > 100)) return;
        const amount = tab === "pct" ? Math.round(order.subTotal * (v / 100) * 100) / 100 : Math.min(v, order.subTotal);
        await applyDisc.mutateAsync({ id: order.id, type: (tab === "pct" ? "percentage" : "flat") as DiscountType,
          amount, reason: reason.trim() });
        onVoucher(null);
      }
      onClose();
    } catch (e) {
      if (tab === "voucher") setMsg((e as Error)?.message ?? t("posView.drawer.validationFailed"));
    } finally { setChecking(false); }
  };

  const remove = async () => {
    if (!reason.trim()) { toast.error(t("posView.drawer.removeReasonRequired")); return; }
    try { await removeDisc.mutateAsync({ id: order.id, reason: reason.trim() }); onVoucher(null); onClose(); } catch { /* hook toasts */ }
  };

  const tabs = [
    { id: "pct" as const, label: t("posView.drawer.discountPercent"), icon: Percent },
    { id: "fixed" as const, label: t("posView.drawer.discountAmount"), icon: Tag },
    { id: "voucher" as const, label: t("posView.drawer.discountVoucher"), icon: Ticket },
  ];

  return (
    <LeftDrawer onClose={onClose} widthClassName="max-w-md" zIndexClassName="z-[70]">
      <p className="text-2xl font-black text-foreground">{t("posView.drawer.discount")}</p>
      {order.discountAmount > 0 && (
        <p className="text-base font-bold text-success">-{formatCurrency(order.discountAmount, currency)}</p>
      )}
      <div className="grid grid-cols-3 gap-2">
        {tabs.map(tb => (
          <button key={tb.id} onClick={() => { setTab(tb.id); setValue(""); setMsg(null); }}
            className={cn("h-16 rounded-xl border-2 flex flex-col items-center justify-center gap-1 text-sm font-bold",
              tab === tb.id ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground")}>
            <tb.icon className="h-5 w-5" />{tb.label}
          </button>
        ))}
      </div>
      {tab === "pct" && (
        <div className="grid grid-cols-4 gap-2">
          {[5, 10, 15, 20].map(p => (
            <button key={p} onClick={() => setValue(String(p))}
              className={cn("h-12 rounded-xl border-2 text-base font-extrabold",
                value === String(p) ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary")}>
              {p}%
            </button>
          ))}
        </div>
      )}
      <Input value={value} inputMode={tab === "voucher" ? "text" : "decimal"}
        onChange={e => setValue(tab === "voucher" ? e.target.value.toUpperCase() : e.target.value.replace(/[^\d.]/g, ""))}
        placeholder={tab === "voucher" ? t("posView.drawer.voucherPlaceholder") : tab === "pct" ? "%" : "0.00"}
        className="h-14 text-xl font-bold" />
      <Input value={reason} onChange={e => setReason(e.target.value)} placeholder={t("posView.reason.placeholder")} className="h-12 text-base" />
      {msg && <p className="text-sm font-semibold text-destructive">{msg}</p>}
      <button disabled={busy || !value} onClick={apply} className={cn(bigBtn, "w-full h-14 bg-primary text-primary-foreground text-base")}>
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : t("posView.common.apply")}
      </button>
      {order.discountAmount > 0 && (
        <button disabled={busy} onClick={remove} className={cn(bigBtn, "w-full h-12 border-2 border-destructive/40 text-destructive text-base")}>
          {t("posView.drawer.removeDiscount")}
        </button>
      )}
    </LeftDrawer>
  );
}

// ─── Move the order to another table ─────────────────────────────────────────
function MoveTableSheet({ tables, busy, onPick, onClose }: {
  tables: RestaurantTable[]; busy: boolean; onPick: (tableId: string) => void; onClose: () => void;
}) {
  const { t } = useTranslation("restaurant");
  const free = tables.filter(tb => tb.status === "available");
  return (
    <LeftDrawer onClose={onClose} widthClassName="max-w-md" zIndexClassName="z-[70]">
      <p className="text-2xl font-black text-foreground">{t("posView.screen.moveTitle")}</p>
      {free.length === 0 ? (
        <p className="text-base font-semibold text-muted-foreground py-8 text-center">{t("posView.screen.noFreeTables")}</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {free.map(tb => (
            <button key={tb.id} disabled={busy} onClick={() => onPick(tb.id)}
              className="h-20 rounded-2xl border-2 border-success/40 bg-success/10 hover:border-success disabled:opacity-50">
              <p className="text-2xl font-black text-foreground">{tb.tableNumber}</p>
              <p className="text-xs font-bold text-muted-foreground flex items-center justify-center gap-1"><Users className="h-3 w-3" />{tb.capacity}</p>
            </button>
          ))}
        </div>
      )}
    </LeftDrawer>
  );
}

// ─── Rider for a delivery order ───────────────────────────────────────────────
function RiderChip({ orderId }: { orderId: string }) {
  const { t } = useTranslation("restaurant");
  const { data: deliveries = [] } = useDeliveryOrders();
  const { data: drivers = [], isLoading } = useDrivers(true);
  const assign = useAssignDriverToDelivery();
  const [open, setOpen] = React.useState(false);
  const delivery = deliveries.find(d => d.orderId === orderId);
  if (!delivery) return null;
  const done = delivery.status === "delivered" || delivery.status === "failed";
  return (
    <>
      <Can permission="restaurant.delivery.edit" fallback={delivery.driverName ? <span className={cn(chipCls, "border-border")}><Bike className="h-5 w-5" />{delivery.driverName}</span> : null}>
        <button disabled={done} onClick={() => setOpen(true)}
          className={cn(chipCls, delivery.driverName ? "border-border hover:border-primary" : "border-warning bg-warning/10 text-warning")}>
          <Bike className="h-5 w-5 shrink-0" /><span className="truncate">{delivery.driverName ?? t("posView.screen.assignRider")}</span>
        </button>
      </Can>
      {open && (
        <PersonSheet title={t("posView.screen.riderTitle")} loading={isLoading} busy={assign.isPending}
          currentName={delivery.driverName} emptyText={t("posView.screen.noRiders")}
          people={byAvailability(drivers).map(d => ({ id: d.id, name: d.name, detail: riderDetail(d, t) }))}
          onPick={p => assign.mutate({ id: delivery.id, driverId: p.id }, { onSuccess: () => setOpen(false) })}
          onClose={() => setOpen(false)} />
      )}
    </>
  );
}
/** Free riders first, then the least loaded — the order a dispatcher wants to read them in. */
const byAvailability = (drivers: Driver[]) =>
  [...drivers].sort((a, b) => (a.activeDeliveries ?? 0) - (b.activeDeliveries ?? 0) || a.name.localeCompare(b.name));
const riderDetail = (d: Driver, t: (k: string, o?: Record<string, unknown>) => string) =>
  [(d.activeDeliveries ?? 0) === 0 ? t("posView.newDelivery.riderFree") : t("posView.newDelivery.riderBusy", { count: d.activeDeliveries }),
   d.phone, d.vehicleInfo].filter(Boolean).join(" · ");

const chipCls = "h-11 max-w-full px-3.5 rounded-xl border-2 flex items-center gap-2 text-base font-bold text-foreground transition-colors disabled:opacity-60";

// ─── Labelled secondary action (never an unlabelled icon) ────────────────────
function ActionButton({ icon: Icon, label, onClick, danger, busy, disabled }: {
  icon: React.ElementType; label: string; onClick: () => void; danger?: boolean; busy?: boolean; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled || busy}
      className={cn("h-16 flex-1 min-w-[72px] rounded-xl border-2 flex flex-col items-center justify-center gap-1 px-1 text-xs font-bold leading-tight transition-colors disabled:opacity-50",
        danger ? "border-destructive/30 text-destructive hover:bg-destructive/10" : "border-border text-foreground hover:border-primary hover:text-primary")}>
      {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" strokeWidth={2.25} />}
      <span className="text-center">{label}</span>
    </button>
  );
}

// ─── The screen ───────────────────────────────────────────────────────────────
export function OrderScreen({ table, order, tables, allOrders, currency, onBack, onOrderCreated, newDelivery = false }: {
  /** Opened from the Delivery button: the order is punched here like any other, plus where it is going and who takes it. */
  newDelivery?: boolean;
  /** null = a counter order (takeaway / delivery). */
  table: RestaurantTable | null;
  order: RestaurantOrder | null;
  tables: RestaurantTable[];
  allOrders: RestaurantOrder[];
  currency: string;
  onBack: () => void;
  onOrderCreated?: (order: RestaurantOrder) => void;
}) {
  const { t } = useTranslation("restaurant");
  const { user, tenant } = useAuthStore();
  const { sessionId } = useShift();
  const { branchId } = useCurrentBranch();
  const { data: menu = [], isLoading: menuLoading } = useMenu();
  const { data: combos = [] } = useCombos(true);
  const { openDrawer, printRaw, printerStatus } = useHardware();

  const createOrder = useCreateOrder();
  const createDelivery = useCreateDeliveryOrder();
  const assignRider = useAssignDriverToDelivery();
  // Only a delivery being started needs the zones and riders.
  const startingDelivery = newDelivery && !order;
  const { data: zones = [] } = useDeliveryZones();
  const { data: riders = [], isLoading: ridersLoading } = useDrivers(true);
  const [dlv, setDlv] = React.useState({ name: "", phone: "", address: "", zoneId: "", riderId: "" });
  const [riderTouched, setRiderTouched] = React.useState(false);
  // Every delivery leaves with a rider: start on whoever is freest, and let the cashier change it.
  React.useEffect(() => {
    if (!startingDelivery || riderTouched || dlv.riderId || riders.length === 0) return;
    setDlv(d => ({ ...d, riderId: byAvailability(riders)[0].id }));
  }, [startingDelivery, riderTouched, dlv.riderId, riders]);
  const dlvReady = !startingDelivery || (dlv.name.trim() !== "" && dlv.phone.trim() !== "" && dlv.address.trim() !== "");
  const pickedRider = riders.find(r => r.id === dlv.riderId) ?? null;
  const addItems    = useAddItems();
  const voidItem    = useVoidItem();
  const sendKitchen = useSendToKitchen();
  const serveOrder  = useServeOrder();
  const cancelOrder = useCancelOrder();
  const setAvail    = useSetItemAvailability();
  const refundOrder = useRefundOrder();
  const splitOrder  = useSplitOrder();
  const holdOrder   = useHoldOrder();
  const recallOrder = useRecallOrder();
  const addCombo    = useAddCombo();
  const fireCourse  = useFireNextCourse();
  const sendReceipt = useSendReceipt();
  const setTableStatus = useSetTableStatus();
  const transferTable  = useTransferOrderTable();
  const setOrderWaiter = useSetOrderWaiter();

  const [search, setSearch] = React.useState("");
  const [catId, setCatId]   = React.useState<string>("all");
  const [covers, setCovers] = React.useState(table ? Math.min(2, table.capacity) : 1);
  /** Who the order is for until it exists — a host can open a table on a waiter's behalf. */
  const [waiter, setWaiter] = React.useState(user?.name ?? "Waiter");
  const [pending, setPending] = React.useState<PendingLine[]>([]);
  const [noteFor, setNoteFor] = React.useState<string | null>(null);
  const [manageStock, setManageStock] = React.useState(false);
  const [optionsItem, setOptionsItem] = React.useState<MenuItem | null>(null);
  const [comboPicker, setComboPicker] = React.useState<Combo | null>(null);
  const [payTarget, setPayTarget] = React.useState<RestaurantOrder | null>(null);
  const [appliedVoucher, setAppliedVoucher] = React.useState<string | null>(null);
  // The receipt on screen: straight after a payment (leaveAfter = go back to the floor once it is
  // closed), or reopened from an order that is already paid.
  const [receipt, setReceipt] = React.useState<{ order: RestaurantOrder; justPaid: boolean; leaveAfter: boolean } | null>(null);
  const [dialog, setDialog] = React.useState<null | "rider" | "discount" | "split" | "cancel" | "refund" | "receipt" | "move" | "waiter">(null);
  const [voidTarget, setVoidTarget] = React.useState<string | null>(null);

  // Recipe links are only shown while managing stock, so only fetched then.
  const { data: recipes = [] } = useRecipes(manageStock);
  const recipeIds = React.useMemo(() => new Set(recipes.map(r => r.menuItemId)), [recipes]);

  // Only people whose job is serving — not every login in the workspace.
  const { data: staffPage, isLoading: staffLoading } = useUsers({ pageSize: 200, role: "Waiter" }, dialog === "waiter");
  const staff = (staffPage?.items ?? []).filter(u => u.status?.toLowerCase() === "active").map(u => ({ id: u.id, name: u.fullName, detail: u.email }));
  const isDelivery = order?.orderType === "delivery";
  const statusLabel = useOrderStatusLabel();
  const waiterName = order?.waiter ?? waiter;

  const closed = !!order && CLOSED.includes(order.status);
  const live   = !!order && !closed;
  const saving = createOrder.isPending || addItems.isPending || sendKitchen.isPending || createDelivery.isPending || assignRider.isPending;

  const categoryIndex = React.useMemo(() => new Map(menu.map((c, i) => [c.id, i])), [menu]);
  const allItems = React.useMemo(() => menu.flatMap(c => c.items.map(i => ({ ...i, categoryId: c.id }))), [menu]);
  const shownItems = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    // Searching looks across the whole menu — nobody should need to know which category a dish is in.
    return allItems.filter(m => q ? m.name.toLowerCase().includes(q) : (catId === "all" || m.categoryId === catId));
  }, [allItems, search, catId]);

  const pendingQtyByItem = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const p of pending) m.set(p.menuItem.id, (m.get(p.menuItem.id) ?? 0) + p.quantity);
    return m;
  }, [pending]);

  // Two lines of the same dish merge only when they carry the same options.
  const addLine = (mi: MenuItem, ids: string[]) => setPending(prev => {
    const sig = [...ids].sort().join(",");
    const ex = prev.find(p => p.menuItem.id === mi.id && !p.note && [...p.selectedModifierIds].sort().join(",") === sig);
    if (ex) return prev.map(p => p.key === ex.key ? { ...p, quantity: p.quantity + 1 } : p);
    return [...prev, { key: `${mi.id}-${Date.now()}-${Math.random()}`, menuItem: mi, quantity: 1, note: "", selectedModifierIds: ids }];
  });
  const tapItem = (mi: MenuItem) => {
    if (manageStock) { setAvail.mutate({ id: mi.id, isAvailable: !mi.isAvailable }); return; }
    if (!mi.isAvailable || closed) return;
    if (mi.modifierGroups.length > 0) setOptionsItem(mi); else addLine(mi, []);
  };
  const changeQty = (key: string, delta: number) => setPending(prev =>
    prev.map(p => p.key === key ? { ...p, quantity: p.quantity + delta } : p).filter(p => p.quantity > 0));

  const lineMods  = (p: PendingLine) => p.menuItem.modifierGroups.flatMap(g => g.modifiers).filter(m => p.selectedModifierIds.includes(m.id));
  const lineUnit  = (p: PendingLine) => p.menuItem.price + lineMods(p).reduce((s, m) => s + m.priceDelta, 0);
  const pendingCount = pending.reduce((s, p) => s + p.quantity, 0);
  const pendingTotal = pending.reduce((s, p) => s + lineUnit(p) * p.quantity, 0);

  const lines = () => pending.map(p => ({
    menuItemId: p.menuItem.id, quantity: p.quantity, modifiers: p.note.trim() || null,
    selectedModifierIds: p.selectedModifierIds.length ? p.selectedModifierIds : undefined,
  }));

  /** Saves any new items, and optionally fires the order to the kitchen in the same tap. */
  const submit = async (send: boolean) => {
    try {
      let id = order?.id;
      let created: RestaurantOrder | null = null;
      if (pending.length) {
        if (!order) {
          created = await createOrder.mutateAsync({
            // A delivery has no table or waiter, so the guest's name travels in that field.
            tableId: table?.id ?? null, waiter: startingDelivery ? dlv.name.trim() : waiter, covers,
            orderType: table ? "dine_in" : startingDelivery ? "delivery" : "takeaway", notes: null, items: lines(), sessionId, branchId,
          });
          id = created.id;
          if (startingDelivery) {
            const leg = await createDelivery.mutateAsync({
              orderId: created.id, address: dlv.address.trim(), phone: dlv.phone.trim(), deliveryZoneId: dlv.zoneId || null,
            });
            // The order is already placed; a failed assignment is reported by the hook and can be redone from the order.
            if (dlv.riderId) await assignRider.mutateAsync({ id: leg.id, driverId: dlv.riderId }).catch(() => {});
          }
        } else {
          await addItems.mutateAsync({ id: order.id, items: lines() });
        }
        setPending([]);
      }
      if (send && id) await sendKitchen.mutateAsync(id);
      if (created) onOrderCreated?.(created);
      // A waiter's next move after firing a table is another table; a counter order is paid next.
      if (send && table) onBack();
    } catch { /* the hooks show the error; new items stay on screen for a retry */ }
  };

  const handlePaid = async (paid: RestaurantOrder) => {
    if (appliedVoucher) { try { await vouchersApi.redeem(appliedVoucher, paid.subTotal); } catch { /* non-fatal */ } }
    const cash = paid.payments.some(p => p.method.toLowerCase() === "cash");
    if (cash) await openDrawer().catch(() => {});
    if (printerStatus === "ready") {
      const esc = buildEscPosReceipt({
        companyName: tenant?.name ?? "Restaurant", txnNumber: paid.orderNumber, cashierName: paid.waiter,
        currency, taxLabel: "VAT",
        cart: paid.items.map(i => ({ productId: i.menuItemId, name: i.itemName, quantity: i.quantity, price: i.unitPrice, taxRate: 5, total: i.lineTotal })),
        subtotal: paid.subTotal, discountAmount: paid.discountAmount, taxAmount: paid.taxAmount, total: paid.total,
        paymentMethod: paid.payments.length > 1 ? "Split" : (paid.payments[0]?.method ?? "Cash"),
        payments: paid.payments.map(p => ({ method: p.method, amount: p.amount })),
        tendered: 0, openDrawer: cash,
      });
      await printRaw(esc).catch(() => {});
    }
    toast.success(t("posView.drawer.billSettled"));
    const wasMain = order != null && paid.id === order.id;
    setPayTarget(null);
    // Paying one part of a split bill keeps the overview open for the next guest.
    setReceipt({ order: paid, justPaid: true, leaveAfter: wasMain });
  };

  const status = order?.status;
  const title = table ? t("posView.drawer.tableHeading", { number: table.tableNumber }) : t("posView.drawer.takeawayHeading");
  const canDeals = combos.length > 0 && order?.status === "open";
  const showDeals = catId === "deals" && canDeals && !search;

  return (
    <div className="flex h-full bg-muted/20 touch-manipulation">
      {/* ── Menu ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-3 px-4 pt-4">
          <button onClick={onBack}
            className="h-14 px-4 rounded-2xl border-2 border-border bg-card flex items-center gap-2 text-base font-extrabold hover:border-primary shrink-0">
            <ArrowLeft className="h-5 w-5 rtl:rotate-180" strokeWidth={2.5} />{t("posView.screen.back")}
          </button>
          <div className="relative flex-1">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === "Escape") setSearch(""); }}
              placeholder={t("posView.drawer.searchMenu")}
              className="w-full h-14 ps-14 pe-14 rounded-2xl border-2 border-border bg-card text-lg font-semibold placeholder:text-muted-foreground placeholder:font-medium focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/15" />
            {search && (
              <button onClick={() => setSearch("")} aria-label={t("posView.common.cancel")}
                className="absolute end-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          <Can permission="restaurant.menu.edit">
            <button onClick={() => setManageStock(m => !m)} title={t("posView.drawer.toggleAvailability")}
              className={cn("h-14 px-4 rounded-2xl border-2 flex items-center gap-2 text-base font-bold shrink-0",
                manageStock ? "bg-destructive border-destructive text-white" : "border-border bg-card hover:border-primary")}>
              <EyeOff className="h-5 w-5" /><span>{t("posView.screen.soldOutMode")}</span>
            </button>
          </Can>
        </div>

        {manageStock && (
          <p className="mx-4 mt-3 px-4 py-2.5 rounded-xl bg-destructive/10 text-destructive text-sm font-bold">
            {t("posView.screen.soldOutHint")}
          </p>
        )}

        {/* One row — wrapping pushed the dishes down as the menu grew. */}
        <CategoryRail>
          <button onClick={() => setCatId("all")} className={pill(catId === "all")}>{t("posView.drawer.all")}</button>
          {canDeals && (
            <button onClick={() => setCatId("deals")} className={pill(catId === "deals")}>
              <Sparkles className="inline h-4 w-4 me-1.5 -mt-0.5" />{t("posView.combo.deals")}
            </button>
          )}
          {menu.map(c => (
            <button key={c.id} onClick={() => setCatId(c.id)} className={pill(catId === c.id)}>{c.name}</button>
          ))}
        </CategoryRail>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {menuLoading ? (
            <div className="flex justify-center py-24"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
          ) : showDeals ? (
            <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
              {combos.map(combo => (
                <motion.button key={combo.id} whileTap={{ scale: 0.96 }} disabled={addCombo.isPending}
                  onClick={() => combo.items.some(i => i.categoryId)
                    ? setComboPicker(combo)
                    : addCombo.mutate({ id: order!.id, comboId: combo.id, selections: combo.items.map(i => ({ comboItemId: i.id, menuItemId: i.menuItemId! })) })}
                  className="min-h-[112px] p-4 rounded-2xl border-2 border-primary/40 bg-primary/5 text-start hover:border-primary disabled:opacity-50 flex flex-col">
                  <p className="text-base font-bold text-foreground leading-snug line-clamp-2 flex-1">{combo.name}</p>
                  <p className="text-xl font-black text-primary tabular-nums mt-2">{formatCurrency(combo.price, currency)}</p>
                </motion.button>
              ))}
            </div>
          ) : shownItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <UtensilsCrossed className="h-14 w-14 text-muted-foreground/30 mb-3" />
              <p className="text-xl font-extrabold text-foreground">{t("posView.drawer.noItemsFound")}</p>
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(160px,1fr))]">
              {shownItems.map(item => {
                const qty = pendingQtyByItem.get(item.id) ?? 0;
                const off = !item.isAvailable;
                const accent = CATEGORY_ACCENT[(categoryIndex.get(item.categoryId ?? "") ?? 0) % CATEGORY_ACCENT.length];
                return (
                  <motion.button key={item.id} whileTap={off && !manageStock ? undefined : { scale: 0.95 }}
                    onClick={() => tapItem(item)} disabled={(off && !manageStock) || (closed && !manageStock)}
                    className={cn("relative min-h-[112px] rounded-2xl border-2 border-s-[6px] text-start select-none flex flex-col transition-colors",
                      accent,
                      off ? "bg-muted/50 border-border opacity-60"
                        : qty > 0 ? "bg-primary/5 border-primary shadow-md"
                        : "bg-card border-border hover:border-primary hover:shadow-lg",
                      closed && !manageStock && "cursor-not-allowed")}>
                    {qty > 0 && (
                      <span className="absolute -top-2.5 -end-2.5 z-10 min-w-[2rem] h-8 px-2 rounded-full bg-primary text-primary-foreground text-base font-black flex items-center justify-center shadow-lg ring-4 ring-background">
                        {qty}
                      </span>
                    )}
                    {coverOf(item) && (
                      <DishPhoto itemId={item.id} imageId={coverOf(item)!.id} alt={item.name} className="h-24 w-full rounded-t-[0.85rem] shrink-0" />
                    )}
                    <p className="text-base font-bold text-foreground leading-snug line-clamp-2 flex-1 px-3.5 pt-3">{item.name}</p>
                    <div className="flex items-end justify-between gap-2 mt-2 px-3.5 pb-3">
                      <p className="text-lg font-black text-foreground tabular-nums">{formatCurrency(item.price, currency)}</p>
                      {off ? (
                        <span className="text-[11px] font-extrabold uppercase px-2 py-1 rounded-lg bg-destructive text-white">{t("posView.screen.soldOut")}</span>
                      ) : manageStock ? (
                        <Link to="/recipe/recipes" onClick={e => e.stopPropagation()}
                          title={recipeIds.has(item.id) ? t("posView.drawer.recipeLinked") : t("posView.drawer.recipeMissing")}
                          className={cn("p-1.5 rounded-lg", recipeIds.has(item.id) ? "text-success" : "text-muted-foreground/40")}>
                          <ChefHat className="h-4 w-4" />
                        </Link>
                      ) : item.modifierGroups.length > 0 ? (
                        <span className="text-[11px] font-bold px-2 py-1 rounded-lg bg-muted text-muted-foreground">{t("posView.screen.options")}</span>
                      ) : null}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Ticket ───────────────────────────────────────────────────────── */}
      <div className="w-[400px] xl:w-[440px] shrink-0 flex flex-col bg-card border-s-2 border-border">
        <div className="px-5 py-4 border-b-2 border-border shrink-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-2xl font-black text-foreground truncate">{title}</p>
            {status && (
              <span className={cn("px-3 py-1.5 rounded-xl text-sm font-extrabold whitespace-nowrap", ORDER_STATUS_STYLE[status])}>
                {order ? statusLabel(order) : t(`orders.status.${status}`, { defaultValue: status })}
              </span>
            )}
          </div>
          {order ? (
            <p className="text-sm font-semibold text-muted-foreground mt-0.5 truncate">
              {order.orderNumber} · {t("posView.screen.guestCount", { count: order.covers })}{isDelivery ? ` · ${order.waiter}` : ""}
            </p>
          ) : table ? (
            <div className="flex items-center justify-between mt-2">
              <span className="text-base font-bold text-muted-foreground flex items-center gap-2"><Users className="h-5 w-5" />{t("posView.screen.guests")}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setCovers(c => Math.max(1, c - 1))} className="h-10 w-10 rounded-xl border-2 border-border flex items-center justify-center hover:border-primary"><Minus className="h-4 w-4" strokeWidth={3} /></button>
                <span className="w-8 text-center text-xl font-black tabular-nums">{covers}</span>
                <button onClick={() => setCovers(c => c + 1)} className="h-10 w-10 rounded-xl border-2 border-border flex items-center justify-center hover:border-primary"><Plus className="h-4 w-4" strokeWidth={3} /></button>
              </div>
            </div>
          ) : startingDelivery ? (
            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input value={dlv.name} onChange={e => setDlv(d => ({ ...d, name: e.target.value }))}
                  placeholder={t("posView.newDelivery.guestName")} className={dlvInput} />
                <input value={dlv.phone} onChange={e => setDlv(d => ({ ...d, phone: e.target.value }))} inputMode="tel"
                  placeholder={t("posView.newDelivery.phone")} className={dlvInput} />
              </div>
              <input value={dlv.address} onChange={e => setDlv(d => ({ ...d, address: e.target.value }))}
                placeholder={t("posView.newDelivery.address")} className={dlvInput} />
              <div className="grid grid-cols-2 gap-2">
                {zones.length > 0 && (
                  <select value={dlv.zoneId} onChange={e => setDlv(d => ({ ...d, zoneId: e.target.value }))} className={dlvInput}>
                    <option value="">{t("posView.newDelivery.noZone")}</option>
                    {zones.filter(z => z.isActive).map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                  </select>
                )}
                <button onClick={() => setDialog("rider")}
                  className={cn(dlvInput, "flex items-center gap-2 text-start", zones.length === 0 && "col-span-2",
                    pickedRider ? "" : "border-warning bg-warning/10 text-warning")}>
                  <Bike className="h-5 w-5 shrink-0" />
                  <span className="truncate">{pickedRider ? pickedRider.name : t("posView.screen.assignRider")}</span>
                </button>
              </div>
              {!dlvReady && <p className="text-xs font-bold text-warning">{t("posView.newDelivery.needDetails")}</p>}
            </div>
          ) : (
            <p className="text-sm font-semibold text-muted-foreground mt-0.5">{t("posView.drawer.counterPickup")}</p>
          )}
          {order?.status !== "paid" && order?.status !== "cancelled" && (
            <div className="flex gap-2 flex-wrap mt-3">
              {!isDelivery && (
                <Can permission="restaurant.orders.edit" fallback={<span className={cn(chipCls, "border-border")}><UserRound className="h-5 w-5" />{waiterName}</span>}>
                  <button onClick={() => setDialog("waiter")} title={t("posView.screen.waiterTitle")} className={cn(chipCls, "border-border hover:border-primary")}>
                    <UserRound className="h-5 w-5 shrink-0" /><span className="truncate">{waiterName}</span>
                  </button>
                </Can>
              )}
              {isDelivery && order && <RiderChip orderId={order.id} />}
            </div>
          )}
          {order && <OrderCustomer order={order} currency={currency} />}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* A table that is being cleaned or held for a booking says so, with the way out. */}
          {table && !order && table.status !== "available" && table.status !== "occupied" && (
            <div className="rounded-2xl border-2 border-warning/40 bg-warning/10 p-3 flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-foreground">
                {t("posView.screen.tableIs", { status: t(`posView.tableStatus.${table.status}`) })}
              </p>
              <Can permission="restaurant.tables.edit">
                <button disabled={setTableStatus.isPending} onClick={() => setTableStatus.mutate({ id: table.id, status: "available" })}
                  className="h-10 px-3 rounded-xl bg-success text-white text-sm font-extrabold whitespace-nowrap disabled:opacity-50">
                  {t("posView.screen.markAvailable")}
                </button>
              </Can>
            </div>
          )}

          {/* New, unsent items */}
          {pending.length > 0 && (
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-primary mb-2">
                {t("posView.screen.newItems")} · {pendingCount}
              </p>
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {pending.map(p => (
                    <motion.div key={p.key} layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                      className="rounded-2xl border-2 border-primary/40 bg-primary/5 px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-bold text-foreground leading-tight truncate">{p.menuItem.name}</p>
                          {lineMods(p).length > 0 && <p className="text-sm font-semibold text-primary truncate">{lineMods(p).map(m => m.name).join(", ")}</p>}
                          <p className="text-sm font-semibold text-muted-foreground tabular-nums">{formatCurrency(lineUnit(p) * p.quantity, currency)}</p>
                        </div>
                        <button onClick={() => changeQty(p.key, -1)} aria-label="-"
                          className="h-11 w-11 rounded-xl border-2 border-border bg-background flex items-center justify-center hover:border-destructive hover:text-destructive active:scale-95">
                          {p.quantity === 1 ? <Trash2 className="h-4 w-4" /> : <Minus className="h-4 w-4" strokeWidth={3} />}
                        </button>
                        <span className="w-7 text-center text-xl font-black tabular-nums">{p.quantity}</span>
                        <button onClick={() => changeQty(p.key, 1)} aria-label="+"
                          className="h-11 w-11 rounded-xl border-2 border-border bg-background flex items-center justify-center hover:border-primary hover:text-primary active:scale-95">
                          <Plus className="h-4 w-4" strokeWidth={3} />
                        </button>
                      </div>
                      {noteFor === p.key || p.note ? (
                        <input autoFocus={noteFor === p.key} value={p.note}
                          onChange={e => setPending(prev => prev.map(x => x.key === p.key ? { ...x, note: e.target.value } : x))}
                          onBlur={() => setNoteFor(null)} placeholder={t("posView.screen.notePlaceholder")}
                          className="mt-2 w-full h-10 px-3 rounded-xl border-2 border-border bg-background text-sm font-semibold focus:outline-none focus:border-primary" />
                      ) : (
                        <button onClick={() => setNoteFor(p.key)} className="mt-1 h-10 flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-primary">
                          <MessageSquarePlus className="h-4 w-4" />{t("posView.screen.addNote")}
                        </button>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Split bill — the parent holds no items; each part is paid on its own. */}
          {order?.status === "split" ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-muted-foreground">{t("posView.drawer.splitInto", { count: order.splits.length })}</p>
              {order.splits.map(s => (
                <div key={s.id} className="flex items-center justify-between gap-3 p-3 rounded-2xl border-2 border-border">
                  <div className="min-w-0">
                    <p className="text-lg font-black tabular-nums">{formatCurrency(s.total, currency)}</p>
                    <p className="text-xs font-semibold text-muted-foreground truncate">{s.orderNumber}</p>
                  </div>
                  {s.status === "paid" ? (
                    <span className="text-base font-extrabold text-success flex items-center gap-1.5"><CheckCircle2 className="h-5 w-5" />{t("posView.drawer.paid")}</span>
                  ) : (
                    <Can permission="restaurant.orders.edit">
                      <button onClick={() => { const full = allOrders.find(o => o.id === s.id); if (full) setPayTarget(full); }}
                        className="h-12 px-5 rounded-xl bg-success text-white text-base font-black">
                        {t("posView.screen.pay", { amount: formatCurrency(s.outstanding, currency) })}
                      </button>
                    </Can>
                  )}
                </div>
              ))}
            </div>
          ) : order && order.items.length > 0 ? (
            <div>
              {pending.length > 0 && (
                <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground mb-2">{t("posView.screen.onOrder")}</p>
              )}
              <div className="divide-y divide-border">
                {order.items.map(item => (
                  <div key={item.id} className="flex items-start gap-3 py-2.5">
                    <span className="min-w-[2rem] h-8 px-1.5 rounded-lg bg-muted text-base font-black flex items-center justify-center tabular-nums shrink-0">{item.quantity}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold text-foreground leading-tight">{item.itemName}</p>
                      {item.selectedModifiers.length > 0 && <p className="text-sm font-semibold text-primary">{item.selectedModifiers.map(m => m.name).join(", ")}</p>}
                      {item.modifiers && <p className="text-sm font-semibold text-warning italic">{item.modifiers}</p>}
                    </div>
                    <p className="text-base font-black tabular-nums shrink-0">{formatCurrency(item.lineTotal, currency)}</p>
                    {live && (
                      <Can permission="restaurant.orders.void">
                        <button onClick={() => setVoidTarget(item.id)} aria-label={t("posView.drawer.voidItemTitle")}
                          className="h-11 w-11 -me-2 -my-1 rounded-xl text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive flex items-center justify-center shrink-0">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </Can>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : pending.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-10 text-center px-6">
              <div className="w-20 h-20 rounded-3xl bg-muted flex items-center justify-center mb-4">
                <UtensilsCrossed className="h-10 w-10 text-muted-foreground" />
              </div>
              <p className="text-xl font-extrabold text-foreground">{t("posView.screen.emptyTitle")}</p>
              <p className="text-base font-medium text-muted-foreground mt-1">{t("posView.screen.emptyHint")}</p>
            </div>
          ) : null}
        </div>

        {/* Totals + the next step */}
        <div className="p-4 border-t-2 border-border shrink-0 space-y-3">
          {order && order.status !== "split" && (
            <div className="space-y-1">
              <div className="flex justify-between text-base font-semibold text-muted-foreground">
                <span>{t("posView.drawer.subtotal")}</span><span className="tabular-nums text-foreground">{formatCurrency(order.subTotal, currency)}</span>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-base font-bold text-success">
                  <span>{t("posView.drawer.discount")}</span><span className="tabular-nums">-{formatCurrency(order.discountAmount, currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-semibold text-muted-foreground">
                <span>{t("posView.drawer.vat")}</span><span className="tabular-nums text-foreground">{formatCurrency(order.taxAmount, currency)}</span>
              </div>
              {order.amountPaid > 0 && order.status !== "paid" && (
                <div className="flex justify-between text-base font-bold text-primary">
                  <span>{t("posView.drawer.paidSoFar")}</span><span className="tabular-nums">{formatCurrency(order.amountPaid, currency)}</span>
                </div>
              )}
            </div>
          )}
          {(order ? order.status !== "split" : pending.length > 0) && (
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-900 text-white px-4 py-3 dark:bg-slate-800">
              <span className="text-base font-extrabold uppercase tracking-wide">
                {t("posView.drawer.total")}
                {order && pending.length > 0 && <span className="block text-xs font-bold normal-case text-slate-400">+ {formatCurrency(pendingTotal, currency)} {t("posView.screen.newItems").toLowerCase()}</span>}
              </span>
              <span className="text-3xl font-black tabular-nums truncate">{formatCurrency(order ? order.total : pendingTotal, currency)}</span>
            </div>
          )}

          {/* Everything else you can do — always labelled, hidden while new items are waiting. */}
          {live && pending.length === 0 && (
            <div className="flex gap-2 flex-wrap">
              <Can permission="restaurant.orders.discount">
                <ActionButton icon={Tag} label={t("posView.drawer.discount")} onClick={() => setDialog("discount")} />
              </Can>
              <Can permission="restaurant.orders.edit">
                {order!.items.length >= 2 && <ActionButton icon={SplitSquareHorizontal} label={t("posView.screen.split")} onClick={() => setDialog("split")} />}
                {table && <ActionButton icon={ArrowRightLeft} label={t("posView.screen.move")} onClick={() => setDialog("move")} />}
                <ActionButton icon={ChefHat} label={t("posView.screen.nextCourse")} busy={fireCourse.isPending} onClick={() => fireCourse.mutate(order!.id)} />
                {status === "open" && <ActionButton icon={PauseCircle} label={t("posView.screen.hold")} busy={holdOrder.isPending} onClick={() => holdOrder.mutate(order!.id)} />}
              </Can>
              <Can permission="restaurant.orders.void">
                <ActionButton icon={Ban} danger label={t("posView.screen.cancel")} onClick={() => setDialog("cancel")} />
              </Can>
            </div>
          )}

          {/* One obvious next step */}
          <div className="flex gap-2">
            {pending.length > 0 ? (
              <>
                <button disabled={saving || !dlvReady} onClick={() => submit(false)} className={cn(bigBtn, "w-28 border-2 border-border text-base")}>
                  <Save className="h-5 w-5" />{t("posView.screen.save")}
                </button>
                <button disabled={saving || !dlvReady} onClick={() => submit(true)} className={cn(bigBtn, "flex-1 bg-primary text-primary-foreground shadow-lg shadow-primary/30")}>
                  {saving ? <Loader2 className="h-6 w-6 animate-spin" /> : <><Send className="h-5 w-5 rtl:-scale-x-100" />{t("posView.screen.sendCount", { count: pendingCount })}</>}
                </button>
              </>
            ) : !order ? (
              <button disabled className={cn(bigBtn, "flex-1 bg-muted text-muted-foreground")}>
                <Send className="h-5 w-5 rtl:-scale-x-100" />{t("posView.drawer.sendToKitchen")}
              </button>
            ) : status === "open" ? (
              <>
                <button onClick={() => setPayTarget(order)} className={cn(bigBtn, "w-32 border-2 border-border text-base")}>
                  <Receipt className="h-5 w-5" />{t("posView.common.pay")}
                </button>
                <button disabled={saving || order.items.length === 0} onClick={() => submit(true)} className={cn(bigBtn, "flex-1 bg-primary text-primary-foreground shadow-lg shadow-primary/30")}>
                  {saving ? <Loader2 className="h-6 w-6 animate-spin" /> : <><Send className="h-5 w-5 rtl:-scale-x-100" />{t("posView.drawer.sendToKitchen")}</>}
                </button>
              </>
            ) : status === "sent" || status === "ready" || status === "served" ? (
              <>
                {status !== "served" && (
                  <button disabled={serveOrder.isPending} onClick={() => serveOrder.mutate(order.id)} className={cn(bigBtn, "w-36 border-2 border-border text-base")}>
                    {serveOrder.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <><CheckCircle2 className="h-5 w-5" />{isDelivery ? t("delivery.status.delivered") : t("posView.screen.served")}</>}
                  </button>
                )}
                <button onClick={() => setPayTarget(order)} className={cn(bigBtn, "flex-1 bg-success text-white shadow-lg shadow-success/30")}>
                  <Receipt className="h-5 w-5" />{t("posView.screen.pay", { amount: formatCurrency(order.outstanding, currency) })}
                </button>
              </>
            ) : status === "held" ? (
              <Can permission="restaurant.orders.edit">
                <button disabled={recallOrder.isPending} onClick={() => recallOrder.mutate(order.id)} className={cn(bigBtn, "flex-1 bg-primary text-primary-foreground")}>
                  {recallOrder.isPending ? <Loader2 className="h-6 w-6 animate-spin" /> : <><PlayCircle className="h-5 w-5" />{t("posView.drawer.recallOrder")}</>}
                </button>
              </Can>
            ) : status === "paid" ? (
              <>
                <button onClick={() => setReceipt({ order, justPaid: false, leaveAfter: false })} className={cn(bigBtn, "flex-1 border-2 border-border text-base")}>
                  <Receipt className="h-5 w-5" />{t("posView.receiptView.view")}
                </button>
                <Can permission="restaurant.orders.edit">
                  <button onClick={() => setDialog("receipt")} className={cn(bigBtn, "flex-1 border-2 border-border text-base")}>
                    <Mail className="h-5 w-5" />{t("posView.receipt.title")}
                  </button>
                </Can>
                {order.amountPaid > 0 && (
                  <Can permission="restaurant.orders.refund">
                    <button onClick={() => setDialog("refund")} className={cn(bigBtn, "flex-1 border-2 border-destructive/40 text-destructive text-base")}>
                      <RotateCcw className="h-5 w-5" />{t("posView.drawer.refund")}
                    </button>
                  </Can>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Prompts ──────────────────────────────────────────────────────── */}
      {payTarget && (
        <RestaurantPayDialog order={payTarget} currency={currency} onPaid={handlePaid} onClose={() => setPayTarget(null)} />
      )}
      {optionsItem && (
        <OptionsSheet item={optionsItem} currency={currency}
          onConfirm={ids => { addLine(optionsItem, ids); setOptionsItem(null); }} onCancel={() => setOptionsItem(null)} />
      )}
      {comboPicker && order && (
        <ComboPickerModal combo={comboPicker} menu={menu} busy={addCombo.isPending}
          onConfirm={selections => addCombo.mutate({ id: order.id, comboId: comboPicker.id, selections }, { onSuccess: () => setComboPicker(null) })}
          onCancel={() => setComboPicker(null)} />
      )}
      {dialog === "rider" && (
        <PersonSheet title={t("posView.screen.riderTitle")} loading={ridersLoading} currentName={pickedRider?.name}
          emptyText={t("posView.screen.noRiders")}
          people={byAvailability(riders).map(d => ({ id: d.id, name: d.name, detail: riderDetail(d, t) }))}
          onPick={p => { setRiderTouched(true); setDlv(d => ({ ...d, riderId: p.id })); setDialog(null); }}
          onClose={() => setDialog(null)} />
      )}
      {dialog === "waiter" && (
        <PersonSheet title={t("posView.screen.waiterTitle")} people={staff} loading={staffLoading} busy={setOrderWaiter.isPending}
          currentName={waiterName} emptyText={t("posView.screen.noStaff")}
          onPick={p => {
            if (!order) { setWaiter(p.name); setDialog(null); return; }
            setOrderWaiter.mutate({ id: order.id, waiter: p.name }, { onSuccess: () => setDialog(null) });
          }}
          onClose={() => setDialog(null)} />
      )}
      {dialog === "discount" && order && (
        <DiscountSheet order={order} currency={currency} onVoucher={setAppliedVoucher} onClose={() => setDialog(null)} />
      )}
      {dialog === "split" && order && (
        <SplitBillModal order={order} currency={currency} busy={splitOrder.isPending}
          onConfirm={groups => splitOrder.mutate({ id: order.id, groups }, { onSuccess: () => setDialog(null) })}
          onCancel={() => setDialog(null)} />
      )}
      {receipt && (
        <OrderReceiptModal order={receipt.order} currency={currency} justPaid={receipt.justPaid}
          onClose={() => { const leave = receipt.leaveAfter; setReceipt(null); if (leave) onBack(); }} />
      )}
      {dialog === "move" && order && (
        <MoveTableSheet tables={tables} busy={transferTable.isPending}
          onPick={toTableId => transferTable.mutate({ id: order.id, toTableId }, { onSuccess: () => { setDialog(null); onBack(); } })}
          onClose={() => setDialog(null)} />
      )}
      {voidTarget && order && (
        <ReasonModal title={t("posView.drawer.voidItemTitle")} danger busy={voidItem.isPending}
          onConfirm={reason => { voidItem.mutate({ id: order.id, itemId: voidTarget, reason }); setVoidTarget(null); }}
          onCancel={() => setVoidTarget(null)} />
      )}
      {dialog === "cancel" && order && (
        <ReasonModal title={t("posView.drawer.cancelOrderTitle")} danger busy={cancelOrder.isPending}
          onConfirm={reason => cancelOrder.mutate({ id: order.id, reason }, { onSuccess: () => { setDialog(null); onBack(); } })}
          onCancel={() => setDialog(null)} />
      )}
      {dialog === "refund" && order && (
        <RefundModal order={order} currency={currency} busy={refundOrder.isPending}
          onConfirm={(amount, reason, method) => { refundOrder.mutate({ id: order.id, amount, reason, method }); setDialog(null); }}
          onCancel={() => setDialog(null)} />
      )}
      {dialog === "receipt" && order && (
        <SendReceiptModal busy={sendReceipt.isPending}
          onConfirm={(channel, recipientAddress) => { sendReceipt.mutate({ orderId: order.id, channel, recipientAddress }); setDialog(null); }}
          onCancel={() => setDialog(null)} />
      )}
    </div>
  );
}
