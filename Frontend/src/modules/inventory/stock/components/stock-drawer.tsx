"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Package, Tag, ShoppingCart, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import type { ProductSummaryDto } from "@/lib/pos/types";

interface StockDrawerProps {
  item: ProductSummaryDto | null;
  open: boolean;
  onClose: () => void;
}

function getStockColor(p: ProductSummaryDto) {
  if (p.stockQuantity <= 0) return "text-destructive";
  if (p.isLowStock) return "text-warning";
  return "text-success";
}

export function StockDrawer({ item, open, onClose }: StockDrawerProps) {
  if (!item) return null;

  const stockPct = item.reorderLevel > 0
    ? Math.min((item.stockQuantity / (item.reorderLevel * 4)) * 100, 100)
    : 50;

  const margin = item.costPrice > 0
    ? Math.round(((item.salePrice - item.costPrice) / item.salePrice) * 100)
    : null;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed top-0 right-0 h-full w-full max-w-[520px] bg-background border-l border-border shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-semibold leading-tight">{item.name}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    {item.sku && <span className="text-xs font-mono text-muted-foreground">{item.sku}</span>}
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{item.categoryName}</span>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">

              {/* Stock level */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Stock Levels</h3>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-muted/30 rounded-xl p-4 border border-border text-center">
                    <p className="text-xs text-muted-foreground mb-1">On Hand</p>
                    <p className={cn("text-2xl font-bold", getStockColor(item))}>{item.stockQuantity}</p>
                    <p className="text-xs text-muted-foreground">{item.unit}</p>
                  </div>
                  <div className="bg-muted/30 rounded-xl p-4 border border-border text-center">
                    <p className="text-xs text-muted-foreground mb-1">Reorder At</p>
                    <p className="text-2xl font-bold">{item.reorderLevel}</p>
                    <p className="text-xs text-muted-foreground">{item.unit}</p>
                  </div>
                </div>
                {/* Stock bar */}
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                    <span>Stock Level</span>
                    <span>{item.stockQuantity} / {item.reorderLevel * 4} {item.unit}</span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden relative">
                    <div
                      className={cn("h-full rounded-full transition-all",
                        item.stockQuantity <= 0 ? "bg-destructive" :
                        item.isLowStock ? "bg-warning" : "bg-success")}
                      style={{ width: `${Math.max(stockPct, 2)}%` }}
                    />
                    <div className="absolute top-0 bottom-0 w-0.5 bg-destructive/50" style={{ left: "25%" }} />
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Pricing</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-muted/30 rounded-xl p-3 border border-border">
                    <p className="text-xs text-muted-foreground">Sale Price</p>
                    <p className="text-sm font-bold mt-1">{formatCurrency(item.salePrice, "PKR")}</p>
                  </div>
                  <div className="bg-muted/30 rounded-xl p-3 border border-border">
                    <p className="text-xs text-muted-foreground">Cost Price</p>
                    <p className="text-sm font-bold mt-1 text-muted-foreground">{formatCurrency(item.costPrice, "PKR")}</p>
                  </div>
                  <div className="bg-muted/30 rounded-xl p-3 border border-border">
                    <p className="text-xs text-muted-foreground">Margin</p>
                    {margin !== null ? (
                      <p className={cn("text-sm font-bold mt-1",
                        margin >= 30 ? "text-success" : margin >= 15 ? "text-warning" : "text-destructive")}>
                        {margin}%
                      </p>
                    ) : (
                      <p className="text-sm font-bold mt-1 text-muted-foreground">—</p>
                    )}
                  </div>
                </div>
              </div>

              {/* POS / Barcode */}
              {(item.barcode || item.taxRate > 0) && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                    <ShoppingCart className="h-3.5 w-3.5 text-primary" />POS Details
                  </h3>
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
                    {item.barcode && (
                      <div className="flex items-center gap-2 text-sm">
                        <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-mono text-xs">{item.barcode}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground">Tax Rate: <span className="font-semibold text-foreground">{item.taxRate}%</span></span>
                    </div>
                  </div>
                </div>
              )}

              {/* Status */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Status</h3>
                <div className="flex items-center gap-2">
                  <span className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold",
                    item.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", item.isActive ? "bg-success" : "bg-muted-foreground")} />
                    {item.isActive ? "Active" : "Inactive"}
                  </span>
                  {item.isLowStock && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-warning/10 text-warning">
                      <span className="h-1.5 w-1.5 rounded-full bg-warning" />Low Stock
                    </span>
                  )}
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="p-6 border-t border-border shrink-0 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={onClose}>Close</Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
