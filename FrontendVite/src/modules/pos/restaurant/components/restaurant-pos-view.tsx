import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency } from "@/lib/utils";
import {
  X, Plus, Minus, UtensilsCrossed, ChevronRight, Users,
  Search, Receipt, Trash2, Send, CheckCircle2, Ban, Loader2, EyeOff, Eye,
  Tag, Percent, Ticket, ChevronDown,
} from "lucide-react";
import {
  useTables, useTablesSummary, useMenu, useOrders, useOrdersSummary,
  useCreateOrder, useAddItems, useRemoveItem, useSendToKitchen, useServeOrder,
  useCancelOrder, useSetItemAvailability, useApplyOrderDiscount,
} from "@/hooks/restaurant/use-restaurant";
import type { RestaurantTable, RestaurantOrder, MenuItem, TableStatus } from "@/lib/restaurant/restaurant.api";
import { AddTableForm } from "./add-table-form";
import { RestaurantPayDialog } from "./restaurant-pay-dialog";
import { useHardware }        from "@/contexts/hardware-context";
import { HardwareStatusBar }  from "@/components/pos/hardware-status-bar";
import { buildEscPosReceipt } from "@/lib/pos/receipt-escpos";
import { vouchersApi } from "@/lib/pos/vouchers.api";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth.store";

const TABLE_STATUS: Record<TableStatus, { label: string; color: string; bg: string; border: string; dot: string }> = {
  available: { label: "Available", color: "text-success",          bg: "bg-success/10",  border: "border-success/30",  dot: "bg-success" },
  occupied:  { label: "Occupied",  color: "text-primary",          bg: "bg-primary/10",  border: "border-primary/30",  dot: "bg-primary" },
  reserved:  { label: "Reserved",  color: "text-blue-500",         bg: "bg-blue-500/10", border: "border-blue-500/30", dot: "bg-blue-500" },
  cleaning:  { label: "Cleaning",  color: "text-muted-foreground", bg: "bg-muted/20",    border: "border-border",      dot: "bg-muted-foreground" },
};

const ORDER_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  open:      { label: "Open",       color: "text-muted-foreground", bg: "bg-muted/30" },
  sent:      { label: "In Kitchen", color: "text-warning",          bg: "bg-warning/10" },
  ready:     { label: "Ready",      color: "text-success",          bg: "bg-success/10" },
  served:    { label: "Served",     color: "text-primary",          bg: "bg-primary/10" },
  paid:      { label: "Paid",       color: "text-foreground",       bg: "bg-muted/20" },
  cancelled: { label: "Cancelled",  color: "text-destructive",      bg: "bg-destructive/10" },
};

const SECTION_EMOJI: Record<string, string> = { indoor: "🏠", outdoor: "☀️", terrace: "🌅", private: "🍽️", vip: "⭐", bar: "🍸" };
const sectionLabel = (s: string) => `${SECTION_EMOJI[s] ?? "🍽️"} ${s.charAt(0).toUpperCase() + s.slice(1)}`;

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
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{cfg.label}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-1">
        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {table.capacity} cap</span>
        {table.currentWaiter && <span className="truncate">{table.currentWaiter}</span>}
      </div>
      {order && (
        <p className="text-xs font-medium text-primary mt-1">
          {order.orderNumber.slice(-8)} · {formatCurrency(order.total, currency)} · {ORDER_STATUS[order.status]?.label}
        </p>
      )}
      <ChevronRight className="absolute right-3 bottom-3 w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

// ─── Order Drawer ─────────────────────────────────────────────────────────────
interface PendingLine { menuItem: MenuItem; quantity: number; modifiers: string }

function OrderDrawer({ table, order, isTakeaway, currency, onClose, onOrderCreated }: {
  table: RestaurantTable | null; order: RestaurantOrder | null; isTakeaway: boolean;
  currency: string; onClose: () => void; onOrderCreated?: (orderId: string) => void;
}) {
  const { user } = useAuthStore();
  const { data: menu = [] } = useMenu();
  const { openDrawer, printRaw, printerStatus } = useHardware();

  const createOrder = useCreateOrder();
  const addItems    = useAddItems();
  const removeItem  = useRemoveItem();
  const sendKitchen = useSendToKitchen();
  const serveOrder  = useServeOrder();
  const cancelOrder = useCancelOrder();
  const setAvail    = useSetItemAvailability();
  const applyDisc   = useApplyOrderDiscount();

  const [panel, setPanel]       = React.useState<"order" | "menu">(order ? "order" : "menu");
  const [search, setSearch]     = React.useState("");
  const [catId, setCatId]       = React.useState<string>("all");
  const [covers, setCovers]     = React.useState(String(table ? Math.min(2, table.capacity) : 1));
  const [pending, setPending]   = React.useState<PendingLine[]>([]);
  const [showPay, setShowPay]   = React.useState(false);
  const [manageMenu, setManage] = React.useState(false);

  // Discount UI
  const [showDisc, setShowDisc]   = React.useState(false);
  const [discTab, setDiscTab]     = React.useState<"pct" | "fixed" | "voucher">("pct");
  const [discValue, setDiscValue] = React.useState("");
  const [voucherCode, setVoucherCode] = React.useState("");
  const [voucherMsg, setVoucherMsg]   = React.useState<{ ok: boolean; text: string } | null>(null);
  const [appliedVoucher, setAppliedVoucher] = React.useState<string | null>(null);
  const [voucherBusy, setVoucherBusy] = React.useState(false);

  const busy = createOrder.isPending || addItems.isPending || sendKitchen.isPending ||
               serveOrder.isPending || cancelOrder.isPending || applyDisc.isPending;

  const applyPct = () => {
    if (!order) return; const v = parseFloat(discValue) || 0;
    if (v <= 0 || v > 100) return;
    applyDisc.mutate({ id: order.id, amount: Math.round(order.subTotal * (v / 100) * 100) / 100 });
    setAppliedVoucher(null);
  };
  const applyFixed = () => {
    if (!order) return; const v = parseFloat(discValue) || 0;
    if (v <= 0) return;
    applyDisc.mutate({ id: order.id, amount: Math.min(v, order.subTotal) });
    setAppliedVoucher(null);
  };
  const applyVoucher = async () => {
    if (!order) return;
    const code = voucherCode.trim().toUpperCase();
    if (!code) return;
    setVoucherBusy(true); setVoucherMsg(null);
    try {
      const res = await vouchersApi.validate(code, order.subTotal);
      if (res.valid) {
        await applyDisc.mutateAsync({ id: order.id, amount: res.discountAmount });
        setAppliedVoucher(code);
        setVoucherMsg({ ok: true, text: `Applied — ${res.discountAmount.toFixed(2)} off` });
      } else {
        setVoucherMsg({ ok: false, text: res.message ?? "Voucher not valid." });
      }
    } catch (e: any) {
      setVoucherMsg({ ok: false, text: e?.message ?? "Validation failed." });
    } finally { setVoucherBusy(false); }
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
      });
      await printRaw(esc).catch(() => {});
    }
    toast.success("Bill settled.");
    setShowPay(false);
    onClose();
  };

  const allItems = React.useMemo(() => menu.flatMap(c => c.items.map(i => ({ ...i, categoryId: c.id }))), [menu]);
  const filteredMenu = React.useMemo(() => {
    const q = search.toLowerCase();
    return allItems.filter(m =>
      (!q || m.name.toLowerCase().includes(q)) && (catId === "all" || m.categoryId === catId));
  }, [allItems, search, catId]);

  const addPending = (mi: MenuItem) => setPending(prev => {
    const ex = prev.find(p => p.menuItem.id === mi.id);
    if (ex) return prev.map(p => p.menuItem.id === mi.id ? { ...p, quantity: p.quantity + 1 } : p);
    return [...prev, { menuItem: mi, quantity: 1, modifiers: "" }];
  });
  const setPendingQty = (id: string, delta: number) => setPending(prev =>
    prev.map(p => p.menuItem.id === id ? { ...p, quantity: p.quantity + delta } : p).filter(p => p.quantity > 0));
  const pendingTotal = pending.reduce((s, p) => s + p.menuItem.price * p.quantity, 0);

  const lines = () => pending.map(p => ({ menuItemId: p.menuItem.id, quantity: p.quantity, modifiers: p.modifiers || null }));

  const handleOpenOrder = async () => {
    if (!pending.length) return;
    const created = await createOrder.mutateAsync({
      tableId: table?.id ?? null, waiter: user?.name ?? "Waiter",
      covers: parseInt(covers, 10) || 1,
      orderType: isTakeaway ? "takeaway" : "dine_in", notes: null, items: lines(),
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
                {table ? `Table ${table.tableNumber}` : "Takeaway Order"}
              </p>
              {table ? (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${TABLE_STATUS[table.status].bg} ${TABLE_STATUS[table.status].color}`}>
                  {TABLE_STATUS[table.status].label}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning">🥡 Takeaway</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {table ? `${sectionLabel(table.section)} · ${table.capacity} capacity` : "Counter / pickup"}
              {order ? ` · ${order.waiter}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0">
          {[{ key: "order", label: "Current Order" }, { key: "menu", label: "Add Items" }].map(t => (
            <button key={t.key} onClick={() => setPanel(t.key as "order" | "menu")}
              className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${panel === t.key ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              {t.label}{t.key === "menu" && pending.length > 0 ? ` (${pending.reduce((s, p) => s + p.quantity, 0)})` : ""}
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
                  <p className="text-sm text-muted-foreground">No active order</p>
                  <Button size="sm" className="mt-4" onClick={() => setPanel("menu")}>
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Add items to start
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-mono text-muted-foreground">{order.orderNumber}</p>
                      <p className="text-xs text-muted-foreground">{order.covers} covers · {order.waiter}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${ORDER_STATUS[order.status]?.bg} ${ORDER_STATUS[order.status]?.color}`}>
                      {ORDER_STATUS[order.status]?.label}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {order.items.map(item => (
                      <div key={item.id} className="flex items-start justify-between py-2.5 border-b border-border last:border-0">
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="text-sm text-foreground"><span className="text-primary font-semibold mr-1">×{item.quantity}</span>{item.itemName}</p>
                          {item.modifiers && <p className="text-xs text-warning mt-0.5 italic">{item.modifiers}</p>}
                          <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(item.unitPrice, currency)} each</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <p className="text-sm font-semibold text-foreground">{formatCurrency(item.lineTotal, currency)}</p>
                          {order.status === "open" && (
                            <button onClick={() => removeItem.mutate({ id: order.id, itemId: item.id })}
                              className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Discount control (open orders only) */}
                  {order.status !== "paid" && order.status !== "cancelled" && (
                    <div className="rounded-xl border border-border overflow-hidden">
                      <button onClick={() => setShowDisc(s => !s)} className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold hover:bg-muted/30">
                        <span className="flex items-center gap-1.5"><Tag className="h-3.5 w-3.5 text-primary" />Discount
                          {order.discountAmount > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-success/15 text-success text-[10px]">-{formatCurrency(order.discountAmount, currency)}</span>}
                        </span>
                        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showDisc && "rotate-180")} />
                      </button>
                      {showDisc && (
                        <div className="p-3 border-t border-border space-y-2">
                          <div className="grid grid-cols-3 gap-1">
                            {[{ id: "pct", label: "Percent", icon: Percent }, { id: "fixed", label: "Amount", icon: Tag }, { id: "voucher", label: "Voucher", icon: Ticket }].map(t => {
                              const Icon = t.icon;
                              return (
                                <button key={t.id} onClick={() => { setDiscTab(t.id as any); setVoucherMsg(null); }}
                                  className={cn("flex flex-col items-center gap-1 py-1.5 rounded-lg border text-[10px] font-semibold",
                                    discTab === t.id ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground")}>
                                  <Icon className="h-3.5 w-3.5" />{t.label}
                                </button>
                              );
                            })}
                          </div>
                          {discTab === "pct" && (
                            <div className="flex gap-2"><Input type="number" min={0} max={100} value={discValue} onChange={e => setDiscValue(e.target.value)} placeholder="0" className="h-8 text-sm" /><Button size="sm" className="h-8" onClick={applyPct}>Apply</Button></div>
                          )}
                          {discTab === "fixed" && (
                            <div className="flex gap-2"><Input type="number" min={0} value={discValue} onChange={e => setDiscValue(e.target.value)} placeholder="0.00" className="h-8 text-sm" /><Button size="sm" className="h-8" onClick={applyFixed}>Apply</Button></div>
                          )}
                          {discTab === "voucher" && (
                            <div className="space-y-1.5">
                              <div className="flex gap-2">
                                <Input value={voucherCode} onChange={e => setVoucherCode(e.target.value.toUpperCase())} placeholder="CODE" className="h-8 text-sm font-mono uppercase" />
                                <Button size="sm" className="h-8 min-w-[64px]" onClick={applyVoucher} disabled={voucherBusy}>{voucherBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply"}</Button>
                              </div>
                              {voucherMsg && <p className={cn("text-[11px]", voucherMsg.ok ? "text-success" : "text-destructive")}>{voucherMsg.text}</p>}
                            </div>
                          )}
                          {order.discountAmount > 0 && (
                            <button onClick={() => { applyDisc.mutate({ id: order.id, amount: 0 }); setAppliedVoucher(null); }}
                              className="text-[11px] text-destructive hover:underline">Remove discount</button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-xs text-muted-foreground"><span>Subtotal</span><span>{formatCurrency(order.subTotal, currency)}</span></div>
                    {order.discountAmount > 0 && <div className="flex justify-between text-xs text-success"><span>Discount</span><span>-{formatCurrency(order.discountAmount, currency)}</span></div>}
                    <div className="flex justify-between text-xs text-muted-foreground"><span>VAT (5%)</span><span>{formatCurrency(order.taxAmount, currency)}</span></div>
                    <div className="flex justify-between text-sm font-bold text-foreground pt-2 border-t border-border"><span>Total</span><span>{formatCurrency(order.total, currency)}</span></div>
                    {order.amountPaid > 0 && order.status !== "paid" && (
                      <div className="flex justify-between text-xs text-primary"><span>Paid so far</span><span>{formatCurrency(order.amountPaid, currency)} · {formatCurrency(order.outstanding, currency)} left</span></div>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            /* Menu panel */
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search menu…" className="pl-9 h-9 text-sm" />
                </div>
                <Button variant={manageMenu ? "default" : "outline"} size="sm" onClick={() => setManage(m => !m)} title="Toggle availability editing">
                  {manageMenu ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </Button>
              </div>

              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <button onClick={() => setCatId("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${catId === "all" ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"}`}>All</button>
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
                      <p className="text-xs text-muted-foreground">{item.prepTimeMinutes}min{item.allergens ? ` · ${item.allergens}` : ""}</p>
                    </div>
                    <p className="text-sm font-semibold text-foreground shrink-0">{formatCurrency(item.price, currency)}</p>
                    {manageMenu ? (
                      <button onClick={() => setAvail.mutate({ id: item.id, isAvailable: !item.isAvailable })}
                        className={cn("px-2 py-1 rounded-lg text-xs font-semibold shrink-0", item.isAvailable ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                        {item.isAvailable ? "Available" : "86'd"}
                      </button>
                    ) : (
                      <button disabled={!item.isAvailable || (order != null && order.status !== "open")} onClick={() => addPending(item)}
                        className="flex items-center gap-0.5 text-xs text-primary hover:underline disabled:opacity-40 disabled:no-underline shrink-0">
                        <Plus className="w-3 h-3" /> Add
                      </button>
                    )}
                  </div>
                ))}
                {filteredMenu.length === 0 && <p className="text-center text-xs text-muted-foreground py-8">No items found.</p>}
              </div>

              {/* Pending additions */}
              {pending.length > 0 && (
                <div className="border border-primary/20 bg-primary/5 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-semibold text-primary">To add ({pending.reduce((s, p) => s + p.quantity, 0)} items · {formatCurrency(pendingTotal, currency)})</p>
                  {pending.map(p => (
                    <div key={p.menuItem.id} className="flex items-center gap-2">
                      <span className="flex-1 text-xs text-foreground truncate">{p.menuItem.name}</span>
                      <button onClick={() => setPendingQty(p.menuItem.id, -1)} className="w-5 h-5 rounded bg-muted flex items-center justify-center"><Minus className="w-2.5 h-2.5" /></button>
                      <span className="text-xs font-bold w-4 text-center">{p.quantity}</span>
                      <button onClick={() => setPendingQty(p.menuItem.id, 1)} className="w-5 h-5 rounded bg-muted flex items-center justify-center"><Plus className="w-2.5 h-2.5" /></button>
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
              <span className="text-xs text-muted-foreground">Guests:</span>
              <Input type="number" min={1} max={table.capacity} value={covers} onChange={e => setCovers(e.target.value)} className="h-8 w-20 text-sm" />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {!order && (
              <Button className="flex-1" size="sm" disabled={!pending.length || busy} onClick={handleOpenOrder}>
                {createOrder.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Plus className="w-3.5 h-3.5 mr-1.5" />Open Order</>}
              </Button>
            )}
            {order && pending.length > 0 && (
              <Button className="flex-1" size="sm" disabled={busy} onClick={handleAddItems}>
                {addItems.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Plus className="w-3.5 h-3.5 mr-1.5" />Add {pending.reduce((s, p) => s + p.quantity, 0)} items</>}
              </Button>
            )}
            {order && order.status === "open" && pending.length === 0 && (
              <Button className="flex-1" size="sm" disabled={busy} onClick={() => sendKitchen.mutate(order.id)}>
                <Send className="w-3.5 h-3.5 mr-1.5" />Send to Kitchen
              </Button>
            )}
            {order && (order.status === "ready" || order.status === "sent") && pending.length === 0 && (
              <Button className="flex-1" size="sm" disabled={busy} onClick={() => serveOrder.mutate(order.id)}>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />Mark Served
              </Button>
            )}
            {order && order.status !== "paid" && order.status !== "cancelled" && pending.length === 0 && (
              <Button className="flex-1" size="sm" variant="outline" disabled={busy} onClick={() => setShowPay(true)}>
                <Receipt className="w-3.5 h-3.5 mr-1.5" />Bill &amp; Pay
              </Button>
            )}
            {order && order.status === "open" && pending.length === 0 && (
              <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => { cancelOrder.mutate(order.id); onClose(); }}>
                <Ban className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Bill & payment dialog (single / split-tender / split-by-members) */}
      {showPay && order && (
        <RestaurantPayDialog order={order} currency={currency} onPaid={handlePaid} onClose={() => setShowPay(false)} />
      )}
    </>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────
export function RestaurantPOSView() {
  const { tenant } = useAuthStore();
  const currency = tenant?.currency || "AED";

  const [sectionFilter, setSectionFilter] = React.useState<string>("all");
  const [selectedTableId, setSelectedTableId] = React.useState<string | null>(null);
  const [takeaway, setTakeaway] = React.useState<string | null>(null); // "new" | orderId
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
          <h1 className="text-xl font-bold text-foreground">Restaurant POS</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {tablesSummary?.total ?? tables.length} tables · {tablesSummary?.occupied ?? 0} occupied · {ordersSummary?.sent ?? 0} in kitchen
          </p>
        </div>
        <div className="flex items-center gap-2">
          <HardwareStatusBar />
          <Button variant={activeTab === "floor" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("floor")}>Floor Plan</Button>
          <Button variant={activeTab === "orders" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("orders")}>Orders</Button>
          <Button size="sm" className="gap-1.5" onClick={() => setTakeaway("new")}>🥡 Takeaway</Button>
          <Button size="sm" variant="outline" onClick={() => setShowAddTable(true)}><Plus className="w-3.5 h-3.5 mr-1.5" />Add Table</Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total Tables" value={tablesSummary?.total ?? tables.length} accent="bg-primary" />
          <StatCard label="Occupied"     value={tablesSummary?.occupied ?? 0} accent="bg-primary" />
          <StatCard label="Available"    value={tablesSummary?.available ?? 0} accent="bg-success" />
          <StatCard label="Reserved"     value={tablesSummary?.reserved ?? 0} accent="bg-blue-500" />
          <StatCard label="In Kitchen"   value={ordersSummary?.sent ?? 0} accent="bg-warning" />
          <StatCard label="Today Sales"  value={formatCurrency(ordersSummary?.todayRevenue ?? 0, currency)} accent="bg-success" />
        </div>

        {activeTab === "floor" ? (
          <>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setSectionFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${sectionFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"}`}>All Sections</button>
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
                    <p className="text-xs text-muted-foreground">{secTables.length} tables</p>
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
            <div className="px-4 py-3 border-b border-border"><p className="text-sm font-semibold text-foreground">Orders</p></div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-border bg-muted/20">
                  {["Order #", "Table", "Items", "Total", "Status", "Waiter", ""].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">{h}</th>
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
                        <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sc?.bg} ${sc?.color}`}>{sc?.label}</span></td>
                        <td className="px-4 py-3 text-xs text-foreground">{o.waiter}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => {
                              if (o.orderType === "dine_in") { setSelectedTableId(o.tableId); setActiveTab("floor"); }
                              else { setTakeaway(o.id); }
                            }}
                            className="text-xs text-primary hover:underline flex items-center gap-1">View <ChevronRight className="w-3 h-3" /></button>
                        </td>
                      </tr>
                    );
                  })}
                  {orders.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-xs text-muted-foreground">No orders yet.</td></tr>}
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
            isTakeaway={!selectedTable}
            currency={currency}
            onClose={closeDrawer}
            onOrderCreated={(id) => { if (!selectedTable) setTakeaway(id); }}
          />
        )}
      </AnimatePresence>
      <AddTableForm open={showAddTable} onClose={() => setShowAddTable(false)} />
    </div>
  );
}
