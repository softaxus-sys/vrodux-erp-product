/**
 * pos-ui — shared, high-legibility building blocks for the Retail POS screens.
 *
 * Designed for a shop counter: large bold type, big touch targets (≥ 44px),
 * strong contrast, and function-key shortcuts. Used by both RetailPOSView
 * (supervisor) and CashierPOSView so the two terminals look and behave alike.
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, X, Plus, Minus, ChevronLeft, ChevronRight, Pause, PlayCircle, Trash2,
  CheckCircle2, AlertCircle, Delete, ShoppingCart, Loader2, Receipt,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { PaymentMethodDef } from "@/lib/pos/payment-methods.config";
import type { ProductSummaryDto } from "@/lib/pos/types";

// ─── Product mapping ──────────────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<string, string> = {
  beverages: "🥤", snacks: "🍫", electronics: "🔌", accessories: "🕶️",
  stationery: "📝", personal_care: "🧴", gifts: "🎁", tobacco: "🚬",
  food: "🍔", clothing: "👕", shoes: "👟", sports: "⚽", toys: "🧸",
  books: "📚", pharmacy: "💊", household: "🏠", cosmetics: "💄",
  "food_&_beverages": "🥤", food_and_beverages: "🥤",
};

export function categoryEmoji(name: string): string {
  if (!name) return "📦";
  return CATEGORY_EMOJI[name.toLowerCase().replace(/[\s-]+/g, "_")] ?? "📦";
}

export interface PosProduct {
  id:       string;
  sku:      string;
  name:     string;
  category: string;
  price:    number;
  taxRate:  number;
  stock:    number;
  barcode:  string;
  emoji:    string;
}

export function mapToPosProduct(dto: ProductSummaryDto): PosProduct {
  return {
    id:       dto.id,
    sku:      dto.sku ?? "",
    name:     dto.name,
    category: dto.categoryName,
    price:    dto.salePrice,
    taxRate:  dto.taxRate,
    stock:    dto.stockQuantity,
    barcode:  dto.barcode ?? "",
    emoji:    categoryEmoji(dto.categoryName),
  };
}

// ─── Keyboard shortcuts ───────────────────────────────────────────────────────

/** Binds keys (e.g. { F2: focusSearch, F9: charge }) while `enabled`. Undefined handlers are ignored. */
export function usePosShortcuts(map: Record<string, (() => void) | undefined>, enabled = true) {
  const mapRef = React.useRef(map);
  React.useLayoutEffect(() => { mapRef.current = map; });

  React.useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const fn = mapRef.current[e.key];
      if (!fn) return;
      e.preventDefault();
      fn();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled]);
}

export function KeyHint({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd className={cn(
      "hidden lg:inline-flex items-center px-1.5 py-0.5 rounded-md border border-current text-xs font-bold font-sans leading-none opacity-60",
      className,
    )}>
      {children}
    </kbd>
  );
}

// ─── Scan feedback ────────────────────────────────────────────────────────────

export function ScanToast({ feedback, itemName }: { feedback: "found" | "not_found" | null; itemName: string }) {
  return (
    <AnimatePresence>
      {feedback && (
        <motion.div
          initial={{ opacity: 0, y: -24, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12 }}
          className={cn(
            "fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl text-lg font-extrabold",
            feedback === "found" ? "bg-success text-white" : "bg-destructive text-white"
          )}>
          {feedback === "found"
            ? <><CheckCircle2 className="h-6 w-6 shrink-0" /> Added: {itemName}</>
            : <><AlertCircle className="h-6 w-6 shrink-0" /> Not found: {itemName}</>
          }
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Search ───────────────────────────────────────────────────────────────────

export const PosSearch = React.forwardRef<HTMLInputElement, {
  value: string;
  onChange: (v: string) => void;
}>(function PosSearch({ value, onChange }, ref) {
  return (
    <div className="relative">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground pointer-events-none" />
      <input
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === "Escape") onChange(""); }}
        placeholder="Search product name, SKU or barcode…"
        className={cn(
          "w-full h-14 pl-14 pr-20 rounded-2xl border-2 border-border bg-card",
          "text-lg font-semibold text-foreground placeholder:text-muted-foreground placeholder:font-medium",
          "focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 transition-colors"
        )}
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
        {value ? (
          <button onClick={() => onChange("")} aria-label="Clear search"
            className="h-9 w-9 rounded-xl bg-muted hover:bg-muted-foreground/20 flex items-center justify-center">
            <X className="h-5 w-5" />
          </button>
        ) : (
          <KeyHint className="text-muted-foreground">F2</KeyHint>
        )}
      </div>
    </div>
  );
});

// ─── Categories ───────────────────────────────────────────────────────────────

export function CategoryPills({
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
    scrollRef.current?.scrollBy({ left: dir === "left" ? -240 : 240, behavior: "smooth" });

  const arrow = "absolute z-10 h-12 w-12 flex items-center justify-center rounded-xl bg-card border-2 border-border shadow-md hover:border-primary";

  return (
    <div className="relative flex items-center">
      {canLeft && (
        <button onClick={() => scrollBy("left")} className={cn(arrow, "left-0")} aria-label="Scroll categories left">
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      <div ref={scrollRef} className="flex gap-2 overflow-x-auto py-1" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
        {["all", ...categories].map(cat => {
          const isActive = active === cat;
          return (
            <button key={cat} onClick={() => onSelect(cat)}
              className={cn(
                "h-12 px-5 rounded-xl text-base font-bold whitespace-nowrap shrink-0 border-2 transition-colors",
                isActive
                  ? "bg-primary border-primary text-primary-foreground shadow-md"
                  : "bg-card border-border text-foreground hover:border-primary"
              )}>
              {cat === "all" ? "All Items" : `${categoryEmoji(cat)}  ${cat}`}
            </button>
          );
        })}
      </div>
      {canRight && (
        <button onClick={() => scrollBy("right")} className={cn(arrow, "right-0")} aria-label="Scroll categories right">
          <ChevronRight className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}

// ─── Product tile ─────────────────────────────────────────────────────────────

export const PRODUCT_GRID = "grid gap-3 grid-cols-[repeat(auto-fill,minmax(170px,1fr))]";

export function ProductTile({
  product, inCart, currency, onAdd,
}: {
  product:  PosProduct;
  inCart:   number;
  currency: string;
  onAdd:    () => void;
}) {
  const oos = product.stock <= 0;
  const low = !oos && product.stock <= 5;
  return (
    <motion.button
      whileTap={oos ? undefined : { scale: 0.95 }}
      onClick={() => !oos && onAdd()}
      disabled={oos}
      title={oos ? "Out of stock — add stock in Inventory before this item can be sold" : undefined}
      className={cn(
        "relative flex flex-col items-stretch p-4 rounded-2xl border-2 text-left select-none min-h-[168px] transition-colors",
        oos
          ? "border-border bg-muted/40 opacity-50 cursor-not-allowed"
          : inCart > 0
            ? "border-primary bg-primary/5 shadow-md"
            : "border-border bg-card hover:border-primary hover:shadow-lg"
      )}
    >
      {inCart > 0 && (
        <span className="absolute -top-2.5 -right-2.5 z-10 min-w-[2rem] h-8 px-2 rounded-full bg-primary text-primary-foreground text-base font-black flex items-center justify-center shadow-lg ring-4 ring-background">
          {inCart}
        </span>
      )}

      <div className="flex items-start justify-between gap-2">
        <span className="text-4xl leading-none">{product.emoji}</span>
        <span className={cn(
          "text-xs font-extrabold px-2 py-1 rounded-lg uppercase tracking-wide whitespace-nowrap",
          oos ? "bg-destructive text-white" : low ? "bg-warning/20 text-warning" : "bg-muted text-muted-foreground"
        )}>
          {oos ? "Out" : `${product.stock} left`}
        </span>
      </div>

      <p className="mt-3 text-base font-bold text-foreground leading-snug line-clamp-2 flex-1">{product.name}</p>
      {product.sku && <p className="text-xs font-semibold text-muted-foreground font-mono mt-1 truncate">{product.sku}</p>}

      <p className="mt-2 text-xl font-black text-foreground tabular-nums">
        {formatCurrency(product.price, currency)}
      </p>
    </motion.button>
  );
}

export function ProductsLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <p className="text-lg font-bold text-muted-foreground">Loading products…</p>
    </div>
  );
}

export function ProductsEmpty({ action }: { action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <span className="text-6xl mb-4">🔍</span>
      <p className="text-xl font-extrabold text-foreground">No products found</p>
      <p className="text-base font-medium text-muted-foreground mt-1">Try another search or scan a barcode</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ─── Cart ─────────────────────────────────────────────────────────────────────

export const CART_PANEL = "w-[420px] xl:w-[460px] shrink-0 flex flex-col bg-card border-l-2 border-border";

export function CartHeader({
  itemCount, heldCount, onHold, onClear, onToggleHeld,
}: {
  itemCount: number; heldCount: number;
  onHold: () => void; onClear: () => void; onToggleHeld: () => void;
}) {
  const btn = "h-11 flex items-center gap-1.5 px-3 rounded-xl border-2 text-base font-bold transition-colors";
  return (
    <div className="px-5 py-3 border-b-2 border-border flex items-center justify-between gap-2 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <p className="text-xl font-black whitespace-nowrap">Current Sale</p>
        {itemCount > 0 && (
          <span className="h-8 min-w-[2rem] px-2 rounded-full bg-primary text-primary-foreground text-base font-black flex items-center justify-center">
            {itemCount}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {heldCount > 0 && (
          <button onClick={onToggleHeld} title="Recall a held sale"
            className={cn(btn, "border-warning/50 bg-warning/10 text-warning hover:bg-warning/20")}>
            <PlayCircle className="h-5 w-5" strokeWidth={2.5} />{heldCount}
          </button>
        )}
        {itemCount > 0 && (
          <>
            <button onClick={onHold} title="Hold this sale (F4)" className={cn(btn, "border-border hover:border-primary")}>
              <Pause className="h-5 w-5" strokeWidth={2.5} />Hold
            </button>
            <button onClick={onClear} title="Clear cart" aria-label="Clear cart"
              className={cn(btn, "px-2.5 border-border text-destructive hover:bg-destructive/10 hover:border-destructive")}>
              <Trash2 className="h-5 w-5" strokeWidth={2.5} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Held sales list — render inside <AnimatePresence>. */
export function HeldList({
  items, onRecall,
}: {
  items: { id: string; title: string; subtitle: string }[];
  onRecall: (id: string) => void;
}) {
  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
      className="border-b-2 border-border overflow-hidden shrink-0">
      <div className="p-4 bg-warning/5 space-y-2">
        <p className="text-sm font-extrabold uppercase tracking-wide text-warning">Held sales — tap to resume</p>
        {items.map(h => (
          <button key={h.id} onClick={() => onRecall(h.id)}
            className="w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-card border-2 border-border hover:border-primary text-left">
            <div className="min-w-0">
              <p className="text-base font-bold truncate">{h.title}</p>
              <p className="text-sm font-semibold text-muted-foreground truncate">{h.subtitle}</p>
            </div>
            <ChevronRight className="h-6 w-6 text-primary shrink-0" />
          </button>
        ))}
      </div>
    </motion.div>
  );
}

export function CartLine({
  name, price, quantity, total, emoji, currency, onInc, onDec, onRemove,
}: {
  name: string; price: number; quantity: number; total: number; emoji?: string; currency: string;
  onInc: () => void; onDec: () => void; onRemove: () => void;
}) {
  const qtyBtn = "h-11 w-11 rounded-xl border-2 border-border bg-card flex items-center justify-center hover:border-primary hover:text-primary active:scale-95 transition";
  return (
    <motion.div layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="py-3 border-b-2 border-border/60 last:border-0">
      <div className="flex items-start gap-3">
        {emoji && <span className="text-2xl leading-none mt-0.5">{emoji}</span>}
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-foreground leading-snug line-clamp-2">{name}</p>
          <p className="text-sm font-semibold text-muted-foreground tabular-nums">{formatCurrency(price, currency)} each</p>
        </div>
        <button onClick={onRemove} aria-label={`Remove ${name}`}
          className="h-9 w-9 -mt-1 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex items-center justify-center shrink-0">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          <button onClick={onDec} className={qtyBtn} aria-label="Decrease quantity"><Minus className="h-5 w-5" strokeWidth={3} /></button>
          <span className="text-xl font-black w-10 text-center tabular-nums">{quantity}</span>
          <button onClick={onInc} className={qtyBtn} aria-label="Increase quantity"><Plus className="h-5 w-5" strokeWidth={3} /></button>
        </div>
        <p className="text-lg font-black tabular-nums">{formatCurrency(total, currency)}</p>
      </div>
    </motion.div>
  );
}

export function EmptyCart() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-10 text-center px-6">
      <div className="w-20 h-20 rounded-3xl bg-muted flex items-center justify-center mb-4">
        <ShoppingCart className="h-10 w-10 text-muted-foreground" />
      </div>
      <p className="text-xl font-extrabold text-foreground">Cart is empty</p>
      <p className="text-base font-medium text-muted-foreground mt-1">Tap a product or scan a barcode</p>
    </div>
  );
}

// ─── Totals ───────────────────────────────────────────────────────────────────

export function TotalsBlock({
  itemCount, subtotal, discountAmount = 0, discountLabel, taxAmount, total, currency,
}: {
  itemCount: number; subtotal: number; discountAmount?: number; discountLabel?: string;
  taxAmount: number; total: number; currency: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-base font-semibold text-muted-foreground">
        <span>Subtotal ({itemCount} item{itemCount !== 1 ? "s" : ""})</span>
        <span className="tabular-nums text-foreground">{formatCurrency(subtotal, currency)}</span>
      </div>
      {discountAmount > 0 && (
        <div className="flex justify-between text-base font-bold text-success">
          <span className="truncate">Discount{discountLabel ? ` (${discountLabel})` : ""}</span>
          <span className="tabular-nums">–{formatCurrency(discountAmount, currency)}</span>
        </div>
      )}
      <div className="flex justify-between text-base font-semibold text-muted-foreground">
        <span>Tax</span>
        <span className="tabular-nums text-foreground">{formatCurrency(taxAmount, currency)}</span>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-900 text-white px-4 py-3 mt-2 dark:bg-slate-800">
        <span className="text-lg font-extrabold uppercase tracking-wide">Total</span>
        <span className="text-3xl font-black tabular-nums truncate">{formatCurrency(total, currency)}</span>
      </div>
    </div>
  );
}

// ─── Payment ──────────────────────────────────────────────────────────────────

export function PaymentMethodGrid({
  methods, value, onChange,
}: {
  methods:  PaymentMethodDef[];
  value:    string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {methods.map(pm => {
        const Icon   = pm.icon;
        const active = value === pm.id;
        return (
          <button key={pm.id} onClick={() => onChange(pm.id)}
            className={cn(
              "h-14 flex items-center justify-center gap-2 px-3 rounded-xl border-2 text-base font-extrabold transition-all",
              active
                ? `${pm.bg} ${pm.color} border-current shadow-md`
                : "border-border bg-card text-foreground hover:border-primary"
            )}>
            {active ? <CheckCircle2 className="h-5 w-5 shrink-0" strokeWidth={2.5} /> : <Icon className="h-5 w-5 shrink-0" strokeWidth={2.5} />}
            <span className="truncate">{pm.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Rounded-up note amounts above the total, e.g. 1,240 → 1,300 / 1,500 / 2,000 / 5,000. */
export function quickCashAmounts(total: number): number[] {
  return [100, 500, 1000, 5000]
    .map(step => Math.ceil(total / step) * step)
    .filter((v, i, arr) => v > total && arr.indexOf(v) === i)
    .slice(0, 3);
}

/**
 * Cash received + change due. The amount field accepts keyboard input; the
 * on-screen numpad is shown only on tall screens so Pay stays visible on laptops.
 */
export function CashTender({
  total, currency, value, onChange,
}: {
  total: number; currency: string; value: string; onChange: (v: string) => void;
}) {
  const tendered = parseFloat(value) || 0;
  const change   = Math.max(0, tendered - total);
  const short    = !!value && tendered < total;
  const exact    = String(Math.round(total * 100) / 100);

  const handleKey = (k: string) => {
    if (k === "⌫") { onChange(value.slice(0, -1)); return; }
    if (value.length >= 9) return;
    onChange(value + k);
  };

  const quickBtn = (active: boolean) => cn(
    "h-12 rounded-xl border-2 text-base font-extrabold tabular-nums transition-colors",
    active ? "bg-success/15 border-success text-success" : "border-border bg-card hover:border-primary"
  );

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <label className="rounded-xl border-2 border-border bg-muted/40 px-3 py-2 focus-within:border-primary cursor-text">
          <span className="block text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Cash Received</span>
          <input
            value={value}
            inputMode="decimal"
            placeholder="0"
            onChange={e => onChange(e.target.value.replace(/[^\d.]/g, ""))}
            className={cn(
              "w-full bg-transparent outline-none text-2xl font-black tabular-nums placeholder:text-muted-foreground/50",
              short ? "text-destructive" : "text-foreground"
            )}
          />
        </label>
        <div className={cn(
          "rounded-xl border-2 px-3 py-2 min-w-0",
          value && !short ? "border-success bg-success/10" : short ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/40"
        )}>
          <p className={cn(
            "text-xs font-extrabold uppercase tracking-wide",
            short ? "text-destructive" : value ? "text-success" : "text-muted-foreground"
          )}>
            {short ? "Still Due" : "Change"}
          </p>
          <p className={cn(
            "text-2xl font-black tabular-nums truncate",
            short ? "text-destructive" : value ? "text-success" : "text-muted-foreground"
          )}>
            {value ? formatCurrency(short ? total - tendered : change, currency) : "—"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <button onClick={() => onChange(exact)} className={quickBtn(value === exact)}>Exact</button>
        {quickCashAmounts(total).map(v => (
          <button key={v} onClick={() => onChange(String(v))} className={quickBtn(String(v) === value)}>
            {v.toLocaleString("en")}
          </button>
        ))}
      </div>

      <div className="hidden [@media(min-height:900px)]:grid grid-cols-3 gap-2">
        {["1","2","3","4","5","6","7","8","9","00","0","⌫"].map(k => (
          <button key={k} onClick={() => handleKey(k)}
            className={cn(
              "h-12 rounded-xl text-xl font-black transition-all active:scale-95",
              k === "⌫" ? "bg-destructive/10 text-destructive hover:bg-destructive/20" : "bg-muted hover:bg-muted-foreground/15 text-foreground"
            )}>
            {k === "⌫" ? <Delete className="w-6 h-6 mx-auto" /> : k}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ChargeButton({
  total, currency, pending, disabled, onClick, className,
}: {
  total: number; currency: string; pending: boolean; disabled: boolean; onClick: () => void; className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || pending}
      className={cn(
        "w-full h-16 rounded-2xl flex items-center justify-center gap-3 px-4 text-xl font-black uppercase tracking-wide transition-all",
        disabled || pending
          ? "bg-muted text-muted-foreground cursor-not-allowed"
          : "bg-success text-white hover:brightness-110 active:scale-[0.98] shadow-lg shadow-success/30",
        className
      )}
    >
      {pending
        ? <><Loader2 className="h-6 w-6 animate-spin" /> Processing…</>
        : <><Receipt className="h-6 w-6 shrink-0" strokeWidth={2.5} /><span className="truncate">Pay {formatCurrency(total, currency)}</span><KeyHint>F9</KeyHint></>
      }
    </button>
  );
}

// ─── Top bar pieces ───────────────────────────────────────────────────────────

export const TOP_BAR = "flex items-center justify-between gap-3 px-5 h-[72px] bg-slate-900 text-white shrink-0";

export function TopBarBrand({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="h-11 w-11 rounded-xl bg-primary flex items-center justify-center shrink-0">
        <ShoppingCart className="h-6 w-6 text-primary-foreground" strokeWidth={2.5} />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-black leading-tight truncate">{title}</p>
        <p className="text-sm font-semibold text-slate-400 truncate">{subtitle}</p>
      </div>
    </div>
  );
}

/** Dark header button — large, high contrast. */
export function TopBarButton({
  icon: Icon, label, onClick, active, tone = "default", badge, title,
}: {
  icon: React.ElementType; label: string; onClick: () => void;
  active?: boolean; tone?: "default" | "danger"; badge?: number; title?: string;
}) {
  return (
    <button onClick={onClick} title={title ?? label}
      className={cn(
        "relative h-11 flex items-center gap-2 px-4 rounded-xl text-base font-bold whitespace-nowrap transition-colors",
        tone === "danger"
          ? "bg-red-500/20 text-red-200 hover:bg-red-500/30"
          : active
            ? "bg-white text-slate-900"
            : "bg-white/10 text-white hover:bg-white/20"
      )}>
      <Icon className="h-5 w-5 shrink-0" strokeWidth={2.5} />
      <span className="hidden md:inline">{label}</span>
      {!!badge && (
        <span className="min-w-[1.5rem] h-6 px-1.5 rounded-full bg-primary text-primary-foreground text-sm font-black flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  );
}

export function ShiftPill({ duration, extra }: { duration: string; extra?: string }) {
  return (
    <div className="hidden lg:flex items-center gap-2 h-11 px-4 rounded-xl bg-emerald-500/15 text-emerald-300 text-base font-bold whitespace-nowrap">
      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
      Shift open · {duration}
      {extra && <span className="text-emerald-200/90">· {extra}</span>}
    </div>
  );
}

export function LiveClock() {
  const fmt = () => new Date().toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", hour12: true });
  const [time, setTime] = React.useState(fmt);
  React.useEffect(() => {
    const t = setInterval(() => setTime(fmt()), 10_000);
    return () => clearInterval(t);
  }, []);
  return <span className="hidden xl:inline text-xl font-black tabular-nums text-white whitespace-nowrap">{time}</span>;
}
