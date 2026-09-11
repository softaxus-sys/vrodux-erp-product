import * as React from "react";
import { AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, parseApiDate, fitTextClass } from "@/lib/utils";
import {
  ShoppingCart, Plus, Receipt, LogOut, Loader2, RefreshCw,
  SplitSquareHorizontal, Wallet, Printer,
} from "lucide-react";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import { useHardware }       from "@/contexts/hardware-context";
import { HardwareStatusBar } from "@/components/pos/hardware-status-bar";
import { buildEscPosReceipt } from "@/lib/pos/receipt-escpos";
import { AddPOSProductForm } from "./add-pos-product-form";
import { useAllPOSProducts } from "@/hooks/pos/use-products";
import { useShift } from "./shift-gate";
import { usePaymentMethods } from "@/hooks/pos/use-payment-methods";
import { useTransactions, useCreateSale } from "@/hooks/pos/use-transactions";
import { useAuthStore } from "@/store/auth.store";
import { CashierPOSView } from "./cashier-pos-view";
import { PosReceipt } from "./pos-receipt";
import { VoidConfirmDialog, RefundDialog } from "./void-refund-dialogs";
import { CustomerSelect, type SelectedCustomer } from "./customer-select";
import { DiscountPanel, type AppliedDiscount } from "./discount-panel";
import { SplitPaymentDialog } from "./split-payment-dialog";
import { CashMovementDialog } from "./cash-movement-dialog";
import { productsApi } from "@/lib/pos/products.api";
import { transactionsApi } from "@/lib/pos/transactions.api";
import type { POSTransactionSummaryDto } from "@/lib/pos/types";
import { toast } from "sonner";
import {
  type PosProduct, mapToPosProduct, usePosShortcuts,
  ScanToast, PosSearch, CategoryPills, ProductTile, PRODUCT_GRID, ProductsLoading, ProductsEmpty,
  CART_PANEL, CartHeader, HeldList, CartLine, EmptyCart, TotalsBlock,
  PaymentMethodGrid, CashTender, ChargeButton,
  TOP_BAR, TopBarBrand, TopBarButton, ShiftPill, LiveClock,
} from "./pos-ui";

// ─── Internal types ───────────────────────────────────────────────────────────

interface CartItem {
  productId: string;
  name: string;
  price: number;
  taxRate: number;
  quantity: number;
  total: number;
  emoji: string;
}

interface HeldItem { id: string; label: string; cart: CartItem[]; timestamp: string }

// Payment methods are dynamic — see usePaymentMethods() inside RetailPOSView

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  completed: { label: "Completed", color: "text-success",          bg: "bg-success/15" },
  refunded:  { label: "Refunded",  color: "text-warning",          bg: "bg-warning/15" },
  voided:    { label: "Voided",    color: "text-destructive",      bg: "bg-destructive/15" },
  pending:   { label: "Pending",   color: "text-muted-foreground", bg: "bg-muted" },
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, accent = "bg-primary" }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="bg-card border-2 border-border rounded-2xl p-5 min-w-0">
      <div className="flex items-center gap-2 mb-2">
        <span className={cn("w-3 h-3 rounded-full", accent)} />
        <p className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground truncate">{label}</p>
      </div>
      <p className={cn("font-black text-foreground truncate tabular-nums", fitTextClass(value, "3xl"))} title={String(value)}>{value}</p>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function RetailPOSView() {
  const { user, hasRawPermission, tenant } = useAuthStore();
  const currency       = tenant?.currency || "AED";
  const paymentMethods = usePaymentMethods();
  const { openDrawer, printRaw, printerStatus } = useHardware();
  // Must be called before any conditional return (rules of hooks)
  const { sessionId, shiftDuration, canCloseShift, openClosePanel } = useShift();

  // ── POS permission flags ──────────────────────────────────────────────────────
  const canAddProduct   = hasRawPermission("pos.products.create");
  const canDiscount     = hasRawPermission("pos.transactions.discount");
  const canVoid         = hasRawPermission("pos.transactions.void");
  const canRefund       = hasRawPermission("pos.transactions.refund");

  // ── Cashier mode: no supervisor/admin permissions → dedicated clean POS layout ──
  const isCashierMode = !canCloseShift && !canVoid && !canRefund && !canDiscount;
  if (isCashierMode) return <CashierPOSView />;

  const searchRef = React.useRef<HTMLInputElement>(null);

  // Navigation
  const [activeTab, setActiveTab]     = React.useState<"pos" | "history">("pos");

  // Product filtering
  const [search, setSearch]           = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");

  // Cart
  const [cart, setCart]               = React.useState<CartItem[]>([]);

  // Discount (multi-type: percentage | fixed | voucher | loyalty) + customer
  const [appliedDiscount, setAppliedDiscount] = React.useState<AppliedDiscount | null>(null);
  const [selectedCustomer, setSelectedCustomer] = React.useState<SelectedCustomer | null>(null);

  // Split payment & cash in/out
  const [showSplit, setShowSplit]   = React.useState(false);
  const [showCashMove, setCashMove] = React.useState(false);
  const [reprintingId, setReprintingId] = React.useState<string | null>(null);
  const [completedPayments, setCompletedPayments] = React.useState<{ method: string; amount: number }[]>([]);

  // Payment — default to first available method; update if the active one is removed
  const [paymentMethod, setPaymentMethod] = React.useState("Card");
  React.useEffect(() => {
    if (paymentMethods.length > 0 && !paymentMethods.find(m => m.id === paymentMethod)) {
      setPaymentMethod(paymentMethods[0].id);
    }
  }, [paymentMethods, paymentMethod]);
  const [tenderedAmount, setTenderedAmount] = React.useState("");
  const [showReceipt, setShowReceipt]     = React.useState(false);
  const [completedTxnNumber, setCompletedTxnNumber] = React.useState("");

  // Scanner feedback
  const [scanFeedback, setScanFeedback]   = React.useState<"found" | "not_found" | null>(null);
  const [scanItemName, setScanItemName]   = React.useState("");

  // Hold & recall
  const [heldTransactions, setHeldTransactions] = React.useState<HeldItem[]>([]);
  const [showHeldPanel, setShowHeldPanel] = React.useState(false);

  // Add product form
  const [showAddForm, setShowAddForm]     = React.useState(false);

  // Void / Refund dialog targets
  const [voidTarget,   setVoidTarget]   = React.useState<POSTransactionSummaryDto | null>(null);
  const [refundTarget, setRefundTarget] = React.useState<POSTransactionSummaryDto | null>(null);

  // ── API hooks ─────────────────────────────────────────────────────────────────
  const { data: productsData, isLoading: productsLoading, refetch: refetchProducts } = useAllPOSProducts();
  const createSaleMutation   = useCreateSale();

  // Transactions for history tab (scoped to current session)
  const { data: txnData, isLoading: txnLoading } = useTransactions({
    sessionId: sessionId ?? undefined,
    pageSize: 50,
  });

  // ── Products ──────────────────────────────────────────────────────────────────
  const allProducts = React.useMemo(
    () => (productsData?.items ?? []).map(mapToPosProduct),
    [productsData]
  );

  const categories = React.useMemo(
    () => [...new Set(allProducts.map(p => p.category))].sort(),
    [allProducts]
  );

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    return allProducts.filter(p => {
      const matchSearch = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.includes(q);
      const matchCat = categoryFilter === "all" || p.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [allProducts, search, categoryFilter]);

  // ── Cart actions ──────────────────────────────────────────────────────────────
  const addToCart = React.useCallback((product: PosProduct) => {
    setCart(prev => {
      const ex = prev.find(i => i.productId === product.id);
      if (ex) return prev.map(i => i.productId === product.id
        ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.price }
        : i
      );
      return [...prev, { productId: product.id, name: product.name, price: product.price, taxRate: product.taxRate, quantity: 1, total: product.price, emoji: product.emoji }];
    });
  }, []);

  const updateQty = React.useCallback((productId: string, delta: number) => {
    setCart(prev => prev.map(i => i.productId === productId
      ? { ...i, quantity: i.quantity + delta, total: (i.quantity + delta) * i.price }
      : i
    ).filter(i => i.quantity > 0));
  }, []);

  const removeFromCart = React.useCallback((productId: string) =>
    setCart(prev => prev.filter(i => i.productId !== productId)), []);

  const cartQty = React.useMemo(() => {
    const m: Record<string, number> = {};
    cart.forEach(i => { m[i.productId] = i.quantity; });
    return m;
  }, [cart]);

  // ── Scanner ───────────────────────────────────────────────────────────────────
  useBarcodeScanner({
    enabled: activeTab === "pos",
    onScan: async ({ barcode }) => {
      // First try local cache
      const local = allProducts.find(p => p.barcode === barcode || p.sku === barcode);
      if (local && local.stock > 0) {
        addToCart(local);
        setScanItemName(local.name);
        setScanFeedback("found");
      } else if (!local) {
        // Fallback: query API by barcode
        try {
          const product = await productsApi.getByBarcode(barcode);
          if (product.isActive && product.stockQuantity > 0) {
            const mapped = mapToPosProduct({ ...product, categoryName: product.categoryName });
            addToCart(mapped);
            setScanItemName(mapped.name);
            setScanFeedback("found");
          } else {
            setScanItemName(barcode);
            setScanFeedback("not_found");
          }
        } catch {
          setScanItemName(barcode);
          setScanFeedback("not_found");
        }
      } else {
        setScanItemName(barcode);
        setScanFeedback("not_found");
      }
      setTimeout(() => setScanFeedback(null), 2500);
    },
  });

  // ── Totals ────────────────────────────────────────────────────────────────────
  const subtotal   = cart.reduce((s, i) => s + i.total, 0);
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);

  // Order-level discount comes from the multi-type DiscountPanel (preview amount).
  // The backend re-resolves & validates it authoritatively at sale time.
  const discountAmount = React.useMemo(() => {
    if (!appliedDiscount || cart.length === 0) return 0;
    return Math.min(appliedDiscount.amount, subtotal);
  }, [appliedDiscount, subtotal, cart.length]);

  // Clear an applied discount if the cart empties
  React.useEffect(() => {
    if (cart.length === 0 && appliedDiscount) setAppliedDiscount(null);
  }, [cart.length, appliedDiscount]);

  const taxBase   = subtotal - discountAmount;
  const taxAmount = Math.round(cart.reduce((s, i) => {
    if (!subtotal) return 0;
    const itemShare = (i.total / subtotal) * taxBase;
    return s + itemShare * (i.taxRate / 100);
  }, 0) * 100) / 100;
  const total   = Math.round((taxBase + taxAmount) * 100) / 100;

  const cashShort = paymentMethod === "Cash" && !!tenderedAmount && parseFloat(tenderedAmount) < total;
  const canCharge = cart.length > 0 && !!sessionId && !createSaleMutation.isPending && !cashShort;

  // ── Checkout ──────────────────────────────────────────────────────────────────
  // Accepts an optional payments array (used by split-tender). Defaults to a
  // single payment for the full total on the selected method.
  const handleCheckout = async (paymentsOverride?: import("@/lib/pos/types").PaymentRequest[]) => {
    if (!cart.length || !sessionId) return;

    const payments = paymentsOverride ?? [{ method: paymentMethod, amount: total, reference: null }];
    const hasCash  = payments.some(p => p.method.toLowerCase() === "cash");

    try {
      const txn = await createSaleMutation.mutateAsync({
        sessionId,
        customerId: selectedCustomer?.id ?? null,
        lineItems: cart.map(item => ({
          productId:       item.productId,
          quantity:        item.quantity,
          discountPercent: 0,
          discountAmount:  0,
        })),
        payments,
        // Order-level discount — resolved & validated server-side
        orderDiscount: appliedDiscount?.descriptor ?? { type: "none" },
      });

      setCompletedTxnNumber(txn.transactionNumber);
      setCompletedPayments(payments.map(p => ({ method: p.method, amount: p.amount })));
      setShowReceipt(true);
      setShowSplit(false);
      refetchProducts();

      // Open cash drawer on any cash payment
      if (hasCash) await openDrawer();

      // Auto-print to thermal printer if connected
      if (printerStatus === "ready") {
        const escData = buildEscPosReceipt({
          companyName:    tenant?.branding?.companyName ?? "Vrodux Retail",
          txnNumber:      txn.transactionNumber,
          cashierName:    user?.name,
          currency,
          taxLabel:       tenant?.country?.toLowerCase().includes("uae") ? "VAT" : "GST",
          cart,
          subtotal,
          discountAmount,
          taxAmount,
          total,
          paymentMethod: payments.length > 1 ? "Split" : paymentMethod,
          payments:      payments.map(p => ({ method: p.method, amount: p.amount })),
          tendered:       parseFloat(tenderedAmount) || 0,
          openDrawer:     hasCash,
        });
        printRaw(escData).catch(() => {/* non-fatal — receipt modal is still shown */});
      }
    } catch {
      // error shown via mutation's onError toast
    }
  };

  const handleNewSale = () => {
    setCart([]);
    setAppliedDiscount(null);
    setSelectedCustomer(null);
    setShowReceipt(false);
    setTenderedAmount("");
    setCompletedTxnNumber("");
    setCompletedPayments([]);
  };

  // ── Reprint a past receipt to the network printer ──────────────────────────────
  const handleReprint = async (txnId: string) => {
    setReprintingId(txnId);
    try {
      const txn = await transactionsApi.getById(txnId);
      const items = txn.lineItems.map(li => ({
        productId: li.productId,
        name:      li.productName,
        quantity:  li.quantity,
        price:     li.unitPrice,
        taxRate:   li.taxRate,
        total:     Math.round((li.unitPrice * li.quantity - li.discountAmount) * 100) / 100,
      }));
      const sub = items.reduce((s, i) => s + i.total, 0);
      const escData = buildEscPosReceipt({
        companyName:    tenant?.branding?.companyName ?? "Vrodux Retail",
        txnNumber:      txn.transactionNumber,
        cashierName:    user?.name,
        currency,
        taxLabel:       tenant?.country?.toLowerCase().includes("uae") ? "VAT" : "GST",
        cart:           items,
        subtotal:       sub,
        discountAmount: txn.discountAmount,
        taxAmount:      txn.taxAmount,
        total:          txn.totalAmount,
        paymentMethod:  txn.payments.length > 1 ? "Split" : (txn.payments[0]?.method ?? "—"),
        payments:       txn.payments.map(p => ({ method: p.method, amount: p.amount })),
        tendered:       0,
      });
      await printRaw(escData);
      toast.success(`Receipt ${txn.transactionNumber} reprinted.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Reprint failed — check the printer.");
    } finally {
      setReprintingId(null);
    }
  };

  // ── Hold & Recall ─────────────────────────────────────────────────────────────
  const holdCart = () => {
    if (!cart.length) return;
    const held: HeldItem = {
      id:        `hld-${Date.now()}`,
      label:     `Hold ${heldTransactions.length + 1} · ${cart.length} items · ${formatCurrency(total, currency)}`,
      cart:      [...cart],
      timestamp: new Date().toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" }),
    };
    setHeldTransactions(prev => [...prev, held]);
    setCart([]); setAppliedDiscount(null); setTenderedAmount("");
  };

  const recallHeld = (id: string) => {
    const held = heldTransactions.find(h => h.id === id);
    if (!held) return;
    setCart(held.cart);
    setHeldTransactions(prev => prev.filter(h => h.id !== id));
    setShowHeldPanel(false);
  };

  // ── Session summary stats ─────────────────────────────────────────────────────
  const txns = txnData?.items ?? [];
  const sessionStats = React.useMemo(() => ({
    totalSales:       txns.filter(t => t.type === "Sale" && t.status === "Completed")
                          .reduce((s, t) => s + t.totalAmount, 0),
    totalTransactions: txns.filter(t => t.type === "Sale").length,
    avgBasket:        txns.length ? txns.reduce((s, t) => s + t.totalAmount, 0) / txns.length : 0,
    refunds:          txns.filter(t => t.type === "Refund").length,
  }), [txns]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────
  usePosShortcuts({
    F2: () => searchRef.current?.focus(),
    F4: cart.length ? holdCart : undefined,
    F9: canCharge ? () => handleCheckout() : undefined,
  }, activeTab === "pos" && !showReceipt && !showSplit && !showAddForm && !showCashMove);

  return (
    <div className="flex flex-col h-full bg-muted/40 overflow-hidden">
      <ScanToast feedback={scanFeedback} itemName={scanItemName} />

      {/* Header */}
      <header className={TOP_BAR}>
        <TopBarBrand
          title={tenant?.branding?.companyName ?? "Retail POS"}
          subtitle={new Date().toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "long" })}
        />
        <div className="flex items-center gap-2">
          {sessionId && <ShiftPill duration={shiftDuration} extra={formatCurrency(sessionStats.totalSales, currency)} />}
          <HardwareStatusBar />
          <TopBarButton icon={ShoppingCart} label="Sell" active={activeTab === "pos"} onClick={() => setActiveTab("pos")} />
          <TopBarButton icon={Receipt} label="History" active={activeTab === "history"} badge={sessionStats.totalTransactions}
            onClick={() => setActiveTab("history")} />
          {canAddProduct && (
            <TopBarButton icon={Plus} label="Product" onClick={() => setShowAddForm(true)} title="Add product" />
          )}
          {sessionId && (
            <TopBarButton icon={Wallet} label="Cash In/Out" onClick={() => setCashMove(true)} />
          )}
          {canCloseShift && (
            <TopBarButton icon={LogOut} label="Close Shift" tone="danger" onClick={openClosePanel} />
          )}
          <LiveClock />
        </div>
      </header>

      {/* ── HISTORY TAB ────────────────────────────────────────────────────────── */}
      {activeTab === "history" ? (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Shift Sales"    value={formatCurrency(sessionStats.totalSales, currency)} accent="bg-success" />
            <StatCard label="Transactions"   value={sessionStats.totalTransactions} accent="bg-primary" />
            <StatCard label="Avg Basket"     value={formatCurrency(sessionStats.avgBasket, currency)} accent="bg-warning" />
            <StatCard label="Refunds"        value={sessionStats.refunds} accent="bg-destructive" />
          </div>
          <div className="bg-card border-2 border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b-2 border-border flex items-center justify-between">
              <p className="text-xl font-black">
                {sessionId ? "Shift Transactions" : "Today's Transactions"}
              </p>
              {!sessionId && (
                <p className="text-base font-semibold text-muted-foreground">Open a shift to track live sales</p>
              )}
            </div>
            {txnLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-border bg-muted/50">
                      {["Txn #", "Total", "Payment", "Time", "Status", "Actions"].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-sm font-extrabold uppercase tracking-wide text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {txns.map(tx => {
                      const statusKey = (tx.status ?? "").toLowerCase();
                      const sc = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.pending;
                      const PayIcon = paymentMethods.find(p => p.id.toLowerCase() === (tx.primaryPaymentMethod ?? "").toLowerCase())?.icon ?? Receipt;
                      const isCompleted = statusKey === "completed";
                      const actionBtn = "h-10 px-3 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5";
                      return (
                        <tr key={tx.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                          <td className="px-5 py-3.5 text-base font-mono font-semibold">{tx.transactionNumber}</td>
                          <td className="px-5 py-3.5 text-lg font-black tabular-nums">{formatCurrency(tx.totalAmount, currency)}</td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2 text-base font-semibold">
                              <PayIcon className="h-5 w-5 text-muted-foreground" />
                              <span>{tx.primaryPaymentMethod}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-base font-semibold text-muted-foreground tabular-nums">
                            {tx.completedAt ? parseApiDate(tx.completedAt).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" }) : "—"}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={cn("px-2.5 py-1 rounded-lg text-sm font-extrabold uppercase", sc.bg, sc.color)}>{sc.label}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleReprint(tx.id)}
                                disabled={reprintingId === tx.id}
                                title="Reprint receipt"
                                className={cn(actionBtn, "bg-primary/10 text-primary hover:bg-primary/20")}>
                                {reprintingId === tx.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                                Reprint
                              </button>
                              {canVoid && isCompleted && (
                                <button onClick={() => setVoidTarget(tx)}
                                  className={cn(actionBtn, "bg-destructive/10 text-destructive hover:bg-destructive/20")}>
                                  Void
                                </button>
                              )}
                              {canRefund && isCompleted && sessionId && (
                                <button onClick={() => setRefundTarget(tx)}
                                  className={cn(actionBtn, "bg-warning/10 text-warning hover:bg-warning/20")}>
                                  Refund
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {txns.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-14 text-center text-lg font-bold text-muted-foreground">
                          No transactions yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── SELL TAB ────────────────────────────────────────────────────────── */
        <div className="flex-1 flex overflow-hidden">
          {/* Left — Products */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <div className="px-5 pt-4 pb-3 space-y-3 shrink-0">
              <PosSearch ref={searchRef} value={search} onChange={setSearch} />
              <CategoryPills categories={categories} active={categoryFilter} onSelect={setCategoryFilter} />
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-5 pt-2">
              {productsLoading ? (
                <ProductsLoading />
              ) : filtered.length > 0 ? (
                <div className={PRODUCT_GRID}>
                  {filtered.map(p => (
                    <ProductTile key={p.id} product={p} currency={currency} inCart={cartQty[p.id] ?? 0} onAdd={() => addToCart(p)} />
                  ))}
                </div>
              ) : (
                <ProductsEmpty action={
                  <Button variant="outline" className="h-12 px-5 gap-2 text-base font-bold border-2" onClick={() => refetchProducts()}>
                    <RefreshCw className="h-5 w-5" />Refresh
                  </Button>
                } />
              )}
            </div>
          </div>

          {/* Right — Sale */}
          <aside className={CART_PANEL}>
            <CartHeader
              itemCount={totalItems}
              heldCount={heldTransactions.length}
              onHold={holdCart}
              onClear={() => { setCart([]); setTenderedAmount(""); }}
              onToggleHeld={() => setShowHeldPanel(p => !p)}
            />

            {/* Customer selector */}
            <div className="px-5 py-3 border-b-2 border-border shrink-0">
              <CustomerSelect selected={selectedCustomer} onSelect={setSelectedCustomer} />
            </div>

            <AnimatePresence>
              {showHeldPanel && heldTransactions.length > 0 && (
                <HeldList
                  items={heldTransactions.map(h => ({ id: h.id, title: h.label, subtitle: `Held at ${h.timestamp}` }))}
                  onRecall={recallHeld}
                />
              )}
            </AnimatePresence>

            {/* Cart items */}
            <div className="flex-1 min-h-[120px] overflow-y-auto px-5">
              {cart.length === 0 ? (
                <EmptyCart />
              ) : (
                <AnimatePresence mode="popLayout">
                  {cart.map(item => (
                    <CartLine
                      key={item.productId}
                      name={item.name}
                      price={item.price}
                      quantity={item.quantity}
                      total={item.total}
                      emoji={item.emoji}
                      currency={currency}
                      onInc={() => updateQty(item.productId, 1)}
                      onDec={() => updateQty(item.productId, -1)}
                      onRemove={() => removeFromCart(item.productId)} />
                  ))}
                </AnimatePresence>
              )}
            </div>

            {/* Totals + payment + checkout */}
            {cart.length > 0 && !showReceipt && (
              <>
                <div className="border-t-2 border-border px-5 pt-4 pb-3 space-y-3 overflow-y-auto shrink min-h-0">
                  {/* Multi-type discount panel — Supervisors+ only */}
                  {canDiscount && (
                    <DiscountPanel
                      subtotal={subtotal}
                      currency={currency}
                      customer={selectedCustomer}
                      applied={appliedDiscount}
                      onChange={setAppliedDiscount}
                    />
                  )}

                  <TotalsBlock
                    itemCount={totalItems}
                    subtotal={subtotal}
                    discountAmount={discountAmount}
                    discountLabel={appliedDiscount?.label}
                    taxAmount={taxAmount}
                    total={total}
                    currency={currency}
                  />

                  <PaymentMethodGrid
                    methods={paymentMethods}
                    value={paymentMethod}
                    onChange={id => { setPaymentMethod(id); setTenderedAmount(""); }}
                  />

                  {paymentMethod === "Cash" && (
                    <CashTender total={total} currency={currency} value={tenderedAmount} onChange={setTenderedAmount} />
                  )}
                </div>

                {/* Pay + Split */}
                <div className="px-5 pb-5 pt-1 flex gap-2 shrink-0">
                  <ChargeButton
                    className="flex-1"
                    total={total}
                    currency={currency}
                    pending={createSaleMutation.isPending}
                    disabled={!canCharge}
                    onClick={() => handleCheckout()}
                  />
                  <button
                    onClick={() => setShowSplit(true)}
                    disabled={createSaleMutation.isPending}
                    title="Split payment across methods"
                    className="h-16 w-20 shrink-0 rounded-2xl border-2 border-border bg-card flex flex-col items-center justify-center gap-0.5 text-sm font-extrabold hover:border-primary disabled:opacity-50">
                    <SplitSquareHorizontal className="h-6 w-6" strokeWidth={2.5} />
                    Split
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>
      )}

      {/* ── Receipt Modal ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showReceipt && (
          <PosReceipt
            cart={cart}
            subtotal={subtotal}
            discountAmount={discountAmount}
            discountLabel={appliedDiscount?.label}
            payments={completedPayments}
            taxAmount={taxAmount}
            total={total}
            paymentMethod={paymentMethod}
            tendered={parseFloat(tenderedAmount) || 0}
            txnNumber={completedTxnNumber}
            sessionId={sessionId ?? undefined}
            onClose={() => setShowReceipt(false)}
            onNewSale={handleNewSale}
          />
        )}
      </AnimatePresence>

      <AddPOSProductForm open={showAddForm} onClose={() => setShowAddForm(false)} />

      {/* ── Void / Refund Dialogs ─────────────────────────────────────────── */}
      <VoidConfirmDialog
        transaction={voidTarget}
        onClose={() => setVoidTarget(null)}
      />
      <RefundDialog
        transaction={refundTarget}
        sessionId={sessionId}
        onClose={() => setRefundTarget(null)}
      />

      {/* ── Split payment ─────────────────────────────────────────────────── */}
      <SplitPaymentDialog
        open={showSplit}
        total={total}
        currency={currency}
        paymentMethods={paymentMethods}
        pending={createSaleMutation.isPending}
        onComplete={(payments) => handleCheckout(payments)}
        onClose={() => setShowSplit(false)}
      />

      {/* ── Cash in / out ─────────────────────────────────────────────────── */}
      {sessionId && (
        <CashMovementDialog
          open={showCashMove}
          sessionId={sessionId}
          currency={currency}
          onClose={() => setCashMove(false)}
        />
      )}
    </div>
  );
}
