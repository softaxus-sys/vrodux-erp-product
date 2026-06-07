"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency } from "@/lib/utils";
import {
  Search, X, ShoppingCart, Trash2, Plus, Minus, CreditCard,
  Banknote, Smartphone, Receipt, RotateCcw, Package, Scan,
  CheckCircle2, AlertCircle, Percent, Tag, Pause, PlayCircle,
  Clock, TrendingUp, LogOut, Printer, ChevronDown, Loader2, RefreshCw,
} from "lucide-react";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import { AddPOSProductForm } from "./add-pos-product-form";
import { useAllPOSProducts } from "@/hooks/pos/use-products";
import { useActiveSessions, useOpenSession, useCloseSession } from "@/hooks/pos/use-sessions";
import { useTransactions, useCreateSale } from "@/hooks/pos/use-transactions";
import { useAuthStore } from "@/store/auth.store";
import { productsApi } from "@/lib/pos/products.api";
import type { ProductSummaryDto, POSTransactionSummaryDto } from "@/lib/pos/types";
import type { PagedResult } from "@/lib/api-client";

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
  const key = name.toLowerCase().replace(/[\s-]+/g, "_");
  return CATEGORY_EMOJI[key] ?? "📦";
}

const PAYMENT_METHODS = [
  { value: "Cash",      label: "Cash",       icon: Banknote },
  { value: "Card",      label: "Card",       icon: CreditCard },
  { value: "EasyPaisa", label: "EasyPaisa",  icon: Smartphone },
  { value: "JazzCash",  label: "JazzCash",   icon: Smartphone },
];

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
        <span className="text-sm font-bold">{formatCurrency(product.price, "PKR")}</span>
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
  return (
    <motion.div layout initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
      className="flex items-center gap-2 py-2.5 border-b border-border/50 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground truncate">{item.name}</p>
        <p className="text-[10px] text-muted-foreground">{formatCurrency(item.price, "PKR")} · {item.taxRate}% Tax</p>
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
      <p className="text-xs font-bold w-16 text-right">{formatCurrency(item.total, "PKR")}</p>
      <button onClick={onRemove} className="text-muted-foreground hover:text-destructive transition-colors ml-0.5">
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

// ─── Receipt Modal ────────────────────────────────────────────────────────────

function ReceiptModal({ cart, subtotal, discountAmount, taxAmount, total, paymentMethod, tenderedAmount, txnNumber, onClose, onNewSale }: {
  cart: CartItem[]; subtotal: number; discountAmount: number; taxAmount: number; total: number;
  paymentMethod: string; tenderedAmount: number; txnNumber: string; onClose: () => void; onNewSale: () => void;
}) {
  const change = Math.max(0, tenderedAmount - total);
  return (
    <motion.div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}>
      <motion.div className="bg-white dark:bg-card w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}
        onClick={e => e.stopPropagation()}>
        <div className="bg-primary px-6 py-5 text-white text-center">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-2">
            <Receipt className="h-5 w-5" />
          </div>
          <p className="text-xs opacity-80 font-medium">PAYMENT SUCCESSFUL</p>
          <p className="text-3xl font-bold mt-1">{formatCurrency(total, "PKR")}</p>
          <p className="text-xs opacity-70 mt-1 capitalize">{paymentMethod}</p>
        </div>
        <div className="p-5 font-mono text-xs space-y-3">
          <div className="flex justify-between text-muted-foreground">
            <span>Transaction #</span><span className="text-foreground">{txnNumber || "—"}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Date</span><span className="text-foreground">{new Date().toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" })}</span>
          </div>
          <div className="border-t border-dashed border-border pt-3 space-y-1.5">
            {cart.map(item => (
              <div key={item.productId} className="flex justify-between">
                <span className="truncate flex-1 mr-2">{item.name} × {item.quantity}</span>
                <span className="shrink-0">{formatCurrency(item.total, "PKR")}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-dashed border-border pt-3 space-y-1.5">
            <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatCurrency(subtotal, "PKR")}</span></div>
            {discountAmount > 0 && <div className="flex justify-between text-success"><span>Discount</span><span>–{formatCurrency(discountAmount, "PKR")}</span></div>}
            <div className="flex justify-between text-muted-foreground"><span>Tax</span><span>{formatCurrency(taxAmount, "PKR")}</span></div>
            <div className="flex justify-between font-bold text-base text-foreground pt-1 border-t border-border">
              <span>TOTAL</span><span>{formatCurrency(total, "PKR")}</span>
            </div>
            {paymentMethod === "Cash" && tenderedAmount > 0 && (
              <>
                <div className="flex justify-between text-muted-foreground"><span>Tendered</span><span>{formatCurrency(tenderedAmount, "PKR")}</span></div>
                <div className="flex justify-between font-bold text-success"><span>CHANGE</span><span>{formatCurrency(change, "PKR")}</span></div>
              </>
            )}
          </div>
          <p className="text-center text-muted-foreground pt-2">Thank you for your purchase!</p>
        </div>
        <div className="px-5 pb-5 space-y-2">
          <Button className="w-full gap-2" onClick={onNewSale}>
            <RotateCcw className="h-3.5 w-3.5" />New Sale
          </Button>
          <Button variant="outline" className="w-full gap-2" size="sm">
            <Printer className="h-3.5 w-3.5" />Print Receipt
          </Button>
        </div>
      </motion.div>
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

// ─── Main View ────────────────────────────────────────────────────────────────

export function RetailPOSView() {
  const { user } = useAuthStore();

  // Navigation
  const [activeTab, setActiveTab]     = React.useState<"pos" | "history">("pos");

  // Product filtering
  const [search, setSearch]           = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");

  // Cart
  const [cart, setCart]               = React.useState<CartItem[]>([]);

  // Discount
  const [discountType, setDiscountType]   = React.useState<"flat" | "pct">("pct");
  const [discountValue, setDiscountValue] = React.useState("");
  const [showDiscount, setShowDiscount]   = React.useState(false);

  // Payment
  const [paymentMethod, setPaymentMethod] = React.useState("Card");
  const [tenderedAmount, setTenderedAmount] = React.useState("");
  const [showReceipt, setShowReceipt]     = React.useState(false);
  const [completedTxnNumber, setCompletedTxnNumber] = React.useState("");

  // Scanner feedback
  const [scanFeedback, setScanFeedback]   = React.useState<"found" | "not_found" | null>(null);
  const [scanItemName, setScanItemName]   = React.useState("");

  // Session/shift management
  const [sessionId, setSessionId]         = React.useState<string | null>(null);
  const [showShiftModal, setShowShiftModal] = React.useState(false);
  const [openingCashInput, setOpeningCashInput] = React.useState("0");
  const [shiftOpenedAt, setShiftOpenedAt] = React.useState("");

  // Hold & recall
  const [heldTransactions, setHeldTransactions] = React.useState<HeldItem[]>([]);
  const [showHeldPanel, setShowHeldPanel] = React.useState(false);

  // Add product form
  const [showAddForm, setShowAddForm]     = React.useState(false);

  // ── API hooks ─────────────────────────────────────────────────────────────────
  const { data: productsData, isLoading: productsLoading, refetch: refetchProducts } = useAllPOSProducts();
  const { data: activeSessions } = useActiveSessions();
  const openSessionMutation  = useOpenSession();
  const closeSessionMutation = useCloseSession();
  const createSaleMutation   = useCreateSale();

  // Transactions for history tab (scoped to current session if open)
  const { data: txnData, isLoading: txnLoading } = useTransactions({
    sessionId: sessionId ?? undefined,
    pageSize: 50,
  });

  // Sync active session on mount
  React.useEffect(() => {
    if (activeSessions && activeSessions.length > 0 && !sessionId) {
      const activeSession = activeSessions[0];
      setSessionId(activeSession.id);
      setShiftOpenedAt(new Date(activeSession.openedAt).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" }));
    }
  }, [activeSessions, sessionId]);

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

  const discountAmount = React.useMemo(() => {
    const v = parseFloat(discountValue) || 0;
    if (!v || cart.length === 0) return 0;
    if (discountType === "flat") return Math.min(v, subtotal);
    return subtotal * (v / 100);
  }, [discountValue, discountType, subtotal, cart.length]);

  const taxBase   = subtotal - discountAmount;
  const taxAmount = cart.reduce((s, i) => {
    if (!subtotal) return 0;
    const itemShare = (i.total / subtotal) * taxBase;
    return s + itemShare * (i.taxRate / 100);
  }, 0);
  const total   = taxBase + taxAmount;
  const change  = Math.max(0, (parseFloat(tenderedAmount) || 0) - total);

  // ── Checkout ──────────────────────────────────────────────────────────────────
  const handleCheckout = async () => {
    if (!cart.length) return;
    if (!sessionId) { setShowShiftModal(true); return; }

    try {
      const txn = await createSaleMutation.mutateAsync({
        sessionId,
        lineItems: cart.map(item => ({
          productId:      item.productId,
          quantity:       item.quantity,
          discountPercent: discountType === "pct" ? (parseFloat(discountValue) || 0) : 0,
          discountAmount:  discountType === "flat" ? Math.min(
            (item.total / subtotal) * discountAmount, item.total
          ) : 0,
        })),
        payments: [{
          method:    paymentMethod,
          amount:    total,
          reference: null,
        }],
      });

      setCompletedTxnNumber(txn.transactionNumber);
      setShowReceipt(true);
      refetchProducts(); // update stock levels
    } catch {
      // error shown via mutation's onError toast
    }
  };

  const handleNewSale = () => {
    setCart([]);
    setDiscountValue("");
    setShowReceipt(false);
    setTenderedAmount("");
    setCompletedTxnNumber("");
  };

  // ── Session / Shift ───────────────────────────────────────────────────────────
  const openShift = async () => {
    try {
      const session = await openSessionMutation.mutateAsync({
        registerId:   "Terminal-1",
        openingCash:  parseFloat(openingCashInput) || 0,
        notes:        null,
      });
      setSessionId(session.id);
      setShiftOpenedAt(new Date(session.openedAt).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" }));
      setShowShiftModal(false);
    } catch {
      // error toast via hook
    }
  };

  const closeShift = async () => {
    if (!sessionId) return;
    try {
      await closeSessionMutation.mutateAsync({
        sessionId,
        closingCash: 0, // TODO: add closing cash input
        notes:       null,
      });
      setSessionId(null);
      setShiftOpenedAt("");
    } catch {
      // error toast via hook
    }
  };

  // ── Hold & Recall ─────────────────────────────────────────────────────────────
  const holdCart = () => {
    if (!cart.length) return;
    const held: HeldItem = {
      id:        `hld-${Date.now()}`,
      label:     `Hold ${heldTransactions.length + 1} · ${cart.length} items · ${formatCurrency(total, "PKR")}`,
      cart:      [...cart],
      timestamp: new Date().toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" }),
    };
    setHeldTransactions(prev => [...prev, held]);
    setCart([]); setDiscountValue("");
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
    <div className="flex flex-col h-full">
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
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-success/10 border border-success/20">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            <Scan className="h-3 w-3 text-success" />
            <span className="text-[10px] text-success font-semibold">Scanner Ready</span>
          </div>
          <Button variant={activeTab === "pos" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("pos")}>
            <ShoppingCart className="w-3.5 h-3.5 mr-1.5" />POS
          </Button>
          <Button variant={activeTab === "history" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("history")}>
            <Receipt className="w-3.5 h-3.5 mr-1.5" />History
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />Product
          </Button>
          {sessionId
            ? (
              <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive border-destructive/30"
                onClick={closeShift} disabled={closeSessionMutation.isPending}>
                {closeSessionMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                Close Shift
              </Button>
            )
            : (
              <Button size="sm" className="gap-1.5 bg-success hover:bg-success/90" onClick={() => setShowShiftModal(true)}>
                <PlayCircle className="w-3.5 h-3.5" />Open Shift
              </Button>
            )
          }
        </div>
      </div>

      {/* Shift banner */}
      {sessionId && (
        <div className="px-6 py-1.5 bg-success/10 border-b border-success/20 flex items-center gap-4 text-xs shrink-0">
          <div className="flex items-center gap-1.5 text-success font-semibold">
            <Clock className="h-3 w-3" />Session Active — Opened {shiftOpenedAt}
          </div>
          <div className="flex items-center gap-1.5 text-success ml-auto">
            <TrendingUp className="h-3 w-3" />Session Total: {formatCurrency(sessionStats.totalSales, "PKR")}
          </div>
        </div>
      )}

      {/* ── HISTORY TAB ────────────────────────────────────────────────────────── */}
      {activeTab === "history" ? (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Today's Sales"  value={formatCurrency(sessionStats.totalSales, "PKR")} accent="bg-success" />
            <StatCard label="Transactions"   value={sessionStats.totalTransactions} accent="bg-primary" />
            <StatCard label="Avg Basket"     value={formatCurrency(sessionStats.avgBasket, "PKR")} accent="bg-warning" />
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
                      {["Txn #", "Items", "Subtotal", "Tax", "Total", "Payment", "Time", "Status"].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {txns.map(tx => {
                      const statusKey = tx.status.toLowerCase();
                      const sc = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.pending;
                      const PayIcon = PAYMENT_METHODS.find(p => p.value.toLowerCase() === tx.primaryPaymentMethod.toLowerCase())?.icon ?? Receipt;
                      return (
                        <tr key={tx.id} className="border-b border-border last:border-0 hover:bg-muted/10">
                          <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{tx.transactionNumber}</td>
                          <td className="px-4 py-3 text-xs">—</td>
                          <td className="px-4 py-3 text-xs">—</td>
                          <td className="px-4 py-3 text-xs">—</td>
                          <td className="px-4 py-3 text-xs font-semibold">{formatCurrency(tx.totalAmount, "PKR")}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 text-xs">
                              <PayIcon className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{tx.primaryPaymentMethod}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {new Date(tx.completedAt).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", sc.bg, sc.color)}>{sc.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                    {txns.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-xs text-muted-foreground">
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
              {/* Category pills */}
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                <button onClick={() => setCategoryFilter("all")}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
                    categoryFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/60")}>
                  All
                </button>
                {categories.map(cat => (
                  <button key={cat} onClick={() => setCategoryFilter(cat)}
                    className={cn("px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
                      categoryFilter === cat ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/60")}>
                    {categoryEmoji(cat)} {cat}
                  </button>
                ))}
              </div>
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
                {/* Discount toggle */}
                <button onClick={() => setShowDiscount(p => !p)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
                  <Tag className="h-3 w-3" />
                  {showDiscount ? "Remove Discount" : "Add Discount"}
                  <ChevronDown className={cn("h-3 w-3 transition-transform", showDiscount && "rotate-180")} />
                </button>

                <AnimatePresence>
                  {showDiscount && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden">
                      <div className="flex gap-2">
                        <div className="flex rounded-lg border border-border overflow-hidden">
                          {(["pct", "flat"] as const).map(dt => (
                            <button key={dt} onClick={() => setDiscountType(dt)}
                              className={cn("px-2.5 py-1.5 text-xs font-semibold transition-colors",
                                discountType === dt ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground")}>
                              {dt === "pct" ? <Percent className="h-3 w-3" /> : "PKR"}
                            </button>
                          ))}
                        </div>
                        <Input type="number" min={0} max={discountType === "pct" ? 100 : undefined}
                          value={discountValue} onChange={e => setDiscountValue(e.target.value)}
                          placeholder={discountType === "pct" ? "0%" : "0.00"}
                          className="h-8 text-xs flex-1" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Line totals */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Subtotal</span><span>{formatCurrency(subtotal, "PKR")}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-xs text-success font-medium">
                      <span>Discount ({discountType === "pct" ? `${discountValue}%` : "flat"})</span>
                      <span>–{formatCurrency(discountAmount, "PKR")}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Tax</span><span>{formatCurrency(taxAmount, "PKR")}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-foreground pt-1.5 border-t border-border">
                    <span>Total</span><span>{formatCurrency(total, "PKR")}</span>
                  </div>
                </div>

                {/* Payment methods */}
                <div className="grid grid-cols-2 gap-1.5">
                  {PAYMENT_METHODS.map(opt => {
                    const Icon = opt.icon;
                    return (
                      <button key={opt.value} onClick={() => setPaymentMethod(opt.value)}
                        className={cn("flex items-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium border transition-colors",
                          paymentMethod === opt.value
                            ? "border-primary bg-primary/10 text-primary"
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
                          placeholder={formatCurrency(total, "PKR")} className="h-9 text-sm text-right" />
                      </div>
                      {parseFloat(tenderedAmount) >= total && (
                        <div className="flex items-center justify-between px-3 py-2 bg-success/10 border border-success/20 rounded-lg">
                          <span className="text-xs font-semibold text-success">Change Due</span>
                          <span className="text-sm font-bold text-success">{formatCurrency(change, "PKR")}</span>
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

                {/* Charge button */}
                <Button className="w-full font-bold" size="lg" onClick={handleCheckout}
                  disabled={
                    createSaleMutation.isPending ||
                    (paymentMethod === "Cash" && !!tenderedAmount && parseFloat(tenderedAmount) < total)
                  }>
                  {createSaleMutation.isPending
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing…</>
                    : sessionId
                      ? `Charge ${formatCurrency(total, "PKR")}`
                      : "Open Shift to Charge"
                  }
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Receipt Modal ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showReceipt && (
          <ReceiptModal
            cart={cart}
            subtotal={subtotal}
            discountAmount={discountAmount}
            taxAmount={taxAmount}
            total={total}
            paymentMethod={paymentMethod}
            tenderedAmount={parseFloat(tenderedAmount) || 0}
            txnNumber={completedTxnNumber}
            onClose={() => setShowReceipt(false)}
            onNewSale={handleNewSale}
          />
        )}
      </AnimatePresence>

      {/* ── Open Shift Modal ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showShiftModal && (
          <motion.div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowShiftModal(false)}>
            <motion.div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6"
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}
              onClick={e => e.stopPropagation()}>
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-3">
                  <PlayCircle className="h-7 w-7 text-success" />
                </div>
                <h2 className="text-lg font-bold">Open Shift</h2>
                <p className="text-sm text-muted-foreground mt-1">Start a new POS session to begin processing sales</p>
              </div>
              <div className="space-y-3 mb-6">
                {[
                  { label: "Cashier",  value: user?.name ?? "Current User" },
                  { label: "Date",     value: new Date().toLocaleDateString("en-PK", { dateStyle: "long" }) },
                  { label: "Time",     value: new Date().toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" }) },
                  { label: "Terminal", value: "Retail POS — Terminal 1" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Opening Cash (PKR)</label>
                  <Input type="number" min={0} step={100}
                    value={openingCashInput}
                    onChange={e => setOpeningCashInput(e.target.value)}
                    className="h-9 text-sm" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowShiftModal(false)}>Cancel</Button>
                <Button className="flex-1 bg-success hover:bg-success/90" onClick={openShift}
                  disabled={openSessionMutation.isPending}>
                  {openSessionMutation.isPending
                    ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Opening…</>
                    : <><PlayCircle className="h-4 w-4 mr-1.5" />Open Shift</>
                  }
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AddPOSProductForm open={showAddForm} onClose={() => setShowAddForm(false)} />
    </div>
  );
}
