/**
 * CashierPOSView — full-screen, single-page POS terminal for cashier-level users.
 * Bold, high-contrast retail layout: products on the left, sale + payment on the right.
 * No tabs, no admin controls — pure sell-mode.
 *
 * Shortcuts: F2 search · F4 hold sale · F9 pay
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatCurrency, parseApiDate } from "@/lib/utils";
import { History, ArrowLeft, LogOut, Receipt, Loader2, ShoppingCart } from "lucide-react";
import { useBarcodeScanner }  from "@/hooks/use-barcode-scanner";
import { useHardware }        from "@/contexts/hardware-context";
import { HardwareStatusBar }  from "@/components/pos/hardware-status-bar";
import { buildEscPosReceipt } from "@/lib/pos/receipt-escpos";
import { usePaginatedPOSProducts } from "@/hooks/pos/use-products";
import { useInventoryCategories } from "@/hooks/inventory/use-inventory-categories";
import { useCreateSale, useTransactions } from "@/hooks/pos/use-transactions";
import { useShift } from "./shift-gate";
import { usePaymentMethods } from "@/hooks/pos/use-payment-methods";
import { useAuthStore } from "@/store/auth.store";
import { PosReceipt } from "./pos-receipt";
import { inventoryProductsApi } from "@/lib/inventory/products.api";
import type { ProductSummaryDto } from "@/lib/pos/types";
import {
  type PosProduct, mapToPosProduct, categoryEmoji, usePosShortcuts,
  ScanToast, PosSearch, CategoryPills, ProductTile, PRODUCT_GRID, ProductsLoading, ProductsEmpty,
  CART_PANEL, CartHeader, HeldList, CartLine, EmptyCart, TotalsBlock,
  PaymentMethodGrid, CashTender, ChargeButton,
  TOP_BAR, TopBarBrand, TopBarButton, ShiftPill, LiveClock,
} from "./pos-ui";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CartItem {
  productId: string;
  name: string;
  price: number;
  taxRate: number;
  quantity: number;
  total: number;
  category: string;
}

interface HeldItem {
  id: string;
  label: string;
  cart: CartItem[];
  total: number;
}

const STATUS_BADGE: Record<string, string> = {
  completed: "text-success bg-success/15",
  refunded:  "text-warning bg-warning/15",
  voided:    "text-destructive bg-destructive/15",
  pending:   "text-muted-foreground bg-muted",
};

// ─── Main View ────────────────────────────────────────────────────────────────

export function CashierPOSView() {
  const { user, tenant } = useAuthStore();
  const currency       = tenant?.currency || "AED";
  const companyName    = tenant?.branding?.companyName ?? "Vrodux POS";
  const paymentMethods = usePaymentMethods();
  const { sessionId, shiftDuration, openClosePanel } = useShift();
  const { openDrawer, printRaw, printerStatus } = useHardware();

  const searchRef = React.useRef<HTMLInputElement>(null);

  // ── State ─────────────────────────────────────────────────────────────────
  const [search, setSearch]           = React.useState("");
  const [categoryFilter, setCat]      = React.useState("all");
  const [cart, setCart]               = React.useState<CartItem[]>([]);
  const [paymentMethod, setPayment]   = React.useState("Card");
  React.useEffect(() => {
    if (paymentMethods.length > 0 && !paymentMethods.find(m => m.id === paymentMethod)) {
      setPayment(paymentMethods[0].id);
    }
  }, [paymentMethods, paymentMethod]);
  const [cashInput, setCashInput]     = React.useState("");
  const [showReceipt, setShowReceipt] = React.useState(false);
  const [completedTxn, setCompletedTxn] = React.useState("");

  // Hold
  const [held, setHeld]               = React.useState<HeldItem[]>([]);
  const [showHeld, setShowHeld]       = React.useState(false);

  // Scan feedback
  const [scanFeedback, setScanFeedback] = React.useState<"found" | "not_found" | null>(null);
  const [scanItem, setScanItem]         = React.useState("");

  // History panel
  const [showHistory, setShowHistory]   = React.useState(false);

  // ── API hooks ────────────────────────────────────────────────────────────
  const createSaleMutation = useCreateSale();

  // Category map for filter pills (id → name)
  const { data: categoriesData } = useInventoryCategories({ isActive: true });
  const categoryList = React.useMemo(
    () => (categoriesData ?? []).map(c => ({ id: c.id, name: c.name })),
    [categoriesData]
  );
  const categoryNames = React.useMemo(() => categoryList.map(c => c.name), [categoryList]);

  // Resolve selected category name → id for the API query
  const selectedCategoryId = React.useMemo(() =>
    categoryFilter === "all" ? undefined : categoryList.find(c => c.name === categoryFilter)?.id,
    [categoryFilter, categoryList]
  );

  // Debounce search so we don't re-query on every keystroke
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const {
    data: productsPages,
    isLoading: productsLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    refetch: refetchProducts,
  } = usePaginatedPOSProducts({
    search:     debouncedSearch || undefined,
    categoryId: selectedCategoryId,
  });

  // Flatten all fetched pages into one list
  const allProducts = React.useMemo(
    () => (productsPages?.pages ?? []).flatMap(p => p.items).map(mapToPosProduct),
    [productsPages]
  );

  // Sentinel ref for IntersectionObserver infinite scroll
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage(); },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Transaction history for current session
  const { data: txnData, isLoading: txnLoading } = useTransactions({
    sessionId: sessionId ?? undefined,
    pageSize: 50,
  });
  const txns = txnData?.items ?? [];

  // ── Session sales stats ───────────────────────────────────────────────────
  const sessionStats = React.useMemo(() => ({
    totalSales: txns.filter(t => t.status === "Completed").reduce((s, t) => s + t.totalAmount, 0),
    count:      txns.filter(t => t.type === "Sale").length,
  }), [txns]);

  // ── Cart ──────────────────────────────────────────────────────────────────
  const addToCart = React.useCallback((p: PosProduct) => {
    setCart(prev => {
      const ex = prev.find(i => i.productId === p.id);
      if (ex) return prev.map(i => i.productId === p.id
        ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.price } : i);
      return [...prev, { productId: p.id, name: p.name, price: p.price, taxRate: p.taxRate, quantity: 1, total: p.price, category: p.category }];
    });
  }, []);

  const updateQty = (id: string, delta: number) =>
    setCart(prev => prev.map(i => i.productId === id
      ? { ...i, quantity: i.quantity + delta, total: (i.quantity + delta) * i.price }
      : i
    ).filter(i => i.quantity > 0));

  const removeItem = (id: string) => setCart(prev => prev.filter(i => i.productId !== id));

  // ── Barcode scanner ───────────────────────────────────────────────────────
  useBarcodeScanner({
    enabled: !showReceipt && !showHistory,
    onScan: async ({ barcode }) => {
      const local = allProducts.find(p => p.barcode === barcode || p.sku === barcode);
      if (local && local.stock > 0) {
        addToCart(local); setScanItem(local.name); setScanFeedback("found");
      } else if (!local) {
        try {
          const p = await inventoryProductsApi.getByBarcode(barcode);
          if (p.isActive && p.stockQuantity > 0) {
            const m = mapToPosProduct({ ...p, categoryName: p.categoryName } as ProductSummaryDto);
            addToCart(m); setScanItem(m.name); setScanFeedback("found");
          } else { setScanItem(barcode); setScanFeedback("not_found"); }
        } catch { setScanItem(barcode); setScanFeedback("not_found"); }
      } else { setScanItem(barcode); setScanFeedback("not_found"); }
      setTimeout(() => setScanFeedback(null), 2000);
    },
  });

  // ── Totals ────────────────────────────────────────────────────────────────
  const subtotal  = cart.reduce((s, i) => s + i.total, 0);
  const taxAmount = cart.reduce((s, i) => s + i.total * (i.taxRate / 100), 0);
  const total     = subtotal + taxAmount;
  const tendered  = parseFloat(cashInput) || 0;

  // ── Checkout ──────────────────────────────────────────────────────────────
  const handleCheckout = async () => {
    if (!cart.length) return;
    try {
      const txn = await createSaleMutation.mutateAsync({
        sessionId,
        lineItems: cart.map(i => ({ productId: i.productId, quantity: i.quantity, discountPercent: 0, discountAmount: 0 })),
        payments:  [{ method: paymentMethod, amount: total, reference: null }],
      });
      setCompletedTxn(txn.transactionNumber);
      setShowReceipt(true);
      refetchProducts();

      // Open cash drawer on cash payments
      if (paymentMethod.toLowerCase() === "cash") {
        await openDrawer();
      }

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
          discountAmount: 0,
          taxAmount,
          total,
          paymentMethod,
          tendered:       parseFloat(cashInput) || 0,
          openDrawer:     paymentMethod.toLowerCase() === "cash",
        });
        printRaw(escData).catch(() => {});
      }
    } catch { /* toast in hook */ }
  };

  const handleNewSale = () => {
    setCart([]); setCashInput(""); setShowReceipt(false); setCompletedTxn("");
  };

  // ── Hold ──────────────────────────────────────────────────────────────────
  const holdCart = () => {
    if (!cart.length) return;
    const h: HeldItem = { id: `h-${Date.now()}`, label: `Hold ${held.length + 1}`, cart: [...cart], total };
    setHeld(p => [...p, h]); setCart([]); setCashInput("");
  };

  const recallHeld = (id: string) => {
    const h = held.find(x => x.id === id);
    if (!h) return;
    setCart(h.cart); setHeld(p => p.filter(x => x.id !== id)); setShowHeld(false);
  };

  // ── Cart item count in products ──────────────────────────────────────────
  const cartQty = React.useMemo(() => {
    const m: Record<string, number> = {};
    cart.forEach(i => { m[i.productId] = i.quantity; });
    return m;
  }, [cart]);

  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);
  const canCharge  = cart.length > 0 && !createSaleMutation.isPending
    && (paymentMethod !== "Cash" || !cashInput || tendered >= total);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  usePosShortcuts({
    F2: () => searchRef.current?.focus(),
    F4: cart.length ? holdCart : undefined,
    F9: canCharge ? handleCheckout : undefined,
  }, !showReceipt && !showHistory);

  return (
    <div className="flex flex-col h-full bg-muted/40 overflow-hidden">

      <ScanToast feedback={scanFeedback} itemName={scanItem} />

      {/* ── Top bar ── */}
      <header className={TOP_BAR}>
        <TopBarBrand title={companyName} subtitle={`Retail Terminal · ${user?.name ?? "Cashier"}`} />

        <div className="flex items-center gap-2">
          <ShiftPill duration={shiftDuration} />
          <HardwareStatusBar />
          <TopBarButton icon={History} label="History" badge={sessionStats.count} onClick={() => setShowHistory(true)} />
          <TopBarButton icon={LogOut} label="Close Shift" tone="danger" onClick={openClosePanel} />
          <LiveClock />
        </div>
      </header>

      {/* ── Main content ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ═══ LEFT — Products ═══ */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="px-5 pt-4 pb-3 space-y-3 shrink-0">
            <PosSearch ref={searchRef} value={search} onChange={setSearch} />
            <CategoryPills categories={categoryNames} active={categoryFilter} onSelect={setCat} />
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-5 pt-2">
            {productsLoading ? (
              <ProductsLoading />
            ) : allProducts.length > 0 ? (
              <>
                <div className={PRODUCT_GRID}>
                  {allProducts.map(p => (
                    <ProductTile
                      key={p.id}
                      product={p}
                      currency={currency}
                      inCart={cartQty[p.id] ?? 0}
                      onAdd={() => addToCart(p)}
                    />
                  ))}
                </div>

                {/* Infinite scroll sentinel */}
                <div ref={sentinelRef} className="py-6 flex items-center justify-center">
                  {isFetchingNextPage && (
                    <div className="flex items-center gap-2 text-muted-foreground text-base font-semibold">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Loading more…
                    </div>
                  )}
                  {!hasNextPage && (
                    <p className="text-sm font-semibold text-muted-foreground">
                      All {allProducts.length} products loaded
                    </p>
                  )}
                </div>
              </>
            ) : (
              <ProductsEmpty />
            )}
          </div>
        </div>

        {/* ═══ RIGHT — Sale + Checkout ═══ */}
        <aside className={CART_PANEL}>
          <CartHeader
            itemCount={totalItems}
            heldCount={held.length}
            onHold={holdCart}
            onClear={() => { setCart([]); setCashInput(""); }}
            onToggleHeld={() => setShowHeld(p => !p)}
          />

          <AnimatePresence>
            {showHeld && held.length > 0 && (
              <HeldList
                items={held.map(h => ({
                  id: h.id,
                  title: `${h.label} · ${h.cart.length} item${h.cart.length !== 1 ? "s" : ""}`,
                  subtitle: formatCurrency(h.total, currency),
                }))}
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
                    emoji={categoryEmoji(item.category)}
                    currency={currency}
                    onInc={() => updateQty(item.productId, 1)}
                    onDec={() => updateQty(item.productId, -1)}
                    onRemove={() => removeItem(item.productId)}
                  />
                ))}
              </AnimatePresence>
            )}
          </div>

          {/* ── Totals + Payment + Pay ── */}
          {cart.length > 0 && (
            <>
              <div className="border-t-2 border-border px-5 pt-4 pb-3 space-y-3 overflow-y-auto shrink min-h-0">
                <TotalsBlock itemCount={totalItems} subtotal={subtotal} taxAmount={taxAmount} total={total} currency={currency} />
                <PaymentMethodGrid
                  methods={paymentMethods}
                  value={paymentMethod}
                  onChange={id => { setPayment(id); setCashInput(""); }}
                />
                {paymentMethod === "Cash" && (
                  <CashTender total={total} currency={currency} value={cashInput} onChange={setCashInput} />
                )}
              </div>
              <div className="px-5 pb-5 pt-1 shrink-0">
                <ChargeButton
                  total={total}
                  currency={currency}
                  pending={createSaleMutation.isPending}
                  disabled={!canCharge}
                  onClick={handleCheckout}
                />
              </div>
            </>
          )}
        </aside>
      </div>

      {/* ══ Order History Slide-over ══ */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
            />
            <motion.div
              className="fixed right-0 top-0 h-full w-full max-w-lg bg-card border-l-2 border-border z-50 flex flex-col shadow-2xl"
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
            >
              {/* Header */}
              <div className="px-5 py-4 border-b-2 border-border shrink-0 space-y-4">
                <div className="flex items-center gap-3">
                  <button onClick={() => setShowHistory(false)} aria-label="Back"
                    className="h-11 w-11 rounded-xl border-2 border-border hover:border-primary flex items-center justify-center">
                    <ArrowLeft className="h-5 w-5" strokeWidth={2.5} />
                  </button>
                  <div>
                    <h2 className="text-2xl font-black">Order History</h2>
                    <p className="text-base font-semibold text-muted-foreground">
                      {sessionId ? "This shift's sales" : "No active shift"}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-success/10 border-2 border-success/30 px-4 py-3">
                    <p className="text-sm font-extrabold uppercase tracking-wide text-success">Sales</p>
                    <p className="text-2xl font-black text-success tabular-nums truncate">{formatCurrency(sessionStats.totalSales, currency)}</p>
                  </div>
                  <div className="rounded-xl bg-primary/10 border-2 border-primary/30 px-4 py-3">
                    <p className="text-sm font-extrabold uppercase tracking-wide text-primary">Orders</p>
                    <p className="text-2xl font-black text-primary tabular-nums">{sessionStats.count}</p>
                  </div>
                </div>
              </div>

              {/* Transaction list */}
              <div className="flex-1 overflow-y-auto">
                {txnLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  </div>
                ) : txns.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-16 text-center px-6">
                    <div className="w-20 h-20 rounded-3xl bg-muted flex items-center justify-center mb-4">
                      <Receipt className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <p className="text-xl font-extrabold">No orders yet</p>
                    <p className="text-base font-medium text-muted-foreground mt-1">
                      {sessionId ? "Sales will appear here as you process them" : "Open a shift to start selling"}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y-2 divide-border">
                    {txns.map((tx, i) => {
                      const badge = STATUS_BADGE[(tx.status ?? "").toLowerCase()] ?? STATUS_BADGE.pending;
                      const PayIcon = paymentMethods.find(
                        p => p.id.toLowerCase() === (tx.primaryPaymentMethod ?? "").toLowerCase()
                      )?.icon ?? Receipt;

                      return (
                        <div key={tx.id} className="px-5 py-4 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                              <span className="text-base font-black text-primary">#{txns.length - i}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-base font-bold font-mono truncate">{tx.transactionNumber}</p>
                              <div className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                                <PayIcon className="h-4 w-4 shrink-0" />
                                <span>{tx.primaryPaymentMethod}</span>
                                <span>·</span>
                                <span>
                                  {tx.completedAt
                                    ? parseApiDate(tx.completedAt).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })
                                    : "—"}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <p className="text-lg font-black tabular-nums">{formatCurrency(tx.totalAmount, currency)}</p>
                            <span className={cn("text-xs font-extrabold uppercase px-2 py-1 rounded-lg", badge)}>{tx.status}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="px-5 py-4 border-t-2 border-border shrink-0">
                <button onClick={() => setShowHistory(false)}
                  className="w-full h-14 rounded-2xl bg-primary text-primary-foreground text-lg font-extrabold flex items-center justify-center gap-2 hover:brightness-110">
                  <ShoppingCart className="h-5 w-5" strokeWidth={2.5} /> Back to Selling
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ══ Receipt Modal ══ */}
      <AnimatePresence>
        {showReceipt && (
          <PosReceipt
            cart={cart}
            subtotal={subtotal}
            discountAmount={0}
            taxAmount={taxAmount}
            total={total}
            paymentMethod={paymentMethod}
            tendered={tendered}
            txnNumber={completedTxn}
            sessionId={sessionId ?? undefined}
            onClose={handleNewSale}
            onNewSale={handleNewSale}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
