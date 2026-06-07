/**
 * CashierPOSView — full-screen, single-page POS terminal for cashier-level users.
 * Looks and feels like a real retail POS (Square / Shopify POS style).
 * No tabs, no admin controls — pure sell-mode.
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency } from "@/lib/utils";
import {
  Search, X, ShoppingCart, Trash2, Plus, Minus,
  Receipt,
  Package, Scan, CheckCircle2, AlertCircle,
  Pause, PlayCircle, Clock, Loader2, User2, ChevronRight,
  Delete, History, ArrowLeft, LogOut, ChevronLeft,
} from "lucide-react";
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<string, string> = {
  beverages: "🥤", snacks: "🍫", electronics: "🔌", accessories: "🕶️",
  stationery: "📝", personal_care: "🧴", gifts: "🎁", tobacco: "🚬",
  food: "🍔", clothing: "👕", shoes: "👟", sports: "⚽", toys: "🧸",
  books: "📚", pharmacy: "💊", household: "🏠", cosmetics: "💄",
  "food & beverages": "🥤", "food and beverages": "🥤",
};

function categoryEmoji(name: string): string {
  if (!name) return "📦";
  const key = name.toLowerCase().replace(/[\s-]+/g, "_");
  const keyAlt = name.toLowerCase();
  return CATEGORY_EMOJI[key] ?? CATEGORY_EMOJI[keyAlt] ?? "📦";
}

function mapToCartProduct(dto: ProductSummaryDto) {
  return {
    id: dto.id, sku: dto.sku ?? "", name: dto.name,
    category: dto.categoryName, price: dto.salePrice,
    taxRate: dto.taxRate, stock: dto.stockQuantity, barcode: dto.barcode ?? "",
    emoji: categoryEmoji(dto.categoryName),
  };
}

// Payment methods are now dynamic — see usePaymentMethods() inside CashierPOSView

// ─── Product Tile ─────────────────────────────────────────────────────────────

function ProductTile({
  product,
  inCart,
  onAdd,
}: {
  product: ReturnType<typeof mapToCartProduct>;
  inCart: number;
  onAdd: () => void;
}) {
  const { tenant } = useAuthStore();
  const currency = tenant?.currency || "PKR";
  const oos = product.stock <= 0;
  return (
    <motion.button
      whileTap={oos ? undefined : { scale: 0.94 }}
      onClick={() => !oos && onAdd()}
      disabled={oos}
      className={cn(
        "relative flex flex-col items-start p-3 rounded-2xl border-2 text-left transition-all select-none",
        oos
          ? "border-border/40 bg-muted/20 opacity-40 cursor-not-allowed"
          : "border-border bg-card hover:border-primary/50 hover:shadow-lg active:bg-primary/5 cursor-pointer"
      )}
    >
      {/* Badge */}
      {inCart > 0 && (
        <span className="absolute -top-2 -right-2 z-10 h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shadow">
          {inCart}
        </span>
      )}

      <span className="text-3xl mb-2 leading-none">{product.emoji}</span>
      <p className="text-xs font-bold text-foreground leading-tight line-clamp-2 flex-1">{product.name}</p>
      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{product.sku}</p>

      <div className="flex items-center justify-between w-full mt-2">
        <span className="text-sm font-extrabold text-foreground">
          {formatCurrency(product.price, currency)}
        </span>
        <span className={cn(
          "text-[9px] font-bold px-1.5 py-0.5 rounded-full",
          product.stock <= 5
            ? "bg-warning/15 text-warning"
            : "bg-muted/50 text-muted-foreground"
        )}>
          {oos ? "OUT" : `${product.stock}`}
        </span>
      </div>
    </motion.button>
  );
}

// ─── Category Scroller ───────────────────────────────────────────────────────

interface CategoryScrollerProps {
  categories:     { id: string; name: string }[];
  active:         string;
  onSelect:       (name: string) => void;
}

function CategoryScroller({ categories, active, onSelect }: CategoryScrollerProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [canLeft,  setCanLeft]  = React.useState(false);
  const [canRight, setCanRight] = React.useState(false);

  const checkScroll = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  React.useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", checkScroll); ro.disconnect(); };
  }, [checkScroll, categories]);

  const scrollBy = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -160 : 160, behavior: "smooth" });
  };

  return (
    <div className="relative flex items-center">
      {/* Left arrow */}
      {canLeft && (
        <button
          onClick={() => scrollBy("left")}
          className="absolute left-0 z-10 h-full px-1 flex items-center bg-gradient-to-r from-muted/90 to-transparent rounded-l-xl"
          aria-label="Scroll categories left"
        >
          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
        </button>
      )}

      {/* Scrollable strip */}
      <div
        ref={scrollRef}
        className="flex gap-1.5 overflow-x-auto scrollbar-none py-0.5 px-0.5"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {[{ id: "all", name: "all" }, ...categories].map(cat => (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.name)}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0",
              active === cat.name
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-card border border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
            )}
          >
            {cat.name === "all" ? "All Items" : `${categoryEmoji(cat.name)} ${cat.name}`}
          </button>
        ))}
      </div>

      {/* Right arrow */}
      {canRight && (
        <button
          onClick={() => scrollBy("right")}
          className="absolute right-0 z-10 h-full px-1 flex items-center bg-gradient-to-l from-muted/90 to-transparent rounded-r-xl"
          aria-label="Scroll categories right"
        >
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

// ─── Numpad ───────────────────────────────────────────────────────────────────

function CashNumpad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const keys = ["1","2","3","4","5","6","7","8","9","00","0","⌫"];
  const handleKey = (k: string) => {
    if (k === "⌫") { onChange(value.slice(0, -1) || ""); return; }
    if (value.length >= 9) return;
    onChange(value + k);
  };
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {keys.map(k => (
        <button key={k} onClick={() => handleKey(k)}
          className={cn(
            "h-10 rounded-xl text-sm font-bold transition-all active:scale-95",
            k === "⌫"
              ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
              : "bg-muted/50 hover:bg-muted text-foreground"
          )}>
          {k === "⌫" ? <Delete className="w-4 h-4 mx-auto" /> : k}
        </button>
      ))}
    </div>
  );
}


// ─── Main View ────────────────────────────────────────────────────────────────

export function CashierPOSView() {
  const { user, tenant } = useAuthStore();
  const currency       = tenant?.currency || "PKR";
  const paymentMethods = usePaymentMethods();
  const { sessionId, shiftDuration, openClosePanel } = useShift();
  const { openDrawer, printRaw, printerStatus } = useHardware();

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
    () => (productsPages?.pages ?? []).flatMap(p => p.items).map(mapToCartProduct),
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
            const m = mapToCartProduct({ ...p, categoryName: p.categoryName } as ProductSummaryDto);
            addToCart(m); setScanItem(m.name); setScanFeedback("found");
          } else { setScanItem(barcode); setScanFeedback("not_found"); }
        } catch { setScanItem(barcode); setScanFeedback("not_found"); }
      } else { setScanItem(barcode); setScanFeedback("not_found"); }
      setTimeout(() => setScanFeedback(null), 2000);
    },
  });

  // ── Cart ──────────────────────────────────────────────────────────────────
  const addToCart = React.useCallback((p: ReturnType<typeof mapToCartProduct>) => {
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

  // ── Totals ────────────────────────────────────────────────────────────────
  const subtotal  = cart.reduce((s, i) => s + i.total, 0);
  const taxAmount = cart.reduce((s, i) => s + i.total * (i.taxRate / 100), 0);
  const total     = subtotal + taxAmount;
  const tendered  = parseFloat(cashInput) || 0;
  const change    = Math.max(0, tendered - total);

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
    setHeld(p => [...p, h]); setCart([]);
  };

  const recallHeld = (h: HeldItem) => {
    setCart(h.cart); setHeld(p => p.filter(x => x.id !== h.id)); setShowHeld(false);
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

  return (
    <div className="flex flex-col h-full bg-muted/20 overflow-hidden">

      {/* ── Scan feedback ── */}
      <AnimatePresence>
        {scanFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -24, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12 }}
            className={cn(
              "fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-5 py-2.5 rounded-2xl shadow-2xl text-sm font-bold border",
              scanFeedback === "found"
                ? "bg-success text-white border-success/40 shadow-success/20"
                : "bg-destructive text-white border-destructive/40 shadow-destructive/20"
            )}>
            {scanFeedback === "found"
              ? <><CheckCircle2 className="h-4 w-4 shrink-0" /> Added: {scanItem}</>
              : <><AlertCircle className="h-4 w-4 shrink-0" /> Not found: {scanItem}</>
            }
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-card border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShoppingCart className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold leading-none">Vrodux POS</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Retail Terminal</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Session status */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-success/10 border border-success/20">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            <Clock className="h-3 w-3 text-success" />
            <span className="text-[10px] font-bold text-success">Open · {shiftDuration}</span>
          </div>

          {/* History button */}
          <button
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors"
          >
            <History className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground hidden sm:inline">History</span>
            {sessionStats.count > 0 && (
              <span className="text-[9px] font-bold bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">
                {sessionStats.count}
              </span>
            )}
          </button>

          {/* Close Shift */}
          <button
            onClick={openClosePanel}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-destructive/10 hover:bg-destructive/20 border border-destructive/20 transition-colors"
            title="Close shift"
          >
            <LogOut className="h-3.5 w-3.5 text-destructive" />
            <span className="text-xs font-semibold text-destructive hidden sm:inline">Close Shift</span>
          </button>

          <HardwareStatusBar />

          {/* Cashier name */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/50">
            <User2 className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">{user?.name ?? "Cashier"}</span>
          </div>

          {/* Live clock */}
          <LiveClock />
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ═══ LEFT — Products ═══ */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Search + category strip */}
          <div className="px-4 pt-3 pb-2 space-y-2 shrink-0">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, SKU, or barcode…"
                className="pl-9 h-9 text-sm bg-card"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Category horizontal scroller */}
            <CategoryScroller
              categories={categoryList}
              active={categoryFilter}
              onSelect={setCat}
            />
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {productsLoading ? (
              <div className="flex flex-col items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Loading products…</p>
              </div>
            ) : allProducts.length > 0 ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
                  {allProducts.map(p => (
                    <ProductTile
                      key={p.id}
                      product={p}
                      inCart={cartQty[p.id] ?? 0}
                      onAdd={() => addToCart(p)}
                    />
                  ))}
                </div>

                {/* Infinite scroll sentinel */}
                <div ref={sentinelRef} className="py-4 flex items-center justify-center">
                  {isFetchingNextPage && (
                    <div className="flex items-center gap-2 text-muted-foreground text-xs">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading more…
                    </div>
                  )}
                  {!hasNextPage && allProducts.length > 0 && (
                    <p className="text-[10px] text-muted-foreground/50">
                      All {allProducts.length} products loaded
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Package className="h-10 w-10 text-muted-foreground/25 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No products found</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Try a different search or scan a barcode</p>
              </div>
            )}
          </div>
        </div>

        {/* ═══ RIGHT — Cart + Checkout ═══ */}
        <div className="w-[340px] shrink-0 flex flex-col bg-card border-l border-border">

          {/* Cart header */}
          <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className={cn(
                "relative h-8 w-8 rounded-xl flex items-center justify-center transition-colors",
                totalItems > 0 ? "bg-primary/10" : "bg-muted/40"
              )}>
                <ShoppingCart className={cn("h-4 w-4", totalItems > 0 ? "text-primary" : "text-muted-foreground")} />
                {totalItems > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary text-white text-[9px] font-extrabold flex items-center justify-center">
                    {totalItems > 9 ? "9+" : totalItems}
                  </span>
                )}
              </div>
              <span className="text-sm font-bold">
                {totalItems > 0 ? `${totalItems} item${totalItems !== 1 ? "s" : ""}` : "Cart"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {cart.length > 0 && (
                <>
                  <button onClick={holdCart} title="Hold transaction"
                    className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
                    <Pause className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setCart([])} title="Clear cart"
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
              {held.length > 0 && (
                <button onClick={() => setShowHeld(p => !p)} title="Recall"
                  className="relative p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
                  <PlayCircle className="h-3.5 w-3.5" />
                  <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-warning text-white text-[8px] font-bold flex items-center justify-center">
                    {held.length}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Held recall panel */}
          <AnimatePresence>
            {showHeld && held.length > 0 && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="border-b border-border overflow-hidden shrink-0">
                <div className="p-3 bg-warning/5 space-y-1.5">
                  <p className="text-[10px] font-bold text-warning uppercase tracking-wide">Held Transactions</p>
                  {held.map(h => (
                    <button key={h.id} onClick={() => recallHeld(h)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-card border border-border hover:border-primary/40 text-xs transition-colors">
                      <span className="font-semibold">{h.label} · {h.cart.length} items</span>
                      <div className="flex items-center gap-1.5 text-primary">
                        <span className="font-bold">{formatCurrency(h.total, currency)}</span>
                        <ChevronRight className="h-3 w-3" />
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-3">
                  <ShoppingCart className="h-7 w-7 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-semibold text-muted-foreground">Cart is empty</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Tap a product or scan a barcode</p>
              </div>
            ) : (
              <div className="px-3 py-2 space-y-0.5">
                <AnimatePresence mode="popLayout">
                  {cart.map(item => (
                    <motion.div key={item.productId} layout
                      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                      className="flex items-center gap-2 py-2 border-b border-border/40 last:border-0">
                      <div className="w-6 h-6 rounded-lg bg-muted/50 flex items-center justify-center text-xs shrink-0">
                        {categoryEmoji(item.category)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate leading-tight">{item.name}</p>
                        <p className="text-[10px] text-muted-foreground">{formatCurrency(item.price, currency)}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => updateQty(item.productId, -1)}
                          className="w-6 h-6 rounded-lg bg-muted/60 flex items-center justify-center hover:bg-muted transition-colors">
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <span className="text-xs font-bold w-5 text-center tabular-nums">{item.quantity}</span>
                        <button onClick={() => updateQty(item.productId, 1)}
                          className="w-6 h-6 rounded-lg bg-muted/60 flex items-center justify-center hover:bg-muted transition-colors">
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      </div>
                      <p className="text-xs font-bold w-14 text-right tabular-nums shrink-0">
                        {formatCurrency(item.total, currency)}
                      </p>
                      <button onClick={() => removeItem(item.productId)}
                        className="text-muted-foreground hover:text-destructive transition-colors ml-0.5 shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* ── Totals + Payment + Charge ── */}
          {cart.length > 0 && (
            <div className="border-t border-border shrink-0">
              {/* Totals */}
              <div className="px-4 py-3 space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Subtotal ({totalItems} items)</span>
                  <span>{formatCurrency(subtotal, currency)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Tax</span>
                  <span>{formatCurrency(taxAmount, currency)}</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold text-foreground pt-1.5 border-t border-border">
                  <span>TOTAL</span>
                  <span className="text-base">{formatCurrency(total, currency)}</span>
                </div>
              </div>

              {/* Payment methods */}
              <div className="px-4 pb-3 grid grid-cols-2 gap-1.5">
                {paymentMethods.map(pm => {
                  const Icon   = pm.icon;
                  const active = paymentMethod === pm.id;
                  return (
                    <button key={pm.id} onClick={() => { setPayment(pm.id); setCashInput(""); }}
                      className={cn(
                        "flex items-center gap-1.5 py-2 px-2.5 rounded-xl border-2 text-xs font-bold transition-all",
                        active ? `${pm.bg} ${pm.color} shadow-sm` : "border-border bg-muted/20 text-muted-foreground hover:border-primary/40"
                      )}>
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {pm.label}
                    </button>
                  );
                })}
              </div>

              {/* Cash input + numpad */}
              <AnimatePresence>
                {paymentMethod === "Cash" && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-border">
                    <div className="px-4 py-3 space-y-3">
                      {/* Tendered display */}
                      <div className="flex items-center justify-between rounded-xl bg-muted/30 border border-border px-3 py-2">
                        <span className="text-xs text-muted-foreground font-medium">Tendered</span>
                        <span className={cn(
                          "text-base font-extrabold tabular-nums",
                          cashInput ? (tendered >= total ? "text-success" : "text-destructive") : "text-muted-foreground"
                        )}>
                          {cashInput ? formatCurrency(tendered, currency) : "—"}
                        </span>
                      </div>

                      {tendered >= total && cashInput && (
                        <div className="flex items-center justify-between rounded-xl bg-success/10 border border-success/20 px-3 py-2">
                          <span className="text-xs font-bold text-success">Change Due</span>
                          <span className="text-base font-extrabold text-success tabular-nums">{formatCurrency(change, currency)}</span>
                        </div>
                      )}

                      {/* Quick amounts */}
                      <div className="grid grid-cols-4 gap-1">
                        {[Math.ceil(total / 100) * 100, Math.ceil(total / 500) * 500, Math.ceil(total / 1000) * 1000, Math.ceil(total / 5000) * 5000]
                          .filter((v, i, a) => a.indexOf(v) === i && v >= total)
                          .slice(0, 4)
                          .map(v => (
                            <button key={v} onClick={() => setCashInput(String(v))}
                              className={cn(
                                "py-1.5 rounded-lg border text-[10px] font-bold transition-all",
                                String(v) === cashInput
                                  ? "bg-success/15 border-success/40 text-success"
                                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
                              )}>
                              {v >= 1000 ? `${v / 1000}k` : v}
                            </button>
                          ))
                        }
                      </div>

                      {/* Numpad */}
                      <CashNumpad value={cashInput} onChange={setCashInput} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Charge button */}
              <div className="px-4 pb-4 pt-1">
                <Button
                  className={cn(
                    "w-full h-14 text-base font-extrabold gap-2 transition-all",
                    canCharge
                      ? "bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                      : "bg-muted cursor-not-allowed"
                  )}
                  disabled={!canCharge}
                  onClick={handleCheckout}
                >
                  {createSaleMutation.isPending
                    ? <><Loader2 className="h-5 w-5 animate-spin" /> Processing…</>
                    : <><Receipt className="h-4 w-4" /> Charge {formatCurrency(total, currency)}</>
                  }
                </Button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ══ Order History Slide-over ══ */}
      <AnimatePresence>
        {showHistory && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
            />
            {/* Panel */}
            <motion.div
              className="fixed right-0 top-0 h-full w-full max-w-md bg-card border-l border-border z-50 flex flex-col shadow-2xl"
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
                <div className="flex items-center gap-2.5">
                  <button onClick={() => setShowHistory(false)}
                    className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div>
                    <h2 className="text-sm font-bold">Order History</h2>
                    <p className="text-[10px] text-muted-foreground">
                      {sessionId ? "Current shift transactions" : "No active shift"}
                    </p>
                  </div>
                </div>
                {/* Session summary chips */}
                {sessionStats.count > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="px-2.5 py-1 rounded-lg bg-success/10 border border-success/20 text-center">
                      <p className="text-[9px] text-success font-bold uppercase tracking-wide">Sales</p>
                      <p className="text-sm font-extrabold text-success">{formatCurrency(sessionStats.totalSales, currency)}</p>
                    </div>
                    <div className="px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-center">
                      <p className="text-[9px] text-primary font-bold uppercase tracking-wide">Orders</p>
                      <p className="text-sm font-extrabold text-primary">{sessionStats.count}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Transaction list */}
              <div className="flex-1 overflow-y-auto">
                {txnLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
                  </div>
                ) : txns.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-3">
                      <Receipt className="h-7 w-7 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm font-semibold text-muted-foreground">No orders yet</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      {sessionId ? "Sales will appear here as you process them" : "Open a shift to start selling"}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {txns.map((tx, i) => {
                      const statusColors: Record<string, string> = {
                        completed: "text-success bg-success/10",
                        refunded:  "text-warning bg-warning/10",
                        voided:    "text-destructive bg-destructive/10",
                        pending:   "text-muted-foreground bg-muted/30",
                      };
                      const statusKey = (tx.status ?? "").toLowerCase();
                      const badge = statusColors[statusKey] ?? "text-muted-foreground bg-muted/30";
                      const PayIcon = paymentMethods.find(
                        p => p.id.toLowerCase() === (tx.primaryPaymentMethod ?? "").toLowerCase()
                      )?.icon ?? Receipt;

                      return (
                        <div key={tx.id} className="px-5 py-3.5 hover:bg-muted/20 transition-colors">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              {/* Order number circle */}
                              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                <span className="text-[10px] font-extrabold text-primary">
                                  #{txns.length - i}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-mono font-bold text-foreground truncate">
                                  {tx.transactionNumber}
                                </p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <PayIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span className="text-[10px] text-muted-foreground">
                                    {tx.primaryPaymentMethod}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground/50">·</span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {tx.completedAt
                                      ? new Date(tx.completedAt).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })
                                      : "—"
                                    }
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <p className="text-sm font-extrabold text-foreground tabular-nums">
                                {formatCurrency(tx.totalAmount, currency)}
                              </p>
                              <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full capitalize", badge)}>
                                {tx.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-border shrink-0">
                <Button className="w-full h-10 gap-2" onClick={() => setShowHistory(false)}>
                  <ShoppingCart className="h-4 w-4" /> Back to POS
                </Button>
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

// ─── Live Clock ───────────────────────────────────────────────────────────────

function LiveClock() {
  const [time, setTime] = React.useState(
    new Date().toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", hour12: true })
  );
  React.useEffect(() => {
    const t = setInterval(() => {
      setTime(new Date().toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", hour12: true }));
    }, 10_000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/50">
      <Clock className="h-3 w-3 text-muted-foreground" />
      <span className="text-xs font-bold tabular-nums text-foreground">{time}</span>
    </div>
  );
}
