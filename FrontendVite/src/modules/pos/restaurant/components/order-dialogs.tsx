import * as React from "react";
import { useTranslation } from "react-i18next";
import { X, Plus, Minus, Loader2, Search, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LeftDrawer } from "@/components/ui/left-drawer";
import { cn, formatCurrency } from "@/lib/utils";
import { useMenu, useCreateOrder, useCreateDeliveryOrder, useDeliveryZones, useDrivers, useAssignDriverToDelivery } from "@/hooks/restaurant/use-restaurant";
import { useCurrentBranch } from "@/hooks/restaurant/use-current-branch";
import { useAuthStore } from "@/store/auth.store";
import type { RestaurantOrder, MenuItem, MenuCategory, Combo, ComboSelectionInput } from "@/lib/restaurant/restaurant.api";

/** Secondary prompts of the restaurant till — each one asks a single question and gets out of the way. */

// ─── Reason prompt (void item / cancel order — reason required, no window.prompt) ─────────
export function ReasonModal({ title, danger, busy, onConfirm, onCancel }: {
  title: string; danger?: boolean; busy?: boolean;
  onConfirm: (reason: string) => void; onCancel: () => void;
}) {
  const { t } = useTranslation("restaurant");
  const [reason, setReason] = React.useState("");
  return (
    <LeftDrawer onClose={onCancel} widthClassName="max-w-sm" zIndexClassName="z-[60]">
      <p className="text-xl font-black text-foreground">{title}</p>
      <textarea
        autoFocus rows={3} value={reason} onChange={e => setReason(e.target.value)}
        placeholder={t("posView.reason.placeholder")}
        className="w-full px-3 py-2.5 text-base rounded-xl border-2 border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      <div className="flex gap-2">
        <Button variant="outline" size="lg" className="flex-1" onClick={onCancel}>{t("posView.common.cancel")}</Button>
        <Button size="lg" className={cn("flex-1", danger && "bg-destructive hover:bg-destructive/90")}
          disabled={!reason.trim() || busy} onClick={() => onConfirm(reason.trim())}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("posView.common.confirm")}
        </Button>
      </div>
    </LeftDrawer>
  );
}

// ─── Refund prompt (amount + method + reason) ──────────────────────────────────
export function RefundModal({ order, currency, busy, onConfirm, onCancel }: {
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
      <p className="text-xl font-black text-foreground">{t("posView.refund.title")}</p>
      <div>
        <label className="text-xs text-muted-foreground">{t("posView.refund.amountLabel", { max: formatCurrency(order.amountPaid, currency) })}</label>
        <Input type="number" min={0} max={order.amountPaid} value={amount}
          onChange={e => setAmount(e.target.value)} className="h-12 text-base mt-1" />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">{t("posView.refund.method")}</label>
        <Input value={method} onChange={e => setMethod(e.target.value)} className="h-12 text-base mt-1" />
      </div>
      <textarea
        rows={2} value={reason} onChange={e => setReason(e.target.value)}
        placeholder={t("posView.reason.placeholder")}
        className="w-full px-3 py-2.5 text-base rounded-xl border-2 border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      <div className="flex gap-2">
        <Button variant="outline" size="lg" className="flex-1" onClick={onCancel}>{t("posView.common.cancel")}</Button>
        <Button size="lg" className="flex-1 bg-destructive hover:bg-destructive/90"
          disabled={!valid || busy} onClick={() => onConfirm(amt, reason.trim(), method.trim() || "Cash")}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("posView.refund.submit")}
        </Button>
      </div>
    </LeftDrawer>
  );
}


// ─── Split bill (assign each item to a guest bucket, each becomes an independently-payable order) ──
export function SplitBillModal({ order, currency, busy, onConfirm, onCancel }: {
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
        <p className="text-xl font-black text-foreground">{t("posView.split.title")}</p>
        <div className="flex items-center gap-2">
          <button onClick={() => setBucketCount(n => Math.max(2, n - 1))}
            className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center"><Minus className="w-4 h-4" /></button>
          <span className="text-base font-bold w-20 text-center">{t("posView.split.guests", { n: bucketCount })}</span>
          <button onClick={() => setBucketCount(n => n + 1)}
            className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center"><Plus className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-muted-foreground mb-2">{t("posView.split.assignHint")}</p>
          {items.map(item => (
            <div key={item.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-border/50 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-foreground truncate">{item.quantity}× {item.itemName}</p>
                <p className="text-sm font-semibold text-muted-foreground">{formatCurrency(item.lineTotal, currency)}</p>
              </div>
              <div className="flex gap-1 shrink-0 flex-wrap justify-end max-w-[220px]">
                {Array.from({ length: bucketCount }, (_, idx) => (
                  <button key={idx} onClick={() => setAssignment(prev => ({ ...prev, [item.id]: idx }))}
                    className={cn("w-11 h-11 rounded-xl border-2 text-base font-black flex items-center justify-center shrink-0",
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
              <p className="text-xs font-bold text-muted-foreground">{t("posView.split.guestLabel", { n: idx + 1 })}</p>
              <p className="text-base font-black">{formatCurrency(bucketTotal(idx), currency)}</p>
            </div>
          ))}
        </div>
        {!allAssigned && <p className="text-sm font-bold text-warning">{t("posView.split.mustAssignAll")}</p>}
        {allAssigned && usedBuckets < 2 && <p className="text-sm font-bold text-warning">{t("posView.split.minTwoGuests")}</p>}
        <div className="flex gap-2">
          <Button variant="outline" size="lg" className="flex-1" onClick={onCancel}>{t("posView.common.cancel")}</Button>
          <Button size="lg" className="flex-1" disabled={!allAssigned || usedBuckets < 2 || busy} onClick={handleConfirm}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("posView.split.submit")}
          </Button>
        </div>
      </div>
    </LeftDrawer>
  );
}

// ─── Combo picker — resolve each "choose one" slot before ordering a combo ────
export function ComboPickerModal({ combo, menu, busy, onConfirm, onCancel }: {
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
        <p className="text-xl font-black text-foreground">{combo.name}</p>
        <button onClick={onCancel}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>

      <div className="space-y-3">
          {combo.items.map(slot => (
            <div key={slot.id}>
              {slot.categoryId ? (
                <>
                  <label className="text-xs text-muted-foreground">{t("posView.combo.chooseOne", { category: slot.categoryName })}</label>
                  <select value={choices[slot.id] ?? ""} onChange={e => setChoices(prev => ({ ...prev, [slot.id]: e.target.value }))}
                    className="w-full h-12 text-base rounded-xl border-2 border-border bg-card px-3 mt-1">
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
export function SendReceiptModal({ busy, onConfirm, onCancel }: {
  busy: boolean; onConfirm: (channel: "email" | "sms" | "whatsapp", recipientAddress: string) => void; onCancel: () => void;
}) {
  const { t } = useTranslation("restaurant");
  const [channel, setChannel] = React.useState<"email" | "sms" | "whatsapp">("email");
  const [recipient, setRecipient] = React.useState("");

  return (
    <LeftDrawer onClose={onCancel} widthClassName="max-w-sm" zIndexClassName="z-[60]">
      <div className="flex items-center justify-between">
        <p className="text-xl font-black text-foreground">{t("posView.receipt.title")}</p>
        <button onClick={onCancel}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>
      <div className="flex gap-2">
        <button onClick={() => setChannel("email")}
          className={cn("flex-1 h-12 rounded-xl text-base font-bold", channel === "email" ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground")}>
          {t("posView.receipt.email")}
        </button>
        <button onClick={() => setChannel("sms")}
          className={cn("flex-1 h-12 rounded-xl text-base font-bold", channel === "sms" ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground")}>
          {t("posView.receipt.sms")}
        </button>
        <button onClick={() => setChannel("whatsapp")}
          className={cn("flex-1 h-12 rounded-xl text-base font-bold", channel === "whatsapp" ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground")}>
          {t("posView.receipt.whatsapp")}
        </button>
      </div>
      <Input value={recipient} onChange={e => setRecipient(e.target.value)}
        placeholder={channel === "email" ? t("posView.receipt.emailPlaceholder") : t("posView.receipt.phonePlaceholder")} className="h-12 text-base" />
      <div className="flex gap-2">
        <Button variant="outline" size="lg" className="flex-1" onClick={onCancel}>{t("posView.common.cancel")}</Button>
        <Button size="lg" className="flex-1" disabled={!recipient.trim() || busy} onClick={() => onConfirm(channel, recipient.trim())}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("posView.common.send")}
        </Button>
      </div>
    </LeftDrawer>
  );
}
// ─── New Delivery Order — quick-create (order + delivery leg together) ────────
// Deliberately simpler than the full OrderDrawer (no modifiers/combos) — a v1 scope cut for the
// delivery quick-create path; staff can still edit items via the normal Orders tab afterward.
export function NewDeliveryOrderModal({ currency, onClose }: { currency: string; onClose: () => void }) {
  const { t } = useTranslation("restaurant");
  const { user } = useAuthStore();
  const { branchId } = useCurrentBranch();
  const { data: menu = [] } = useMenu();
  const { data: zones = [] } = useDeliveryZones();
  const createOrder = useCreateOrder();
  const createDelivery = useCreateDeliveryOrder();
  const assignDriver = useAssignDriverToDelivery();
  const { data: drivers = [] } = useDrivers(true);
  const [driverId, setDriverId] = React.useState("");

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
    const delivery = await createDelivery.mutateAsync({ orderId: order.id, address: address.trim(), phone: phone.trim(), deliveryZoneId: zoneId || null });
    // The order is already placed; a failed rider assignment is reported by the hook and can be redone from the order.
    if (driverId) await assignDriver.mutateAsync({ id: delivery.id, driverId }).catch(() => {});
    onClose();
  };

  return (
    <LeftDrawer onClose={onClose} widthClassName="max-w-lg">
      <div className="flex items-center justify-between">
        <p className="text-xl font-black text-foreground">🛵 {t("posView.newDelivery.title")}</p>
        <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div><label className="text-xs text-muted-foreground">{t("posView.newDelivery.guestName")}</label>
          <Input value={guestName} onChange={e => setGuestName(e.target.value)} className="h-12 text-base" /></div>
        <div><label className="text-xs text-muted-foreground">{t("posView.newDelivery.phone")}</label>
          <Input value={phone} onChange={e => setPhone(e.target.value)} className="h-12 text-base" /></div>
      </div>
      <div><label className="text-xs text-muted-foreground">{t("posView.newDelivery.address")}</label>
        <Input value={address} onChange={e => setAddress(e.target.value)} className="h-12 text-base" /></div>
      {zones.length > 0 && (
        <div><label className="text-xs text-muted-foreground">{t("posView.newDelivery.zone")}</label>
          <select value={zoneId} onChange={e => setZoneId(e.target.value)} className="w-full h-12 text-base rounded-xl border-2 border-border bg-card px-3">
            <option value="">{t("posView.newDelivery.noZone")}</option>
            {zones.filter(z => z.isActive).map(z => <option key={z.id} value={z.id}>{z.name} — {formatCurrency(z.deliveryFee, currency)}</option>)}
          </select></div>
      )}

      {drivers.length > 0 && (
        <div><label className="text-xs text-muted-foreground">{t("posView.screen.rider")}</label>
          <select value={driverId} onChange={e => setDriverId(e.target.value)} className="w-full h-12 text-base rounded-xl border-2 border-border bg-card px-3">
            <option value="">{t("posView.screen.assignLater")}</option>
            {drivers.map(d => <option key={d.id} value={d.id}>{d.name}{d.vehicleInfo ? ` — ${d.vehicleInfo}` : ""}</option>)}
          </select></div>
      )}

      <p className="text-xs font-semibold text-muted-foreground pt-2">{t("posView.newDelivery.items")}</p>
      <div className="max-h-72 overflow-auto space-y-1 rounded-xl border-2 border-border p-1">
        {allItems.filter(i => i.isAvailable).map(item => (
          <button key={item.id} onClick={() => addItem(item)}
            className="w-full min-h-12 flex items-center justify-between px-3 py-2 rounded-xl hover:bg-muted/40 text-start">
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

// ─── Pick a person — a waiter for the table, or a rider for the delivery ─────
export interface PersonOption { id: string; name: string; detail?: string | null }

export function PersonSheet({ title, people, currentName, loading, busy, emptyText, onPick, onClose }: {
  title: string; people: PersonOption[]; currentName?: string | null; loading?: boolean; busy?: boolean;
  emptyText: string; onPick: (person: PersonOption) => void; onClose: () => void;
}) {
  const { t } = useTranslation("restaurant");
  const [search, setSearch] = React.useState("");
  const q = search.trim().toLowerCase();
  const shown = q ? people.filter(p => p.name.toLowerCase().includes(q)) : people;

  return (
    <LeftDrawer onClose={onClose} widthClassName="max-w-md" zIndexClassName="z-[70]">
      <p className="text-2xl font-black text-foreground">{title}</p>
      {people.length > 8 && (
        <div className="relative">
          <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder={t("posView.screen.searchPeople")}
            className="w-full h-12 ps-11 pe-3 rounded-xl border-2 border-border bg-card text-base font-semibold focus:outline-none focus:border-primary" />
        </div>
      )}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : shown.length === 0 ? (
        <p className="text-base font-semibold text-muted-foreground text-center py-10">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {shown.map(p => {
            const current = !!currentName && p.name === currentName;
            return (
              <button key={p.id} disabled={busy} onClick={() => onPick(p)}
                className={cn("w-full min-h-16 px-4 py-2 rounded-2xl border-2 flex items-center gap-3 text-start transition-colors disabled:opacity-50",
                  current ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary")}>
                <span className="h-11 w-11 rounded-full bg-muted flex items-center justify-center text-lg font-black shrink-0">
                  {p.name.trim().charAt(0).toUpperCase()}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-lg font-bold text-foreground truncate">{p.name}</span>
                  {p.detail && <span className="block text-sm font-semibold text-muted-foreground truncate">{p.detail}</span>}
                </span>
                {current && <Check className="h-6 w-6 text-primary shrink-0" strokeWidth={3} />}
              </button>
            );
          })}
        </div>
      )}
    </LeftDrawer>
  );
}
