import * as React from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LeftDrawer } from "@/components/ui/left-drawer";
import { cn, formatCurrency } from "@/lib/utils";
import {
  X, Plus, Minus, UtensilsCrossed, ChevronRight, Users,
  Search, Receipt, Trash2, Send, CheckCircle2, Ban, Loader2, EyeOff, Eye,
  Tag, Percent, Ticket, ChevronDown, RotateCcw, SplitSquareHorizontal,
  PauseCircle, PlayCircle, UtensilsCrossed as ComboIcon, ChefHat, Mail,
} from "lucide-react";
import {
  useTables, useTablesSummary, useMenu, useOrders, useOrdersSummary,
  useCreateOrder, useAddItems, useVoidItem, useSendToKitchen, useServeOrder,
  useCancelOrder, useSetItemAvailability, useApplyOrderDiscount, useRemoveOrderDiscount,
  useRefundOrder, useSplitOrder, useHoldOrder, useRecallOrder,
  useCombos, useAddCombo, useFireNextCourse,
  useCreateDeliveryOrder, useDeliveryZones, useSendReceipt,
} from "@/hooks/restaurant/use-restaurant";
import { useRecipes } from "@/hooks/recipe/use-recipe";
import { useCurrentBranch } from "@/hooks/restaurant/use-current-branch";
import { useDeviceRegistration } from "@/hooks/restaurant/use-devices";
import { BranchSwitcher } from "./branch-switcher";
import type { DiscountType, RestaurantTable, RestaurantOrder, MenuItem, MenuCategory, TableStatus, Combo, ComboSelectionInput } from "@/lib/restaurant/restaurant.api";
import { AddTableForm } from "./add-table-form";
import { RestaurantPayDialog } from "./restaurant-pay-dialog";
import { useHardware }        from "@/contexts/hardware-context";
import { HardwareStatusBar }  from "@/components/pos/hardware-status-bar";
import { buildEscPosReceipt } from "@/lib/pos/receipt-escpos";
import { vouchersApi } from "@/lib/pos/vouchers.api";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth.store";
import { Can } from "@/components/auth/can";
import { useShift } from "@/modules/pos/retail/components/shift-gate";
import { useRestaurantRealtime } from "@/hooks/restaurant/use-restaurant-realtime";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";

const TABLE_STATUS: Record<TableStatus, { color: string; bg: string; border: string; dot: string }> = {
  available: { color: "text-success",          bg: "bg-success/10",  border: "border-success/30",  dot: "bg-success" },
  occupied:  { color: "text-primary",          bg: "bg-primary/10",  border: "border-primary/30",  dot: "bg-primary" },
  reserved:  { color: "text-blue-500",         bg: "bg-blue-500/10", border: "border-blue-500/30", dot: "bg-blue-500" },
  cleaning:  { color: "text-muted-foreground", bg: "bg-muted/20",    border: "border-border",      dot: "bg-muted-foreground" },
};
const tableStatusLabel = (status: TableStatus) => i18n.t(`restaurant:posView.tableStatus.${status}`);

// Colours only — the display label comes from the shared `orders.status.*` vocabulary.
const ORDER_STATUS: Record<string, { color: string; bg: string }> = {
  open:      { color: "text-muted-foreground", bg: "bg-muted/30" },
  sent:      { color: "text-warning",          bg: "bg-warning/10" },
  ready:     { color: "text-success",          bg: "bg-success/10" },
  served:    { color: "text-primary",          bg: "bg-primary/10" },
  paid:      { color: "text-foreground",       bg: "bg-muted/20" },
  cancelled: { color: "text-destructive",      bg: "bg-destructive/10" },
  split:     { color: "text-blue-500",         bg: "bg-blue-500/10" },
  held:      { color: "text-amber-500",        bg: "bg-amber-500/10" },
};
const orderStatusLabel = (status: string) =>
  i18n.t(`restaurant:orders.status.${status}`, { defaultValue: status });

const SECTION_EMOJI: Record<string, string> = { indoor: "🏠", outdoor: "☀️", terrace: "🌅", private: "🍽️", vip: "⭐", bar: "🍸" };
// Section names are tenant-entered free text — translate the known ones, fall back to the raw value.
const sectionLabel = (s: string) =>
  `${SECTION_EMOJI[s] ?? "🍽️"} ${i18n.t(`restaurant:posView.section.${s}`, { defaultValue: s.charAt(0).toUpperCase() + s.slice(1) })}`;

function StatCard({ label, value, accent = "bg-primary" }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className={`w-1.5 h-1.5 rounded-full ${accent} mb-2`} />
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function TableCard({ table, order, currency, onClick }: {
  table: RestaurantTable; order: RestaurantOrder | undefined; currency: string; onClick: () => void;
}) {
  const { t } = useTranslation("restaurant");
  const cfg = TABLE_STATUS[table.status];
  return (
    <button onClick={onClick}
      className={`bg-card border rounded-xl p-4 text-left transition-all hover:shadow-md group relative ${cfg.border}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-2xl font-bold text-foreground">{table.tableNumber}</p>
          <p className="text-xs text-muted-foreground">{sectionLabel(table.section)}</p>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{tableStatusLabel(table.status)}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-1">
        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {t("posView.card.capacity", { n: table.capacity })}</span>
        {table.currentWaiter && <span className="truncate">{table.currentWaiter}</span>}
      </div>
      {order && (
        <p className="text-xs font-medium text-primary mt-1">
          {order.orderNumber.slice(-8)} · {formatCurrency(order.total, currency)} · {orderStatusLabel(order.status)}
        </p>
      )}
      <ChevronRight className="absolute right-3 bottom-3 w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

// ─── Reason prompt (void item / cancel order — reason required, no window.prompt) ─────────
function ReasonModal({ title, danger, busy, onConfirm, onCancel }: {
  title: string; danger?: boolean; busy?: boolean;
  onConfirm: (reason: string) => void; onCancel: () => void;
}) {
  const { t } = useTranslation("restaurant");
  const [reason, setReason] = React.useState("");
  return (
    <LeftDrawer onClose={onCancel} widthClassName="max-w-sm" zIndexClassName="z-[60]">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <textarea
        autoFocus rows={3} value={reason} onChange={e => setReason(e.target.value)}
        placeholder={t("posView.reason.placeholder")}
        className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={onCancel}>{t("posView.common.cancel")}</Button>
        <Button size="sm" className={cn("flex-1", danger && "bg-destructive hover:bg-destructive/90")}
          disabled={!reason.trim() || busy} onClick={() => onConfirm(reason.trim())}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("posView.common.confirm")}
        </Button>
      </div>
    </LeftDrawer>
  );
}

// ─── Refund prompt (amount + method + reason) ──────────────────────────────────
function RefundModal({ order, currency, busy, onConfirm, onCancel }: {
  order: RestaurantOrder; currency: string; busy?: boolean;
  onConfirm: (amount: number, reason: string, method: string) => void; onCancel: () => void;
}) {
  const { t } = useTranslation("restaurant");
  const [amount, setAmount] = React.useState(String(order.amountPaid));
  const [method, setMethod] = React.useState(order.paymentMethod ?? "Cash");
  const [reason, setReason] = React.useState("");
  const amt = parseFloat(amount) || 0;
  const valid = amt > 0 && amt <= order.amountPaid && reason.trim().length > 0;

  return (
    <LeftDrawer onClose={onCancel} widthClassName="max-w-sm" zIndexClassName="z-[60]">
      <p className="text-sm font-semibold text-foreground">{t("posView.refund.title")}</p>
      <div>
        <label className="text-xs text-muted-foreground">{t("posView.refund.amountLabel", { max: formatCurrency(order.amountPaid, currency) })}</label>
        <Input type="number" min={0} max={order.amountPaid} value={amount}
          onChange={e => setAmount(e.target.value)} className="h-8 text-sm mt-1" />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">{t("posView.refund.method")}</label>
        <Input value={method} onChange={e => setMethod(e.target.value)} className="h-8 text-sm mt-1" />
      </div>
      <textarea
        rows={2} value={reason} onChange={e => setReason(e.target.value)}
        placeholder={t("posView.reason.placeholder")}
        className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={onCancel}>{t("posView.common.cancel")}</Button>
        <Button size="sm" className="flex-1 bg-destructive hover:bg-destructive/90"
          disabled={!valid || busy} onClick={() => onConfirm(amt, reason.trim(), method.trim() || "Cash")}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("posView.refund.submit")}
        </Button>
      </div>
    </LeftDrawer>
  );
}

// ─── Modifier picker (structured, priced modifiers — replaces free-text-only add) ──────────
function ModifierPickerModal({ item, currency, onConfirm, onCancel }: {
  item: MenuItem; currency: string;
  onConfirm: (selectedModifierIds: string[]) => void; onCancel: () => void;
}) {
  const { t } = useTranslation("restaurant");
  // groupId -> selected modifier ids (radio for maxSelect===1, checkboxes otherwise)
  const [selections, setSelections] = React.useState<Record<string, string[]>>({});

  const toggle = (groupId: string, modId: string, maxSelect: number) => {
    setSelections(prev => {
      const current = prev[groupId] ?? [];
      if (maxSelect === 1) return { ...prev, [groupId]: current[0] === modId ? [] : [modId] };
      if (current.includes(modId)) return { ...prev, [groupId]: current.filter(id => id !== modId) };
      if (current.length >= maxSelect) return prev; // at cap — ignore further picks
      return { ...prev, [groupId]: [...current, modId] };
    });
  };

  const allValid = item.modifierGroups.every(g => {
    const count = (selections[g.id] ?? []).length;
    return count >= g.minSelect && count <= g.maxSelect;
  });

  const deltaTotal = item.modifierGroups.reduce((sum, g) => {
    const chosen = selections[g.id] ?? [];
    return sum + g.modifiers.filter(m => chosen.includes(m.id)).reduce((s, m) => s + m.priceDelta, 0);
  }, 0);

  return (
    <LeftDrawer onClose={onCancel} widthClassName="max-w-sm" zIndexClassName="z-[70]">
      <div className="-mx-5 -mt-5 px-5 py-4 border-b border-border">
        <p className="text-sm font-bold text-foreground">{item.name}</p>
        <p className="text-xs text-muted-foreground">{formatCurrency(item.price + deltaTotal, currency)}</p>
      </div>
      <div className="space-y-4">
          {item.modifierGroups.map(g => (
            <div key={g.id}>
              <p className="text-xs font-semibold text-foreground mb-1.5">
                {g.name}
                {g.minSelect > 0 && <span className="text-destructive"> *</span>}
                <span className="text-muted-foreground font-normal ml-1">
                  {g.maxSelect === 1
                    ? t("posView.modifier.chooseOne")
                    : g.minSelect > 0
                      ? t("posView.modifier.chooseUpToMin", { max: g.maxSelect, min: g.minSelect })
                      : t("posView.modifier.chooseUpTo", { max: g.maxSelect })}
                </span>
              </p>
              <div className="space-y-1">
                {g.modifiers.filter(m => m.isActive).map(m => {
                  const checked = (selections[g.id] ?? []).includes(m.id);
                  return (
                    <button key={m.id} onClick={() => toggle(g.id, m.id, g.maxSelect)}
                      className={cn("w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs",
                        checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30")}>
                      <span className="flex items-center gap-2">
                        <span className={cn("w-3.5 h-3.5 border flex items-center justify-center shrink-0",
                          g.maxSelect === 1 ? "rounded-full" : "rounded",
                          checked ? "bg-primary border-primary" : "border-muted-foreground")}>
                          {checked && <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />}
                        </span>
                        {m.name}
                      </span>
                      {m.priceDelta !== 0 && (
                        <span className="text-muted-foreground">{m.priceDelta > 0 ? "+" : ""}{formatCurrency(m.priceDelta, currency)}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
      </div>
      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="sm" className="flex-1" onClick={onCancel}>{t("posView.common.cancel")}</Button>
        <Button size="sm" className="flex-1" disabled={!allValid}
          onClick={() => onConfirm(Object.values(selections).flat())}>
          {t("posView.modifier.addWithPrice", { price: formatCurrency(item.price + deltaTotal, currency) })}
        </Button>
      </div>
    </LeftDrawer>
  );
}

// ─── Split bill (assign each item to a guest bucket, each becomes an independently-payable order) ──
function SplitBillModal({ order, currency, busy, onConfirm, onCancel }: {
  order: RestaurantOrder; currency: string; busy?: boolean;
  onConfirm: (groups: { itemIds: string[] }[]) => void; onCancel: () => void;
}) {
  const { t } = useTranslation("restaurant");
  const [bucketCount, setBucketCount] = React.useState(2);
  // itemId -> bucket index (0-based); unset = unassigned
  const [assignment, setAssignment] = React.useState<Record<string, number>>({});

  const items = order.items;
  const allAssigned = items.every(i => assignment[i.id] !== undefined);
  const usedBuckets = new Set(Object.values(assignment)).size;

  const bucketTotal = (idx: number) =>
    items.filter(i => assignment[i.id] === idx).reduce((s, i) => s + i.lineTotal, 0);

  const handleConfirm = () => {
    const groups = Array.from({ length: bucketCount }, (_, idx) => ({
      itemIds: items.filter(i => assignment[i.id] === idx).map(i => i.id),
    })).filter(g => g.itemIds.length > 0);
    onConfirm(groups);
  };

  return (
    <LeftDrawer onClose={onCancel} widthClassName="max-w-lg" zIndexClassName="z-[70]">
      <div className="-mx-5 -mt-5 px-5 py-4 border-b border-border flex items-center justify-between">
        <p className="text-sm font-bold text-foreground">{t("posView.split.title")}</p>
        <div className="flex items-center gap-2">
          <button onClick={() => setBucketCount(n => Math.max(2, n - 1))}
            className="w-6 h-6 rounded bg-muted flex items-center justify-center"><Minus className="w-3 h-3" /></button>
          <span className="text-xs font-semibold w-16 text-center">{t("posView.split.guests", { n: bucketCount })}</span>
          <button onClick={() => setBucketCount(n => n + 1)}
            className="w-6 h-6 rounded bg-muted flex items-center justify-center"><Plus className="w-3 h-3" /></button>
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="text-[11px] text-muted-foreground mb-2">{t("posView.split.assignHint")}</p>
          {items.map(item => (
            <div key={item.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-border/50 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-foreground truncate">×{item.quantity} {item.itemName}</p>
                <p className="text-[10px] text-muted-foreground">{formatCurrency(item.lineTotal, currency)}</p>
              </div>
              <div className="flex gap-1 shrink-0 flex-wrap justify-end max-w-[180px]">
                {Array.from({ length: bucketCount }, (_, idx) => (
                  <button key={idx} onClick={() => setAssignment(prev => ({ ...prev, [item.id]: idx }))}
                    className={cn("w-7 h-7 rounded-lg border text-[10px] font-bold flex items-center justify-center shrink-0",
                      assignment[item.id] === idx ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40")}>
                    {idx + 1}
                  </button>
                ))}
              </div>
            </div>
          ))}
      </div>
      <div className="pt-2 space-y-3">
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(bucketCount, 4)}, minmax(0, 1fr))` }}>
          {Array.from({ length: bucketCount }, (_, idx) => (
            <div key={idx} className="rounded-lg bg-muted/30 px-2 py-1.5 text-center">
              <p className="text-[9px] text-muted-foreground">{t("posView.split.guestLabel", { n: idx + 1 })}</p>
              <p className="text-xs font-bold">{formatCurrency(bucketTotal(idx), currency)}</p>
            </div>
          ))}
        </div>
        {!allAssigned && <p className="text-[11px] text-warning">{t("posView.split.mustAssignAll")}</p>}
        {allAssigned && usedBuckets < 2 && <p className="text-[11px] text-warning">{t("posView.split.minTwoGuests")}</p>}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onCancel}>{t("posView.common.cancel")}</Button>
          <Button size="sm" className="flex-1" disabled={!allAssigned || usedBuckets < 2 || busy} onClick={handleConfirm}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("posView.split.submit")}
          </Button>
        </div>
      </div>
    </LeftDrawer>
  );
}

// ─── Combo picker — resolve each "choose one" slot before ordering a combo ────
function ComboPickerModal({ combo, menu, busy, onConfirm, onCancel }: {
  combo: Combo; menu: MenuCategory[]; busy: boolean;
  onConfirm: (selections: ComboSelectionInput[]) => void; onCancel: () => void;
}) {
  const { t } = useTranslation("restaurant");
  const [choices, setChoices] = React.useState<Record<string, string>>({});
  const choiceSlots = combo.items.filter(i => i.categoryId);
  const allChosen = choiceSlots.every(s => !!choices[s.id]);

  const itemsInCategory = (categoryId: string) => menu.find(c => c.id === categoryId)?.items ?? [];

  const handleConfirm = () => {
    const selections: ComboSelectionInput[] = combo.items.map(slot => ({
      comboItemId: slot.id,
      menuItemId: slot.menuItemId ?? choices[slot.id],
    }));
    onConfirm(selections);
  };

  return (
    <LeftDrawer onClose={onCancel} widthClassName="max-w-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{combo.name}</p>
        <button onClick={onCancel}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>

      <div className="space-y-3">
          {combo.items.map(slot => (
            <div key={slot.id}>
              {slot.categoryId ? (
                <>
                  <label className="text-xs text-muted-foreground">{t("posView.combo.chooseOne", { category: slot.categoryName })}</label>
                  <select value={choices[slot.id] ?? ""} onChange={e => setChoices(prev => ({ ...prev, [slot.id]: e.target.value }))}
                    className="w-full h-9 text-sm rounded-md border border-border bg-card px-2 mt-1">
                    <option value="">{t("posView.combo.select")}</option>
                    {itemsInCategory(slot.categoryId).map(mi => <option key={mi.id} value={mi.id}>{mi.name}</option>)}
                  </select>
                </>
              ) : (
                <p className="text-sm text-foreground">{slot.quantity}× {slot.menuItemName}</p>
              )}
            </div>
          ))}
      </div>

      <Button className="w-full" disabled={!allChosen || busy} onClick={handleConfirm}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("posView.combo.add", { name: combo.name })}
      </Button>
    </LeftDrawer>
  );
}

// ─── Order Drawer ─────────────────────────────────────────────────────────────
interface PendingLine { menuItem: MenuItem; quantity: number; modifiers: string; selectedModifierIds: string[] }

function OrderDrawer({ table, order, allOrders, isTakeaway, currency, onClose, onOrderCreated }: {
  table: RestaurantTable | null; order: RestaurantOrder | null; allOrders: RestaurantOrder[]; isTakeaway: boolean;
  currency: string; onClose: () => void; onOrderCreated?: (orderId: string) => void;
}) {
  const { t } = useTranslation("restaurant");
  const { user } = useAuthStore();
  const { sessionId } = useShift();
  const { branchId } = useCurrentBranch();
  const { data: menu = [] } = useMenu();
  const { openDrawer, printRaw, printerStatus } = useHardware();

  const createOrder = useCreateOrder();
  const addItems    = useAddItems();
  const voidItem    = useVoidItem();
  const sendKitchen = useSendToKitchen();
  const serveOrder  = useServeOrder();
  const cancelOrder = useCancelOrder();
  const setAvail    = useSetItemAvailability();
  const applyDisc   = useApplyOrderDiscount();
  const removeDisc  = useRemoveOrderDiscount();
  const refundOrder = useRefundOrder();
  const splitOrder  = useSplitOrder();
  const holdOrder   = useHoldOrder();
  const recallOrder = useRecallOrder();
  const addCombo    = useAddCombo();
  const fireCourse  = useFireNextCourse();
  const sendReceipt = useSendReceipt();
  const { data: combos = [] } = useCombos(true);

  const [panel, setPanel]       = React.useState<"order" | "menu">(order ? "order" : "menu");
  const [search, setSearch]     = React.useState("");
  const [catId, setCatId]       = React.useState<string>("all");
  const [covers, setCovers]     = React.useState(String(table ? Math.min(2, table.capacity) : 1));
  const [pending, setPending]   = React.useState<PendingLine[]>([]);
  const [payTarget, setPayTarget] = React.useState<RestaurantOrder | null>(null);
  const [manageMenu, setManage] = React.useState(false);
  // Recipe-linked indicator — only fetched while managing the menu (avoids an extra request on the
  // normal ordering path). Recipe.MenuItemId is the link (see docs/restaurant-pos-enterprise-redesign.md
  // Epic 7) — a Set of linked ids is enough to badge each row without a per-item lookup.
  const { data: recipes = [] } = useRecipes(manageMenu);
  const recipeMenuItemIds = React.useMemo(() => new Set(recipes.map(r => r.menuItemId)), [recipes]);
  const [pickerItem, setPickerItem] = React.useState<MenuItem | null>(null);
  const [showSplit, setShowSplit] = React.useState(false);
  const [comboPicker, setComboPicker] = React.useState<Combo | null>(null);

  // Discount UI
  const [showDisc, setShowDisc]   = React.useState(false);
  const [discTab, setDiscTab]     = React.useState<"pct" | "fixed" | "voucher">("pct");
  const [discValue, setDiscValue] = React.useState("");
  const [discReason, setDiscReason] = React.useState("");
  const [voucherCode, setVoucherCode] = React.useState("");
  const [voucherMsg, setVoucherMsg]   = React.useState<{ ok: boolean; text: string } | null>(null);
  const [appliedVoucher, setAppliedVoucher] = React.useState<string | null>(null);
  const [voucherBusy, setVoucherBusy] = React.useState(false);

  // Reason-required confirmations (void item / cancel order) + refund
  const [voidItemTarget, setVoidItemTarget] = React.useState<string | null>(null);
  const [showCancelReason, setShowCancelReason] = React.useState(false);
  const [showRefund, setShowRefund] = React.useState(false);
  const [showSendReceipt, setShowSendReceipt] = React.useState(false);

  const busy = createOrder.isPending || addItems.isPending || sendKitchen.isPending ||
               serveOrder.isPending || cancelOrder.isPending || applyDisc.isPending;

  const applyPct = () => {
    if (!order) return; const v = parseFloat(discValue) || 0;
    if (v <= 0 || v > 100) return;
    if (!discReason.trim()) { toast.error(t("posView.drawer.discountReasonRequired")); return; }
    applyDisc.mutate({ id: order.id, type: "percentage" as DiscountType,
      amount: Math.round(order.subTotal * (v / 100) * 100) / 100, reason: discReason.trim() });
    setAppliedVoucher(null);
  };
  const applyFixed = () => {
    if (!order) return; const v = parseFloat(discValue) || 0;
    if (v <= 0) return;
    if (!discReason.trim()) { toast.error(t("posView.drawer.discountReasonRequired")); return; }
    applyDisc.mutate({ id: order.id, type: "flat" as DiscountType,
      amount: Math.min(v, order.subTotal), reason: discReason.trim() });
    setAppliedVoucher(null);
  };
  const applyVoucher = async () => {
    if (!order) return;
    const code = voucherCode.trim().toUpperCase();
    if (!code) return;
    if (!discReason.trim()) { toast.error(t("posView.drawer.discountReasonRequired")); return; }
    setVoucherBusy(true); setVoucherMsg(null);
    try {
      const res = await vouchersApi.validate(code, order.subTotal);
      if (res.valid) {
        await applyDisc.mutateAsync({ id: order.id, type: "voucher" as DiscountType,
          amount: res.discountAmount, reason: `Voucher ${code}: ${discReason.trim()}` });
        setAppliedVoucher(code);
        setVoucherMsg({ ok: true, text: t("posView.drawer.voucherApplied", { amount: res.discountAmount.toFixed(2) }) });
      } else {
        setVoucherMsg({ ok: false, text: res.message ?? t("posView.drawer.voucherInvalid") });
      }
    } catch (e: any) {
      setVoucherMsg({ ok: false, text: e?.message ?? t("posView.drawer.validationFailed") });
    } finally { setVoucherBusy(false); }
  };
  const removeDiscount = () => {
    if (!order) return;
    if (!discReason.trim()) { toast.error(t("posView.drawer.removeReasonRequired")); return; }
    removeDisc.mutate({ id: order.id, reason: discReason.trim() });
    setAppliedVoucher(null);
  };

  const handlePaid = async (paidOrder: RestaurantOrder) => {
    // Consume the voucher now that the bill is settled
    if (appliedVoucher) { try { await vouchersApi.redeem(appliedVoucher, paidOrder.subTotal); } catch { /* non-fatal */ } }
    // Cash drawer if any cash payment
    if (paidOrder.payments.some(p => p.method.toLowerCase() === "cash")) await openDrawer().catch(() => {});
    // Print receipt with discount + payment breakdown
    if (printerStatus === "ready") {
      const esc = buildEscPosReceipt({
        companyName: "Restaurant", txnNumber: paidOrder.orderNumber, cashierName: paidOrder.waiter,
        currency, taxLabel: "VAT",
        cart: paidOrder.items.map(i => ({ productId: i.menuItemId, name: i.itemName, quantity: i.quantity, price: i.unitPrice, taxRate: 5, total: i.lineTotal })),
        subtotal: paidOrder.subTotal, discountAmount: paidOrder.discountAmount, taxAmount: paidOrder.taxAmount,
        total: paidOrder.total,
        paymentMethod: paidOrder.payments.length > 1 ? "Split" : (paidOrder.payments[0]?.method ?? "Cash"),
        payments: paidOrder.payments.map(p => ({ method: p.method, amount: p.amount })),
        tendered: 0,
        openDrawer: paidOrder.payments.some(p => p.method.toLowerCase() === "cash"),
      });
      await printRaw(esc).catch(() => {});
    }
    toast.success(t("posView.drawer.billSettled"));
    const wasMainOrder = order != null && paidOrder.id === order.id;
    setPayTarget(null);
    if (wasMainOrder) onClose(); // paying a split's child leaves the drawer open on the split overview
  };

  const allItems = React.useMemo(() => menu.flatMap(c => c.items.map(i => ({ ...i, categoryId: c.id }))), [menu]);
  const filteredMenu = React.useMemo(() => {
    const q = search.toLowerCase();
    return allItems.filter(m =>
      (!q || m.name.toLowerCase().includes(q)) && (catId === "all" || m.categoryId === catId));
  }, [allItems, search, catId]);

  // Two lines for the same menu item merge only if they carry the same modifier selections.
  const addPendingWithModifiers = (mi: MenuItem, selectedModifierIds: string[]) => setPending(prev => {
    const sortedNew = [...selectedModifierIds].sort().join(",");
    const ex = prev.find(p => p.menuItem.id === mi.id && [...p.selectedModifierIds].sort().join(",") === sortedNew);
    if (ex) return prev.map(p => p.key === ex.key ? { ...p, quantity: p.quantity + 1 } : p);
    return [...prev, { key: `${mi.id}-${Date.now()}-${Math.random()}`, menuItem: mi, quantity: 1, modifiers: "", selectedModifierIds }];
  });
  const addPending = (mi: MenuItem) => {
    if (mi.modifierGroups.length > 0) setPickerItem(mi);
    else addPendingWithModifiers(mi, []);
  };
  const setPendingQty = (key: string, delta: number) => setPending(prev =>
    prev.map(p => p.key === key ? { ...p, quantity: p.quantity + delta } : p).filter(p => p.quantity > 0));

  const lineModifiers = (p: PendingLine) =>
    p.menuItem.modifierGroups.flatMap(g => g.modifiers).filter(m => p.selectedModifierIds.includes(m.id));
  const lineDelta = (p: PendingLine) => lineModifiers(p).reduce((s, m) => s + m.priceDelta, 0);
  const pendingTotal = pending.reduce((s, p) => s + (p.menuItem.price + lineDelta(p)) * p.quantity, 0);

  const lines = () => pending.map(p => ({
    menuItemId: p.menuItem.id, quantity: p.quantity, modifiers: p.modifiers || null,
    selectedModifierIds: p.selectedModifierIds.length ? p.selectedModifierIds : undefined,
  }));

  const handleOpenOrder = async () => {
    if (!pending.length) return;
    const created = await createOrder.mutateAsync({
      tableId: table?.id ?? null, waiter: user?.name ?? "Waiter",
      covers: parseInt(covers, 10) || 1,
      orderType: isTakeaway ? "takeaway" : "dine_in", notes: null, items: lines(),
      sessionId, branchId,
    });
    setPending([]); setPanel("order");
    onOrderCreated?.(created.id);
  };
  const handleAddItems = async () => {
    if (!order || !pending.length) return;
    await addItems.mutateAsync({ id: order.id, items: lines() });
    setPending([]); setPanel("order");
  };

  return (
    <>
      <motion.div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div className="fixed right-0 top-0 h-full w-full max-w-lg bg-card border-l border-border z-50 flex flex-col shadow-2xl"
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 280 }}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xl font-bold text-foreground">
                {table ? t("posView.drawer.tableHeading", { number: table.tableNumber }) : t("posView.drawer.takeawayHeading")}
              </p>
              {table ? (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${TABLE_STATUS[table.status].bg} ${TABLE_STATUS[table.status].color}`}>
                  {tableStatusLabel(table.status)}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning">🥡 {t("posView.drawer.takeawayBadge")}</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {table ? t("posView.drawer.tableSubtitle", { section: sectionLabel(table.section), capacity: table.capacity }) : t("posView.drawer.counterPickup")}
              {order ? ` · ${order.waiter}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0">
          {[{ key: "order", labelKey: "posView.drawer.tabOrder" }, { key: "menu", labelKey: "posView.drawer.tabMenu" }].map(tb => (
            <button key={tb.key} onClick={() => setPanel(tb.key as "order" | "menu")}
              className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${panel === tb.key ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              {t(tb.labelKey)}{tb.key === "menu" && pending.length > 0 ? ` (${pending.reduce((s, p) => s + p.quantity, 0)})` : ""}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {panel === "order" ? (
            <div className="p-5 space-y-5">
              {!order ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <UtensilsCrossed className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">{t("posView.drawer.noActiveOrder")}</p>
                  <Button size="sm" className="mt-4" onClick={() => setPanel("menu")}>
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> {t("posView.drawer.addItemsToStart")}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-mono text-muted-foreground">{order.orderNumber}</p>
                      <p className="text-xs text-muted-foreground">{t("posView.drawer.coversWaiter", { covers: order.covers, waiter: order.waiter })}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${ORDER_STATUS[order.status]?.bg} ${ORDER_STATUS[order.status]?.color}`}>
                      {orderStatusLabel(order.status)}
                    </span>
                  </div>

                  {order.status === "split" ? (
                    /* Split-bill overview — the order itself holds no items anymore (they moved
                       onto its children); each split is paid independently below. */
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        {t("posView.drawer.splitInto", { count: order.splits.length })}
                      </p>
                      {order.splits.map(s => (
                        <div key={s.id} className="flex items-center justify-between p-3 rounded-xl border border-border">
                          <div>
                            <p className="text-xs font-mono text-foreground">{s.orderNumber}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {formatCurrency(s.total, currency)}
                              {s.status !== "paid" && ` · ${t("posView.drawer.dueSuffix", { amount: formatCurrency(s.outstanding, currency) })}`}
                            </p>
                          </div>
                          {s.status === "paid" ? (
                            <span className="text-xs text-success font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />{t("posView.drawer.paid")}
                            </span>
                          ) : (
                            <Can permission="restaurant.orders.edit">
                              <Button size="sm" variant="outline" onClick={() => {
                                const full = allOrders.find(o => o.id === s.id);
                                if (full) setPayTarget(full);
                              }}>{t("posView.common.pay")}</Button>
                            </Can>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2.5">
                        {order.items.map(item => (
                          <div key={item.id} className="flex items-start justify-between py-2.5 border-b border-border last:border-0">
                            <div className="flex-1 min-w-0 pr-2">
                              <p className="text-sm text-foreground"><span className="text-primary font-semibold mr-1">×{item.quantity}</span>{item.itemName}</p>
                              {item.selectedModifiers.length > 0 && (
                                <p className="text-xs text-primary mt-0.5">
                                  {item.selectedModifiers.map(m => m.priceDelta !== 0
                                    ? `${m.name} (${m.priceDelta > 0 ? "+" : ""}${formatCurrency(m.priceDelta, currency)})`
                                    : m.name).join(", ")}
                                </p>
                              )}
                              {item.modifiers && <p className="text-xs text-warning mt-0.5 italic">{item.modifiers}</p>}
                              <p className="text-xs text-muted-foreground mt-0.5">{t("posView.drawer.eachPrice", { price: formatCurrency(item.unitPrice, currency) })}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <p className="text-sm font-semibold text-foreground">{formatCurrency(item.lineTotal, currency)}</p>
                              {order.status === "open" && (
                                <Can permission="restaurant.orders.void">
                                  <button onClick={() => setVoidItemTarget(item.id)}
                                    className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                                </Can>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Discount control (open orders only) */}
                      {order.status !== "paid" && order.status !== "cancelled" && (
                        <Can permission="restaurant.orders.discount">
                        <div className="rounded-xl border border-border overflow-hidden">
                          <button onClick={() => setShowDisc(s => !s)} className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold hover:bg-muted/30">
                            <span className="flex items-center gap-1.5"><Tag className="h-3.5 w-3.5 text-primary" />{t("posView.drawer.discount")}
                              {order.discountAmount > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-success/15 text-success text-[10px]">-{formatCurrency(order.discountAmount, currency)}</span>}
                            </span>
                            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showDisc && "rotate-180")} />
                          </button>
                          {showDisc && (
                            <div className="p-3 border-t border-border space-y-2">
                              <div className="grid grid-cols-3 gap-1">
                                {[{ id: "pct", labelKey: "posView.drawer.discountPercent", icon: Percent }, { id: "fixed", labelKey: "posView.drawer.discountAmount", icon: Tag }, { id: "voucher", labelKey: "posView.drawer.discountVoucher", icon: Ticket }].map(tb => {
                                  const Icon = tb.icon;
                                  return (
                                    <button key={tb.id} onClick={() => { setDiscTab(tb.id as any); setVoucherMsg(null); }}
                                      className={cn("flex flex-col items-center gap-1 py-1.5 rounded-lg border text-[10px] font-semibold",
                                        discTab === tb.id ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground")}>
                                      <Icon className="h-3.5 w-3.5" />{t(tb.labelKey)}
                                    </button>
                                  );
                                })}
                              </div>
                              {discTab === "pct" && (
                                <div className="flex gap-2"><Input type="number" min={0} max={100} value={discValue} onChange={e => setDiscValue(e.target.value)} placeholder="0" className="h-8 text-sm" /><Button size="sm" className="h-8" onClick={applyPct} disabled={applyDisc.isPending}>{applyDisc.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("posView.common.apply")}</Button></div>
                              )}
                              {discTab === "fixed" && (
                                <div className="flex gap-2"><Input type="number" min={0} value={discValue} onChange={e => setDiscValue(e.target.value)} placeholder="0.00" className="h-8 text-sm" /><Button size="sm" className="h-8" onClick={applyFixed} disabled={applyDisc.isPending}>{applyDisc.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("posView.common.apply")}</Button></div>
                              )}
                              {discTab === "voucher" && (
                                <div className="space-y-1.5">
                                  <div className="flex gap-2">
                                    <Input value={voucherCode} onChange={e => setVoucherCode(e.target.value.toUpperCase())} placeholder={t("posView.drawer.voucherPlaceholder")} className="h-8 text-sm font-mono uppercase" />
                                    <Button size="sm" className="h-8 min-w-[64px]" onClick={applyVoucher} disabled={voucherBusy}>{voucherBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("posView.common.apply")}</Button>
                                  </div>
                                  {voucherMsg && <p className={cn("text-[11px]", voucherMsg.ok ? "text-success" : "text-destructive")}>{voucherMsg.text}</p>}
                                </div>
                              )}
                              <Input value={discReason} onChange={e => setDiscReason(e.target.value)}
                                placeholder={t("posView.reason.placeholder")} className="h-8 text-xs" />
                              {order.discountAmount > 0 && (
                                <button onClick={removeDiscount} disabled={removeDisc.isPending}
                                  className="text-[11px] text-destructive hover:underline disabled:opacity-50">
                                  {removeDisc.isPending ? t("posView.drawer.removing") : t("posView.drawer.removeDiscount")}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        </Can>
                      )}

                      <div className="space-y-1.5 pt-2">
                        <div className="flex justify-between text-xs text-muted-foreground"><span>{t("posView.drawer.subtotal")}</span><span>{formatCurrency(order.subTotal, currency)}</span></div>
                        {order.discountAmount > 0 && <div className="flex justify-between text-xs text-success"><span>{t("posView.drawer.discount")}</span><span>-{formatCurrency(order.discountAmount, currency)}</span></div>}
                        <div className="flex justify-between text-xs text-muted-foreground"><span>{t("posView.drawer.vat")}</span><span>{formatCurrency(order.taxAmount, currency)}</span></div>
                        <div className="flex justify-between text-sm font-bold text-foreground pt-2 border-t border-border"><span>{t("posView.drawer.total")}</span><span>{formatCurrency(order.total, currency)}</span></div>
                        {order.amountPaid > 0 && order.status !== "paid" && (
                          <div className="flex justify-between text-xs text-primary"><span>{t("posView.drawer.paidSoFar")}</span><span>{t("posView.drawer.paidSoFarValue", { paid: formatCurrency(order.amountPaid, currency), left: formatCurrency(order.outstanding, currency) })}</span></div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          ) : (
            /* Menu panel */
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("posView.drawer.searchMenu")} className="pl-9 h-9 text-sm" />
                </div>
                <Can permission="restaurant.menu.edit">
                  <Button variant={manageMenu ? "default" : "outline"} size="sm" onClick={() => setManage(m => !m)} title={t("posView.drawer.toggleAvailability")}>
                    {manageMenu ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </Button>
                </Can>
              </div>

              {/* Combo deals — adding one requires an already-open order (can't expand into "pending" pre-order) */}
              {combos.length > 0 && order && order.status === "open" && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><ComboIcon className="w-3 h-3" /> {t("posView.combo.deals")}</p>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {combos.map(combo => (
                      <button key={combo.id} disabled={addCombo.isPending}
                        onClick={() => combo.items.some(i => i.categoryId) ? setComboPicker(combo) : addCombo.mutate({ id: order.id, comboId: combo.id, selections: combo.items.map(i => ({ comboItemId: i.id, menuItemId: i.menuItemId! })) })}
                        className="shrink-0 border border-primary/30 bg-primary/5 rounded-xl px-3 py-2 text-left hover:bg-primary/10 disabled:opacity-50">
                        <p className="text-xs font-semibold text-foreground whitespace-nowrap">{combo.name}</p>
                        <p className="text-xs font-bold text-primary">{formatCurrency(combo.price, currency)}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <button onClick={() => setCatId("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${catId === "all" ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"}`}>{t("posView.drawer.all")}</button>
                {menu.map(c => (
                  <button key={c.id} onClick={() => setCatId(c.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${catId === c.id ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"}`}>{c.name}</button>
                ))}
              </div>

              <div className="space-y-2">
                {filteredMenu.map(item => (
                  <div key={item.id} className={cn("flex items-center gap-3 p-3 rounded-xl transition-colors",
                    item.isAvailable ? "bg-muted/20 hover:bg-muted/30" : "bg-muted/10 opacity-60")}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{t("posView.drawer.prepMinutes", { n: item.prepTimeMinutes })}{item.allergens ? ` · ${item.allergens}` : ""}</p>
                    </div>
                    <p className="text-sm font-semibold text-foreground shrink-0">{formatCurrency(item.price, currency)}</p>
                    {manageMenu ? (
                      <>
                        <Link to="/recipe/recipes" title={recipeMenuItemIds.has(item.id) ? t("posView.drawer.recipeLinked") : t("posView.drawer.recipeMissing")}
                          className={cn("flex items-center gap-1 px-1.5 py-1 rounded-lg text-xs shrink-0",
                            recipeMenuItemIds.has(item.id) ? "text-success hover:bg-success/10" : "text-muted-foreground/50 hover:bg-muted/30")}>
                          <ChefHat className="w-3.5 h-3.5" />
                        </Link>
                        <button onClick={() => setAvail.mutate({ id: item.id, isAvailable: !item.isAvailable })}
                          className={cn("px-2 py-1 rounded-lg text-xs font-semibold shrink-0", item.isAvailable ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                          {item.isAvailable ? t("posView.drawer.available") : t("posView.drawer.unavailable")}
                        </button>
                      </>
                    ) : (
                      <button disabled={!item.isAvailable || (order != null && order.status !== "open")} onClick={() => addPending(item)}
                        className="flex items-center gap-0.5 text-xs text-primary hover:underline disabled:opacity-40 disabled:no-underline shrink-0">
                        <Plus className="w-3 h-3" /> {t("posView.common.add")}
                      </button>
                    )}
                  </div>
                ))}
                {filteredMenu.length === 0 && <p className="text-center text-xs text-muted-foreground py-8">{t("posView.drawer.noItemsFound")}</p>}
              </div>

              {/* Pending additions */}
              {pending.length > 0 && (
                <div className="border border-primary/20 bg-primary/5 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-semibold text-primary">{t("posView.drawer.toAdd", { count: pending.reduce((s, p) => s + p.quantity, 0), total: formatCurrency(pendingTotal, currency) })}</p>
                  {pending.map(p => (
                    <div key={p.key} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground truncate">{p.menuItem.name}</p>
                        {lineModifiers(p).length > 0 && (
                          <p className="text-[10px] text-muted-foreground truncate">
                            {lineModifiers(p).map(m => m.name).join(", ")}
                            {lineDelta(p) !== 0 && ` (${lineDelta(p) > 0 ? "+" : ""}${formatCurrency(lineDelta(p), currency)})`}
                          </p>
                        )}
                      </div>
                      <button onClick={() => setPendingQty(p.key, -1)} className="w-5 h-5 rounded bg-muted flex items-center justify-center shrink-0"><Minus className="w-2.5 h-2.5" /></button>
                      <span className="text-xs font-bold w-4 text-center shrink-0">{p.quantity}</span>
                      <button onClick={() => setPendingQty(p.key, 1)} className="w-5 h-5 rounded bg-muted flex items-center justify-center shrink-0"><Plus className="w-2.5 h-2.5" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-border shrink-0 space-y-2">
          {/* Covers input when opening a new dine-in order */}
          {!order && table && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t("posView.drawer.guests")}</span>
              <Input type="number" min={1} max={table.capacity} value={covers} onChange={e => setCovers(e.target.value)} className="h-8 w-20 text-sm" />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {!order && (
              <Button className="flex-1" size="sm" disabled={!pending.length || busy} onClick={handleOpenOrder}>
                {createOrder.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Plus className="w-3.5 h-3.5 mr-1.5" />{t("posView.drawer.openOrder")}</>}
              </Button>
            )}
            {order && pending.length > 0 && (
              <Button className="flex-1" size="sm" disabled={busy} onClick={handleAddItems}>
                {addItems.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Plus className="w-3.5 h-3.5 mr-1.5" />{t("posView.drawer.addItemsCount", { count: pending.reduce((s, p) => s + p.quantity, 0) })}</>}
              </Button>
            )}
            {order && order.status === "open" && pending.length === 0 && (
              <Button className="flex-1" size="sm" disabled={busy} onClick={() => sendKitchen.mutate(order.id)}>
                <Send className="w-3.5 h-3.5 mr-1.5" />{t("posView.drawer.sendToKitchen")}
              </Button>
            )}
            {order && (order.status === "ready" || order.status === "sent") && pending.length === 0 && (
              <Button className="flex-1" size="sm" disabled={busy} onClick={() => serveOrder.mutate(order.id)}>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />{t("posView.drawer.markServed")}
              </Button>
            )}
            {order && order.status !== "paid" && order.status !== "cancelled" && order.status !== "split" &&
              order.status !== "held" && pending.length === 0 && (
              <Button className="flex-1" size="sm" variant="outline" disabled={busy} onClick={() => setPayTarget(order)}>
                <Receipt className="w-3.5 h-3.5 mr-1.5" />{t("posView.drawer.billAndPay")}
              </Button>
            )}
            {order && order.status !== "paid" && order.status !== "cancelled" && order.status !== "split" &&
              order.status !== "held" && order.items.length >= 2 && pending.length === 0 && (
              <Can permission="restaurant.orders.edit">
                <Button size="sm" variant="outline" onClick={() => setShowSplit(true)}>
                  <SplitSquareHorizontal className="w-3.5 h-3.5" />
                </Button>
              </Can>
            )}
            {order && order.status !== "paid" && order.status !== "cancelled" && order.status !== "split" &&
              order.status !== "held" && pending.length === 0 && (
              <Can permission="restaurant.orders.edit">
                <Button size="sm" variant="outline" title={t("posView.drawer.fireNextCourse")} disabled={fireCourse.isPending}
                  onClick={() => fireCourse.mutate(order.id)}>
                  {fireCourse.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChefHat className="w-3.5 h-3.5" />}
                </Button>
              </Can>
            )}
            {order && order.status === "open" && pending.length === 0 && (
              <Can permission="restaurant.orders.edit">
                <Button size="sm" variant="outline" disabled={holdOrder.isPending} onClick={() => holdOrder.mutate(order.id)}>
                  {holdOrder.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PauseCircle className="w-3.5 h-3.5" />}
                </Button>
              </Can>
            )}
            {order && order.status === "held" && (
              <Can permission="restaurant.orders.edit">
                <Button className="flex-1" size="sm" disabled={recallOrder.isPending} onClick={() => recallOrder.mutate(order.id)}>
                  {recallOrder.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><PlayCircle className="w-3.5 h-3.5 mr-1.5" />{t("posView.drawer.recallOrder")}</>}
                </Button>
              </Can>
            )}
            {order && order.status === "open" && pending.length === 0 && (
              <Can permission="restaurant.orders.void">
                <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => setShowCancelReason(true)}>
                  <Ban className="w-3.5 h-3.5" />
                </Button>
              </Can>
            )}
            {order && order.status === "paid" && order.amountPaid > 0 && (
              <Can permission="restaurant.orders.refund">
                <Button size="sm" variant="outline" className="text-destructive border-destructive/40" onClick={() => setShowRefund(true)}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />{t("posView.drawer.refund")}
                </Button>
              </Can>
            )}
            {order && order.status === "paid" && (
              <Can permission="restaurant.orders.edit">
                <Button size="sm" variant="outline" onClick={() => setShowSendReceipt(true)}>
                  <Mail className="w-3.5 h-3.5" />
                </Button>
              </Can>
            )}
          </div>
        </div>
      </motion.div>

      {/* Bill & payment dialog (single / split-tender / split-by-members) — payTarget is either the
          main order or a specific split's child order (see the split-overview panel above) */}
      {payTarget && (
        <RestaurantPayDialog order={payTarget} currency={currency} onPaid={handlePaid} onClose={() => setPayTarget(null)} />
      )}

      {/* Split-bill modal */}
      {showSplit && order && (
        <SplitBillModal
          order={order} currency={currency} busy={splitOrder.isPending}
          onConfirm={groups => {
            splitOrder.mutate({ id: order.id, groups }, { onSuccess: () => setShowSplit(false) });
          }}
          onCancel={() => setShowSplit(false)}
        />
      )}

      {/* Modifier picker — shown before adding an item that has configurable modifier groups */}
      {pickerItem && (
        <ModifierPickerModal
          item={pickerItem} currency={currency}
          onConfirm={ids => { addPendingWithModifiers(pickerItem, ids); setPickerItem(null); }}
          onCancel={() => setPickerItem(null)}
        />
      )}

      {/* Combo picker — resolves each "choose one" slot before ordering a combo */}
      {comboPicker && order && (
        <ComboPickerModal
          combo={comboPicker} menu={menu} busy={addCombo.isPending}
          onConfirm={selections => addCombo.mutate({ id: order.id, comboId: comboPicker.id, selections }, { onSuccess: () => setComboPicker(null) })}
          onCancel={() => setComboPicker(null)}
        />
      )}

      {/* Void-item reason prompt */}
      {voidItemTarget && order && (
        <ReasonModal
          title={t("posView.drawer.voidItemTitle")} danger busy={voidItem.isPending}
          onConfirm={reason => { voidItem.mutate({ id: order.id, itemId: voidItemTarget, reason }); setVoidItemTarget(null); }}
          onCancel={() => setVoidItemTarget(null)}
        />
      )}

      {/* Cancel-order reason prompt */}
      {showCancelReason && order && (
        <ReasonModal
          title={t("posView.drawer.cancelOrderTitle")} danger busy={cancelOrder.isPending}
          onConfirm={reason => { cancelOrder.mutate({ id: order.id, reason }); setShowCancelReason(false); onClose(); }}
          onCancel={() => setShowCancelReason(false)}
        />
      )}

      {/* Refund prompt */}
      {showRefund && order && (
        <RefundModal
          order={order} currency={currency} busy={refundOrder.isPending}
          onConfirm={(amount, reason, method) => {
            refundOrder.mutate({ id: order.id, amount, reason, method });
            setShowRefund(false);
          }}
          onCancel={() => setShowRefund(false)}
        />
      )}
      {showSendReceipt && order && (
        <SendReceiptModal
          busy={sendReceipt.isPending}
          onConfirm={(channel, recipientAddress) => {
            sendReceipt.mutate({ orderId: order.id, channel, recipientAddress });
            setShowSendReceipt(false);
          }}
          onCancel={() => setShowSendReceipt(false)}
        />
      )}
    </>
  );
}

function SendReceiptModal({ busy, onConfirm, onCancel }: {
  busy: boolean; onConfirm: (channel: "email" | "sms" | "whatsapp", recipientAddress: string) => void; onCancel: () => void;
}) {
  const { t } = useTranslation("restaurant");
  const [channel, setChannel] = React.useState<"email" | "sms" | "whatsapp">("email");
  const [recipient, setRecipient] = React.useState("");

  return (
    <LeftDrawer onClose={onCancel} widthClassName="max-w-sm" zIndexClassName="z-[60]">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{t("posView.receipt.title")}</p>
        <button onClick={onCancel}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>
      <div className="flex gap-2">
        <button onClick={() => setChannel("email")}
          className={cn("flex-1 py-1.5 rounded-lg text-xs font-medium", channel === "email" ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground")}>
          {t("posView.receipt.email")}
        </button>
        <button onClick={() => setChannel("sms")}
          className={cn("flex-1 py-1.5 rounded-lg text-xs font-medium", channel === "sms" ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground")}>
          {t("posView.receipt.sms")}
        </button>
        <button onClick={() => setChannel("whatsapp")}
          className={cn("flex-1 py-1.5 rounded-lg text-xs font-medium", channel === "whatsapp" ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground")}>
          {t("posView.receipt.whatsapp")}
        </button>
      </div>
      <Input value={recipient} onChange={e => setRecipient(e.target.value)}
        placeholder={channel === "email" ? t("posView.receipt.emailPlaceholder") : t("posView.receipt.phonePlaceholder")} className="h-9 text-sm" />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={onCancel}>{t("posView.common.cancel")}</Button>
        <Button size="sm" className="flex-1" disabled={!recipient.trim() || busy} onClick={() => onConfirm(channel, recipient.trim())}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("posView.common.send")}
        </Button>
      </div>
    </LeftDrawer>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────
export function RestaurantPOSView() {
  const { t } = useTranslation("restaurant");
  useRestaurantRealtime();
  useDeviceRegistration();
  const { tenant } = useAuthStore();
  const currency = tenant?.currency || "AED";

  const [sectionFilter, setSectionFilter] = React.useState<string>("all");
  const [selectedTableId, setSelectedTableId] = React.useState<string | null>(null);
  const [takeaway, setTakeaway] = React.useState<string | null>(null); // "new" | orderId
  const [showNewDelivery, setShowNewDelivery] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"floor" | "orders">("floor");
  const [showAddTable, setShowAddTable] = React.useState(false);

  const { data: tables = [], isLoading: tablesLoading } = useTables();
  const { data: tablesSummary } = useTablesSummary();
  const { data: orders = [] } = useOrders();
  const { data: ordersSummary } = useOrdersSummary();

  // active (non-closed) orders by id for quick lookup
  const orderByTable = React.useMemo(() => {
    const m = new Map<string, RestaurantOrder>();
    for (const o of orders) {
      if (o.status === "paid" || o.status === "cancelled") continue;
      if (o.parentOrderId) continue; // split children share the parent's tableId — only the parent represents "the table's order"
      m.set(o.tableId, o);
    }
    return m;
  }, [orders]);

  const sections = React.useMemo(
    () => [...new Set(tables.map(t => t.section))].sort(),
    [tables]
  );

  const selectedTable = tables.find(t => t.id === selectedTableId) ?? null;
  const selectedOrder = selectedTable ? orderByTable.get(selectedTable.id) ?? null : null;

  // Takeaway drawer: "new" → fresh order, or an order id to reopen
  const takeawayOrder = takeaway && takeaway !== "new" ? (orders.find(o => o.id === takeaway) ?? null) : null;
  const drawerOpen = !!selectedTable || takeaway !== null;
  const closeDrawer = () => { setSelectedTableId(null); setTakeaway(null); };

  const visibleSections = sectionFilter === "all" ? sections : [sectionFilter];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card shrink-0">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t("posView.title")}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("posView.headerSummary", {
              tables: tablesSummary?.total ?? tables.length,
              occupied: tablesSummary?.occupied ?? 0,
              inKitchen: ordersSummary?.sent ?? 0,
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BranchSwitcher />
          <HardwareStatusBar />
          <Button variant={activeTab === "floor" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("floor")}>{t("posView.floorPlan")}</Button>
          <Button variant={activeTab === "orders" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("orders")}>{t("posView.ordersTab")}</Button>
          <Can permission="restaurant.orders.create">
            <Button size="sm" className="gap-1.5" onClick={() => setTakeaway("new")}>🥡 {t("posView.takeaway")}</Button>
          </Can>
          <Can permission="restaurant.delivery.create">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowNewDelivery(true)}>🛵 {t("posView.delivery")}</Button>
          </Can>
          <Can permission="restaurant.tables.create">
            <Button size="sm" variant="outline" onClick={() => setShowAddTable(true)}><Plus className="w-3.5 h-3.5 mr-1.5" />{t("posView.addTable")}</Button>
          </Can>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label={t("posView.stat.totalTables")} value={tablesSummary?.total ?? tables.length} accent="bg-primary" />
          <StatCard label={t("posView.stat.occupied")}    value={tablesSummary?.occupied ?? 0} accent="bg-primary" />
          <StatCard label={t("posView.stat.available")}   value={tablesSummary?.available ?? 0} accent="bg-success" />
          <StatCard label={t("posView.stat.reserved")}    value={tablesSummary?.reserved ?? 0} accent="bg-blue-500" />
          <StatCard label={t("posView.stat.inKitchen")}   value={ordersSummary?.sent ?? 0} accent="bg-warning" />
          <StatCard label={t("posView.stat.todaySales")}  value={formatCurrency(ordersSummary?.todayRevenue ?? 0, currency)} accent="bg-success" />
        </div>

        {activeTab === "floor" ? (
          <>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setSectionFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${sectionFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"}`}>{t("posView.allSections")}</button>
              {sections.map(s => (
                <button key={s} onClick={() => setSectionFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${sectionFilter === s ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"}`}>{sectionLabel(s)}</button>
              ))}
            </div>

            {tablesLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : visibleSections.map(section => {
              const secTables = tables.filter(t => t.section === section);
              if (secTables.length === 0) return null;
              return (
                <div key={section}>
                  <div className="flex items-center gap-3 mb-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{sectionLabel(section)}</p>
                    <div className="flex-1 h-px bg-border" />
                    <p className="text-xs text-muted-foreground">{t("posView.sectionTableCount", { n: secTables.length })}</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {secTables.map(t => (
                      <TableCard key={t.id} table={t} order={orderByTable.get(t.id)} currency={currency} onClick={() => setSelectedTableId(t.id)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border"><p className="text-sm font-semibold text-foreground">{t("posView.ordersHeading")}</p></div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-border bg-muted/20">
                  {["orderNum", "table", "items", "total", "status", "waiter", ""].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                      {h ? t(`posView.ordersTable.${h}`) : ""}
                    </th>
                  ))}
                </tr></thead>
                <tbody>
                  {orders.map(o => {
                    const sc = ORDER_STATUS[o.status];
                    return (
                      <tr key={o.id} className="border-b border-border last:border-0 hover:bg-muted/10">
                        <td className="px-4 py-3 text-xs font-mono text-foreground">{o.orderNumber}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-foreground">{o.tableNumber}</td>
                        <td className="px-4 py-3 text-xs text-foreground">{o.items.length}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-foreground">{formatCurrency(o.total, currency)}</td>
                        <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sc?.bg} ${sc?.color}`}>{orderStatusLabel(o.status)}</span></td>
                        <td className="px-4 py-3 text-xs text-foreground">{o.waiter}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => {
                              if (o.orderType === "dine_in") { setSelectedTableId(o.tableId); setActiveTab("floor"); }
                              else { setTakeaway(o.id); }
                            }}
                            className="text-xs text-primary hover:underline flex items-center gap-1">{t("posView.view")} <ChevronRight className="w-3 h-3" /></button>
                        </td>
                      </tr>
                    );
                  })}
                  {orders.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-xs text-muted-foreground">{t("posView.noOrders")}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Order drawer — dine-in (table) or takeaway (no table) */}
      <AnimatePresence>
        {drawerOpen && (
          <OrderDrawer
            table={selectedTable}
            order={selectedTable ? selectedOrder : takeawayOrder}
            allOrders={orders}
            isTakeaway={!selectedTable}
            currency={currency}
            onClose={closeDrawer}
            onOrderCreated={(id) => { if (!selectedTable) setTakeaway(id); }}
          />
        )}
      </AnimatePresence>
      <AddTableForm open={showAddTable} onClose={() => setShowAddTable(false)} />
      {showNewDelivery && <NewDeliveryOrderModal currency={currency} onClose={() => setShowNewDelivery(false)} />}
    </div>
  );
}

// ─── New Delivery Order — quick-create (order + delivery leg together) ────────
// Deliberately simpler than the full OrderDrawer (no modifiers/combos) — a v1 scope cut for the
// delivery quick-create path; staff can still edit items via the normal Orders tab afterward.
function NewDeliveryOrderModal({ currency, onClose }: { currency: string; onClose: () => void }) {
  const { t } = useTranslation("restaurant");
  const { user } = useAuthStore();
  const { branchId } = useCurrentBranch();
  const { data: menu = [] } = useMenu();
  const { data: zones = [] } = useDeliveryZones();
  const createOrder = useCreateOrder();
  const createDelivery = useCreateDeliveryOrder();

  const [guestName, setGuestName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [zoneId, setZoneId] = React.useState("");
  const [cart, setCart] = React.useState<{ menuItemId: string; name: string; price: number; quantity: number }[]>([]);

  const allItems = React.useMemo(() => menu.flatMap(c => c.items), [menu]);
  const addItem = (mi: MenuItem) => setCart(prev => {
    const ex = prev.find(l => l.menuItemId === mi.id);
    if (ex) return prev.map(l => l.menuItemId === mi.id ? { ...l, quantity: l.quantity + 1 } : l);
    return [...prev, { menuItemId: mi.id, name: mi.name, price: mi.price, quantity: 1 }];
  });
  const total = cart.reduce((s, l) => s + l.price * l.quantity, 0);
  const busy = createOrder.isPending || createDelivery.isPending;
  const valid = guestName.trim() && phone.trim() && address.trim() && cart.length > 0;

  const handleCreate = async () => {
    const order = await createOrder.mutateAsync({
      tableId: null, waiter: guestName.trim(), covers: 1, orderType: "delivery", notes: null,
      items: cart.map(l => ({ menuItemId: l.menuItemId, quantity: l.quantity })),
      branchId,
    });
    await createDelivery.mutateAsync({ orderId: order.id, address: address.trim(), phone: phone.trim(), deliveryZoneId: zoneId || null });
    onClose();
  };

  return (
    <LeftDrawer onClose={onClose} widthClassName="max-w-lg">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">🛵 {t("posView.newDelivery.title")}</p>
        <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div><label className="text-xs text-muted-foreground">{t("posView.newDelivery.guestName")}</label>
          <Input value={guestName} onChange={e => setGuestName(e.target.value)} className="h-9 text-sm" /></div>
        <div><label className="text-xs text-muted-foreground">{t("posView.newDelivery.phone")}</label>
          <Input value={phone} onChange={e => setPhone(e.target.value)} className="h-9 text-sm" /></div>
      </div>
      <div><label className="text-xs text-muted-foreground">{t("posView.newDelivery.address")}</label>
        <Input value={address} onChange={e => setAddress(e.target.value)} className="h-9 text-sm" /></div>
      {zones.length > 0 && (
        <div><label className="text-xs text-muted-foreground">{t("posView.newDelivery.zone")}</label>
          <select value={zoneId} onChange={e => setZoneId(e.target.value)} className="w-full h-9 text-sm rounded-md border border-border bg-card px-2">
            <option value="">{t("posView.newDelivery.noZone")}</option>
            {zones.filter(z => z.isActive).map(z => <option key={z.id} value={z.id}>{z.name} — {formatCurrency(z.deliveryFee, currency)}</option>)}
          </select></div>
      )}

      <p className="text-xs font-semibold text-muted-foreground pt-2">{t("posView.newDelivery.items")}</p>
      <div className="max-h-40 overflow-auto space-y-1">
        {allItems.filter(i => i.isAvailable).map(item => (
          <button key={item.id} onClick={() => addItem(item)}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-muted/30 text-left">
            <span className="text-sm text-foreground">{item.name}</span>
            <span className="text-xs text-muted-foreground">{formatCurrency(item.price, currency)}</span>
          </button>
        ))}
      </div>
      {cart.length > 0 && (
        <div className="border border-primary/20 bg-primary/5 rounded-lg p-2 space-y-1">
          {cart.map(l => (
            <div key={l.menuItemId} className="flex items-center justify-between text-xs">
              <span>{l.quantity}× {l.name}</span>
              <span>{formatCurrency(l.price * l.quantity, currency)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between text-xs font-semibold pt-1 border-t border-border">
            <span>{t("posView.common.total")}</span><span>{formatCurrency(total, currency)}</span>
          </div>
        </div>
      )}

      <Button className="w-full" disabled={!valid || busy} onClick={handleCreate}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} {t("posView.newDelivery.submit")}
      </Button>
    </LeftDrawer>
  );
}
