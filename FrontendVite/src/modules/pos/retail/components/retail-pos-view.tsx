import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency } from "@/lib/utils";
import {
  Search, X, ShoppingCart, Trash2, Plus, Minus,
  Receipt, RotateCcw, Package, Scan,
  CheckCircle2, AlertCircle, Pause, PlayCircle,
  Clock, TrendingUp, LogOut, ChevronLeft, ChevronRight, Loader2, RefreshCw,
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
import type { ProductSummaryDto, POSTransactionSummaryDto } from "@/lib/pos/types";
import type { PagedResult } from "@/lib/api-client";
import { toast } from "sonner";

// ─── Internal types ───────────────────────────────────────────────────────────

interface CartItem {
  productId: string;
  name: string;
  price: number;
  taxRate: number;
  quantity: number;
  total: number;
}

interface HeldItem { id: string; label: string; cart: CartItem[]; timestamp: string }

// ─── Config ───────────────────────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<string, string> = {
  beverages: "🥤", snacks: "🍫", electronics: "🔌", accessories: "🕶️",
  stationery: "📝", personal_care: "🧴", gifts: "🎁", tobacco: "🚬",
  food: "🍔", clothing: "👕", shoes: "👟", sports: "⚽", toys: "🧸",
  books: "📚", pharmacy: "💊", household: "🏠", cosmetics: "💄",
};

function categoryEmoji(name: string) {
  if (!name) return "📦";
  const key = name.toLowerCase().replace(/[\s-]+/g, "_");
  return CATEGORY_EMOJI[key] ?? "📦";
}

// Payment methods are now dynamic — see usePaymentMethods() inside RetailPOSView

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  completed: { label: "Completed", color: "text-success",          bg: "bg-success/10" },
  refunded:  { label: "Refunded",  color: "text-warning",          bg: "bg-warning/10" },
  voided:    { label: "Voided",    color: "text-destructive",       bg: "bg-destructive/10" },
  pending:   { label: "Pending",   color: "text-muted-foreground", bg: "bg-muted/30" },
};

// ─── Adapter ──────────────────────────────────────────────────────────────────

function mapToCartProduct(dto: ProductSummaryDto) {
  return {
    id:       dto.id,
    sku:      dto.sku ?? "",
    name:     dto.name,
    category: dto.categoryName,
    price:    dto.salePrice,
    taxRate:  dto.taxRate,
    stock:    dto.stockQuantity,
    barcode:  dto.barcode ?? "",
    image:    categoryEmoji(dto.categoryName),
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScanToast({ feedback, itemName }: { feedback: "found" | "not_found" | null; itemName: string }) {
  return (
    <AnimatePresence>
      {feedback && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10 }}
          className={cn(
            "fixed top-20 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-2xl text-sm font-semibold border",
            feedback === "found"
              ? "bg-success text-white border-success shadow-success/30"
              : "bg-destructive text-white border-destructive shadow-destructive/30"
          )}>
          {feedback === "found"
            ? <><CheckCircle2 className="h-4 w-4 shrink-0" /><span>Added: {itemName}</span></>
            : <><AlertCircle className="h-4 w-4 shrink-0" /><span>Barcode not found: {itemName}</span></>
          }
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ProductCard({ product, onAdd }: { product: ReturnType<typeof mapToCartProduct>; onAdd: (p: ReturnType<typeof mapToCartProduct>) => void }) {
  const { tenant } = useAuthStore();
  const currency = tenant?.currency || "AED";
  const outOfStock = product.stock <= 0;
  return (
    <button
      onClick={() => !outOfStock && onAdd(product)}
      disabled={outOfStock}
      className={cn(
        "bg-card border border-border rounded-xl p-3 text-left transition-all group relative overflow-hidden",
        outOfStock ? "opacity-50 cursor-not-allowed" : "hover:border-primary/50 hover:shadow-md active:scale-95"
      )}>
      <div className="text-3xl mb-2">{product.image}</div>
      <p className="text-xs font-semibold text-foreground leading-tight line-clamp-2 mb-1">{product.name}</p>
      <p className="text-[10px] text-muted-foreground mb-1.5">{product.sku}</p>
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold">{formatCurrency(product.price, currency)}</span>
        {outOfStock
          ? <span className="text-[10px] text-destructive font-semibold">OUT</span>
          : <span className="text-[10px] text-muted-foreground">{product.stock}</span>
        }
      </div>
      {!outOfStock && (
        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Plus className="h-8 w-8 text-primary opacity-60" />
        </div>
      )}
    </button>
  );
}

function CartItemRow({ item, onInc, onDec, onRemove }: {
  item: CartItem; onInc: () => void; onDec: () => void; onRemove: () => void;
}) {
  const { tenant } = useAuthStore();
  const currency = tenant?.currency || "AED";
  return (
    <motion.div layout initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
      className="flex items-center gap-2 py-2.5 border-b border-border/50 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground truncate">{item.name}</p>
        <p className="text-[10px] text-muted-foreground">{formatCurrency(item.price, currency)} · {item.taxRate}% Tax</p>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={onDec} className="w-5 h-5 rounded-full bg-muted/60 flex items-center justify-center hover:bg-muted transition-colors">
          <Minus className="w-2.5 h-2.5" />
        </button>
        <span className="text-xs font-bold w-5 text-center">{item.quantity}</span>
        <button onClick={onInc} className="w-5 h-5 rounded-full bg-muted/60 flex items-center justify-center hover:bg-muted transition-colors">
          <Plus className="w-2.5 h-2.5" />
        </button>
      </div>
      <p className="text-xs font-bold w-16 text-right">{formatCurrency(item.total, currency)}</p>
      <button onClick={onRemove} className="text-muted-foreground hover:text-destructive transition-colors ml-0.5">
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, accent = "bg-primary" }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className={`w-1.5 h-1.5 rounded-full ${accent} mb-2`} />
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

// ─── Category Scroller ───────────────────────────────────────────────────────

function CategoryScroller({
  categories, active, onSelect,
}: {
  categories: string[];
  active:     string;
  onSelect:   (name: string) => void;
}) {
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

  const scrollBy = (dir: "left" | "right") =>
    scrollRef.current?.scrollBy({ left: dir === "left" ? -160 : 160, behavior: "smooth" });

  return (
    <div className="relative flex items-center">
      {canLeft && (
        <button onClick={() => scrollBy("left")}
          className="absolute left-0 z-10 h-full px-1 flex items-center bg-gradient-to-r from-background to-transparent">
          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
      <div ref={scrollRef}
        className="flex gap-1.5 overflow-x-auto py-0.5 px-0.5"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
        <button onClick={() => onSelect("all")}
          className={cn("px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors",
            active === "all" ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/60")}>
          All
        </button>
        {categories.map(cat => (
          <button key={cat} onClick={() => onSelect(cat)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors",
              active === cat ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/60")}>
            {categoryEmoji(cat)} {cat}
          </button>
        ))}
      </div>
      {canRight && (
        <button onClick={() => scrollBy("right")}
          className="absolute right-0 z-10 h-full px-1 flex items-center bg-gradient-to-l from-background to-transparent">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
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
  const canEditProduct  = hasRawPermission("pos.products.edit");
  const canDeleteProduct= hasRawPermission("pos.products.delete");
  const canDiscount     = hasRawPermission("pos.transactions.discount");
  const canVoid         = hasRawPermission("pos.transactions.void");
  const canRefund       = hasRawPermission("pos.transactions.refund");

  // ── Cashier mode: no supervisor/admin permissions → dedicated clean POS layout ──
  const isCashierMode = !canCloseShift && !canVoid && !canRefund && !canDiscount;
  if (isCashierMode) return <CashierPOSView />;

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
    () => (productsData?.items ?? []).map(mapToCartProduct),
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
            const mapped = mapToCartProduct({ ...product, categoryName: product.categoryName });
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

  // ── Cart actions ──────────────────────────────────────────────────────────────
  const addToCart = React.useCallback((product: ReturnType<typeof mapToCartProduct>) => {
    setCart(prev => {
      const ex = prev.find(i => i.productId === product.id);
      if (ex) return prev.map(i => i.productId === product.id
        ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.price }
        : i
      );
      return [...prev, { productId: product.id, name: product.name, price: product.price, taxRate: product.taxRate, quantity: 1, total: product.price }];
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

  // ── Totals ────────────────────────────────────────────────────────────────────
  const subtotal = cart.reduce((s, i) => s + i.total, 0);

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
  const change  = Math.max(0, (parseFloat(tenderedAmount) || 0) - total);

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
    setCart([]); setAppliedDiscount(null);
  };

  const recallHeld = (held: HeldItem) => {
    setCart(held.cart);
    setHeldTransactions(prev => prev.filter(h => h.id !== held.id));
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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Scan feedback toast */}
      <ScanToast feedback={scanFeedback} itemName={scanItemName} />

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-border bg-card shrink-0">
        <div>
          <h1 className="text-lg font-bold">Retail POS</h1>
          <p className="text-xs text-muted-foreground">
            {new Date().toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <HardwareStatusBar />
          <Button variant={activeTab === "pos" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("pos")}>
            <ShoppingCart className="w-3.5 h-3.5 mr-1.5" />POS
          </Button>
          <Button variant={activeTab === "history" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("history")}>
            <Receipt className="w-3.5 h-3.5 mr-1.5" />History
          </Button>
          {canAddProduct && (
            <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />Product
            </Button>
          )}
          {sessionId && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCashMove(true)} title="Cash in / out">
              <Wallet className="w-3.5 h-3.5" />Cash
            </Button>
          )}
          {canCloseShift && (
            <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive border-destructive/30"
              onClick={openClosePanel}>
              <LogOut className="w-3.5 h-3.5" />Close Shift
            </Button>
          )}
        </div>
      </div>

      {/* Shift banner */}
      {sessionId && (
        <div className="px-6 py-1.5 bg-success/10 border-b border-success/20 flex items-center gap-4 text-xs shrink-0">
          <div className="flex items-center gap-1.5 text-success font-semibold">
            <Clock className="h-3 w-3" />Session Active — {shiftDuration}
          </div>
          <div className="flex items-center gap-1.5 text-success ml-auto">
            <TrendingUp className="h-3 w-3" />Session Total: {formatCurrency(sessionStats.totalSales, currency)}
          </div>
        </div>
      )}

      {/* ── HISTORY TAB ────────────────────────────────────────────────────────── */}
      {activeTab === "history" ? (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Today's Sales"  value={formatCurrency(sessionStats.totalSales, currency)} accent="bg-success" />
            <StatCard label="Transactions"   value={sessionStats.totalTransactions} accent="bg-primary" />
            <StatCard label="Avg Basket"     value={formatCurrency(sessionStats.avgBasket, currency)} accent="bg-warning" />
            <StatCard label="Refunds"        value={sessionStats.refunds} accent="bg-destructive" />
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <p className="text-sm font-semibold">
                {sessionId ? "Session Transactions" : "Today's Transactions"}
              </p>
              {!sessionId && (
                <p className="text-xs text-muted-foreground">Open a shift to track live sales</p>
              )}
            </div>
            {txnLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      {["Txn #", "Total", "Payment", "Time", "Status", "Actions"].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {txns.map(tx => {
                      const statusKey = (tx.status ?? "").toLowerCase();
                      const sc = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.pending;
                      const PayIcon = paymentMethods.find(p => p.id.toLowerCase() === (tx.primaryPaymentMethod ?? "").toLowerCase())?.icon ?? Receipt;
                      const isCompleted = statusKey === "completed";
                      return (
                        <tr key={tx.id} className="border-b border-border last:border-0 hover:bg-muted/10">
                          <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{tx.transactionNumber}</td>
                          <td className="px-4 py-3 text-xs font-semibold">{formatCurrency(tx.totalAmount, currency)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 text-xs">
                              <PayIcon className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{tx.primaryPaymentMethod}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {tx.completedAt ? new Date(tx.completedAt).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" }) : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", sc.bg, sc.color)}>{sc.label}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleReprint(tx.id)}
                                disabled={reprintingId === tx.id}
                                title="Reprint receipt"
                                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 flex items-center gap-1">
                                {reprintingId === tx.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Printer className="h-3 w-3" />}
                                Reprint
                              </button>
                              {canVoid && isCompleted && (
                                <button
                                  onClick={() => setVoidTarget(tx)}
                                  className="px-2 py-0.5 rounded text-[10px] font-semibold bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                                  Void
                                </button>
                              )}
                              {canRefund && isCompleted && sessionId && (
                                <button
                                  onClick={() => setRefundTarget(tx)}
                                  className="px-2 py-0.5 rounded text-[10px] font-semibold bg-warning/10 text-warning hover:bg-warning/20 transition-colors">
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
                        <td colSpan={6} className="px-4 py-10 text-center text-xs text-muted-foreground">
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
        /* ── POS TAB ─────────────────────────────────────────────────────────── */
        <div className="flex-1 flex overflow-hidden">
          {/* Left — Products */}
          <div className="flex-1 flex flex-col overflow-hidden border-r border-border">
            <div className="p-4 border-b border-border space-y-3 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name, SKU, or barcode…" className="pl-9 h-9 text-sm" />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {/* Category horizontal scroller */}
              <CategoryScroller
                categories={categories}
                active={categoryFilter}
                onSelect={setCategoryFilter}
              />
            </div>

            {/* Product grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {productsLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">Loading products…</p>
                </div>
              ) : filtered.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {filtered.map(p => <ProductCard key={p.id} product={p} onAdd={addToCart} />)}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Package className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No products found</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Try a different search or scan a barcode</p>
                  <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={() => refetchProducts()}>
                    <RefreshCw className="h-3.5 w-3.5" />Refresh
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Right — Cart */}
          <div className="w-80 shrink-0 flex flex-col bg-card">
            {/* Cart header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold">
                  Cart {cart.length > 0 && `(${cart.reduce((s, i) => s + i.quantity, 0)})`}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {cart.length > 0 && (
                  <button onClick={holdCart} title="Hold transaction"
                    className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors">
                    <Pause className="h-3.5 w-3.5" />
                  </button>
                )}
                {heldTransactions.length > 0 && (
                  <button onClick={() => setShowHeldPanel(p => !p)} title="Recall held transactions"
                    className="relative p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors">
                    <PlayCircle className="h-3.5 w-3.5" />
                    <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-warning text-white text-[8px] font-bold flex items-center justify-center">
                      {heldTransactions.length}
                    </span>
                  </button>
                )}
                {cart.length > 0 && (
                  <button onClick={() => setCart([])} className="text-xs text-destructive hover:underline flex items-center gap-1 ml-1">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Customer selector */}
            <div className="px-4 py-2 border-b border-border shrink-0">
              <CustomerSelect selected={selectedCustomer} onSelect={setSelectedCustomer} />
            </div>

            {/* Held panel */}
            <AnimatePresence>
              {showHeldPanel && heldTransactions.length > 0 && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="border-b border-border overflow-hidden shrink-0">
                  <div className="p-3 space-y-1.5 bg-warning/5">
                    <p className="text-xs font-semibold text-warning">Held Transactions</p>
                    {heldTransactions.map(h => (
                      <button key={h.id} onClick={() => recallHeld(h)}
                        className="w-full text-left px-3 py-2 rounded-lg bg-card border border-border hover:border-primary/40 text-xs transition-colors">
                        <p className="font-medium">{h.label}</p>
                        <p className="text-muted-foreground">{h.timestamp}</p>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Cart items */}
            <div className="flex-1 overflow-y-auto px-4">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <ShoppingCart className="w-10 h-10 text-muted-foreground/25 mb-3" />
                  <p className="text-sm text-muted-foreground">Cart is empty</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Click products or scan a barcode</p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {cart.map(item => (
                    <CartItemRow key={item.productId} item={item}
                      onInc={() => updateQty(item.productId, 1)}
                      onDec={() => updateQty(item.productId, -1)}
                      onRemove={() => removeFromCart(item.productId)} />
                  ))}
                </AnimatePresence>
              )}
            </div>

            {/* Totals + payment + checkout */}
            {cart.length > 0 && !showReceipt && (
              <div className="border-t border-border p-4 space-y-3 shrink-0">
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

                {/* Line totals */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Subtotal</span><span>{formatCurrency(subtotal, currency)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-xs text-success font-medium">
                      <span>Discount{appliedDiscount ? ` (${appliedDiscount.label})` : ""}</span>
                      <span>–{formatCurrency(discountAmount, currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Tax</span><span>{formatCurrency(taxAmount, currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-foreground pt-1.5 border-t border-border">
                    <span>Total</span><span>{formatCurrency(total, currency)}</span>
                  </div>
                </div>

                {/* Payment methods */}
                <div className="grid grid-cols-2 gap-1.5">
                  {paymentMethods.map(opt => {
                    const Icon = opt.icon;
                    return (
                      <button key={opt.id} onClick={() => setPaymentMethod(opt.id)}
                        className={cn("flex items-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium border transition-colors",
                          paymentMethod === opt.id
                            ? `border-2 ${opt.bg} ${opt.color}`
                            : "border-border bg-muted/20 text-muted-foreground hover:border-primary/40")}>
                        <Icon className="h-3.5 w-3.5 shrink-0" />{opt.label}
                      </button>
                    );
                  })}
                </div>

                {/* Cash tender */}
                <AnimatePresence>
                  {paymentMethod === "Cash" && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden space-y-2">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Amount Tendered</p>
                        <Input type="number" min={0} step={10} value={tenderedAmount}
                          onChange={e => setTenderedAmount(e.target.value)}
                          placeholder={formatCurrency(total, currency)} className="h-9 text-sm text-right" />
                      </div>
                      {parseFloat(tenderedAmount) >= total && (
                        <div className="flex items-center justify-between px-3 py-2 bg-success/10 border border-success/20 rounded-lg">
                          <span className="text-xs font-semibold text-success">Change Due</span>
                          <span className="text-sm font-bold text-success">{formatCurrency(change, currency)}</span>
                        </div>
                      )}
                      <div className="grid grid-cols-4 gap-1">
                        {[Math.ceil(total / 100) * 100, Math.ceil(total / 500) * 500, Math.ceil(total / 1000) * 1000, Math.ceil(total / 5000) * 5000]
                          .filter((v, i, arr) => arr.indexOf(v) === i && v >= total)
                          .slice(0, 4)
                          .map(v => (
                            <button key={v} onClick={() => setTenderedAmount(String(v))}
                              className="py-1.5 rounded-lg border border-border text-[10px] font-semibold text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors">
                              {v >= 1000 ? `${v / 1000}k` : v}
                            </button>
                          ))
                        }
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Charge + Split buttons */}
                <div className="flex gap-2">
                  <Button className="flex-1 font-bold" size="lg" onClick={() => handleCheckout()}
                    disabled={
                      createSaleMutation.isPending ||
                      (paymentMethod === "Cash" && !!tenderedAmount && parseFloat(tenderedAmount) < total)
                    }>
                    {createSaleMutation.isPending
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing…</>
                      : `Charge ${formatCurrency(total, currency)}`
                    }
                  </Button>
                  <Button variant="outline" size="lg" className="gap-1.5" onClick={() => setShowSplit(true)}
                    disabled={createSaleMutation.isPending} title="Split payment across methods">
                    <SplitSquareHorizontal className="h-4 w-4" />
                    <span className="hidden sm:inline">Split</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
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

