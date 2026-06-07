"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Scan, Search, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { inventoryProductsApi } from "@/lib/inventory/products.api";
import type { ProductSummaryDto } from "@/lib/inventory/types";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";

// ─── Config ───────────────────────────────────────────────────────────────────

const ADJUSTMENT_TYPES = [
  { value: "in",               label: "Receive In",       desc: "Stock received from supplier or return",    color: "border-success bg-success/5 text-success", sign: "+" },
  { value: "write_off",        label: "Write-Off",        desc: "Damaged, expired, or lost stock",           color: "border-destructive bg-destructive/5 text-destructive", sign: "–" },
  { value: "adjustment",       label: "Manual Adjust",    desc: "Correct quantity — increase or decrease",   color: "border-warning bg-warning/5 text-warning", sign: "±" },
  { value: "count_correction", label: "Count Correction", desc: "Physical count result differs from system", color: "border-primary bg-primary/5 text-primary", sign: "±" },
];

const WAREHOUSES = [
  "Dubai Main Warehouse",
  "Abu Dhabi Branch Warehouse",
  "Dubai POS Store",
  "Sharjah Depot",
];

const WRITE_OFF_REASONS = [
  "Damaged in transit",
  "Expired / past best-before",
  "Lost / theft",
  "Defective / non-functional",
  "Packaging compromised",
  "Other",
];

const ADJUST_REASONS = [
  "Physical count correction",
  "System discrepancy",
  "Return from customer",
  "Return to supplier",
  "Inter-department transfer",
  "Other",
];

// ─── Component ────────────────────────────────────────────────────────────────

interface AddAdjustmentFormProps {
  open: boolean;
  onClose: () => void;
  /** Pre-select an item (e.g. from stock view context menu) */
  preselectedItemId?: string;
}

export function AddAdjustmentForm({ open, onClose, preselectedItemId }: AddAdjustmentFormProps) {
  const { data: productsPage } = useQuery({
    queryKey: ["inventory-products", "list", {}],
    queryFn:  () => inventoryProductsApi.getAll({ pageSize: 200 }),
  });
  const stockItems: ProductSummaryDto[] = productsPage?.items ?? [];

  const [adjType, setAdjType]       = React.useState("in");
  const [itemSearch, setItemSearch] = React.useState("");
  const [selectedItem, setSelectedItem] = React.useState<ProductSummaryDto | null>(null);
  const [showItemList, setShowItemList] = React.useState(false);
  const [warehouse, setWarehouse]   = React.useState("Dubai Main Warehouse");
  const [quantity, setQuantity]     = React.useState("");
  const [direction, setDirection]   = React.useState<"+" | "-">("+");  // for manual adjust
  const [reason, setReason]         = React.useState("");
  const [reference, setReference]   = React.useState("");
  const [notes, setNotes]           = React.useState("");
  const [scanFeedback, setScanFeedback] = React.useState<"found" | "not_found" | null>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);

  // Pre-select item if provided
  React.useEffect(() => {
    if (preselectedItemId && stockItems.length > 0) {
      const item = stockItems.find(i => i.id === preselectedItemId);
      if (item) { setSelectedItem(item); }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedItemId, stockItems.length]);

  // Reset when closed
  React.useEffect(() => {
    if (!open) {
      setAdjType("in"); setItemSearch(""); setSelectedItem(null);
      setShowItemList(false); setWarehouse("Dubai Main Warehouse");
      setQuantity(""); setDirection("+"); setReason("");
      setReference(""); setNotes(""); setScanFeedback(null);
    }
  }, [open]);

  // Auto-generate reference number
  React.useEffect(() => {
    if (open && !reference) {
      const prefix = adjType === "in" ? "RCV" : adjType === "write_off" ? "WO" : "ADJ";
      setReference(`${prefix}-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`);
    }
  }, [open, adjType, reference]);

  // Barcode scanner — when form is open, scan to find item
  useBarcodeScanner({
    enabled: open,
    onScan: ({ barcode }) => {
      const item = stockItems.find(
        i => i.barcode === barcode || i.sku === barcode || i.id === barcode
      );
      if (item) {
        setSelectedItem(item);
        setItemSearch(item.name);
        setShowItemList(false);
        setScanFeedback("found");
      } else {
        setScanFeedback("not_found");
      }
      setTimeout(() => setScanFeedback(null), 2500);
    },
  });

  const filteredItems = React.useMemo(() => {
    if (!itemSearch.trim()) return stockItems.slice(0, 10);
    const s = itemSearch.toLowerCase();
    return stockItems.filter(i =>
      i.name.toLowerCase().includes(s) ||
      i.sku.toLowerCase().includes(s) ||
      (i.barcode && i.barcode.includes(s))
    ).slice(0, 8);
  }, [itemSearch]);

  const isValid = selectedItem && quantity && parseInt(quantity) > 0;
  const adjConfig = ADJUSTMENT_TYPES.find(t => t.value === adjType)!;
  const reasonOptions = adjType === "write_off" ? WRITE_OFF_REASONS : ADJUST_REASONS;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="fixed right-0 top-0 h-full w-full max-w-xl bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-bold">Record Stock Adjustment</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Scan barcode or search to select an item</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">

              {/* Scanner feedback banner */}
              <AnimatePresence>
                {scanFeedback && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className={cn("flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium",
                      scanFeedback === "found"
                        ? "bg-success/10 text-success border border-success/20"
                        : "bg-destructive/10 text-destructive border border-destructive/20")}>
                    {scanFeedback === "found"
                      ? <><CheckCircle2 className="h-4 w-4 shrink-0" />Item found — {selectedItem?.name}</>
                      : <><AlertCircle className="h-4 w-4 shrink-0" />Barcode not recognised</>
                    }
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Scanner indicator */}
              <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg">
                <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                <Scan className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs text-primary font-medium">Barcode scanner ready — scan any item to select it</span>
              </div>

              {/* Adjustment type */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Adjustment Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {ADJUSTMENT_TYPES.map(t => (
                    <button key={t.value} onClick={() => { setAdjType(t.value); setReason(""); }}
                      className={cn("px-3 py-3 rounded-xl border-2 text-left transition-all",
                        adjType === t.value ? t.color : "border-border hover:border-primary/30")}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold">{t.label}</span>
                        <span className={cn("text-base font-bold", adjType === t.value ? "" : "text-muted-foreground")}>{t.sign}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-tight">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Item search */}
              <div className="space-y-1.5 relative">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Item *</label>
                {selectedItem ? (
                  <div className="flex items-center gap-3 px-3 py-2.5 bg-primary/5 border-2 border-primary rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{selectedItem.name}</p>
                      <p className="text-xs font-mono text-muted-foreground">{selectedItem.sku} · {selectedItem.stockQuantity} available</p>
                    </div>
                    <button onClick={() => { setSelectedItem(null); setItemSearch(""); }} className="text-muted-foreground hover:text-destructive">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        ref={searchRef}
                        value={itemSearch}
                        onChange={e => { setItemSearch(e.target.value); setShowItemList(true); }}
                        onFocus={() => setShowItemList(true)}
                        placeholder="Search by name, SKU, or barcode…"
                        className="pl-9 h-9 text-sm"
                      />
                    </div>
                    <AnimatePresence>
                      {showItemList && filteredItems.length > 0 && (
                        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          className="absolute z-10 w-full mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
                          {filteredItems.map(item => (
                            <button key={item.id} onMouseDown={() => { setSelectedItem(item); setItemSearch(item.name); setShowItemList(false); }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 text-left border-b border-border/40 last:border-0">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{item.name}</p>
                                <p className="text-xs text-muted-foreground font-mono">{item.sku}</p>
                              </div>
                              <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium",
                                item.stockQuantity === 0 ? "bg-destructive/10 text-destructive" :
                                item.stockQuantity <= item.reorderLevel ? "bg-warning/10 text-warning" :
                                "bg-success/10 text-success")}>
                                {item.stockQuantity}
                              </span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </div>

              {/* Quantity & direction */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quantity *</label>
                  <Input type="number" min={1} value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0" className="h-9 text-sm text-right" />
                </div>
                {adjType === "adjustment" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Direction</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["+", "-"] as const).map(d => (
                        <button key={d} onClick={() => setDirection(d)}
                          className={cn("h-9 rounded-lg border-2 text-sm font-bold transition-all",
                            direction === d
                              ? d === "+" ? "border-success bg-success/10 text-success" : "border-destructive bg-destructive/10 text-destructive"
                              : "border-border text-muted-foreground hover:border-primary/30")}>
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reference #</label>
                  <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="ADJ-XXXX" className="h-9 text-sm font-mono" />
                </div>
              </div>

              {/* Warehouse */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Warehouse</label>
                <select value={warehouse} onChange={e => setWarehouse(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                  {WAREHOUSES.map(w => <option key={w}>{w}</option>)}
                </select>
              </div>

              {/* Reason */}
              {adjType !== "in" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reason *</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {reasonOptions.map(r => (
                      <button key={r} onClick={() => setReason(r)}
                        className={cn("py-2 px-3 rounded-lg border-2 text-xs font-medium text-left transition-all",
                          reason === r ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/30")}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Additional details, special circumstances…" rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={onClose} disabled={!isValid}>
                {adjConfig.sign} Record {adjConfig.label}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
