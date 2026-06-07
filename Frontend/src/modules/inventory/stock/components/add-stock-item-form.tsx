"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inventoryProductsApi } from "@/lib/inventory/products.api";
import { inventoryCategoriesApi } from "@/lib/inventory/categories.api";
import { brandsApi } from "@/lib/inventory/brands.api";
import { uomApi } from "@/lib/inventory/uom.api";
import { inventoryCategoryKeys } from "@/hooks/inventory/use-inventory-categories";
import { brandKeys } from "@/hooks/inventory/use-brands";
import { uomKeys } from "@/hooks/inventory/use-uom";

// Cache key for the product list this form feeds into
const PRODUCT_LIST_KEY = ["inventory-products"];

interface AddStockItemFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddStockItemForm({ open, onClose }: AddStockItemFormProps) {
  const qc = useQueryClient();

  // ── Form state ──────────────────────────────────────────────────────────
  const [sku, setSku]                       = React.useState("");
  const [name, setName]                     = React.useState("");
  const [categoryId, setCategoryId]         = React.useState("");
  const [brandId, setBrandId]               = React.useState("");
  const [unitOfMeasureId, setUoMId]         = React.useState("");
  const [unit, setUnit]                     = React.useState("pcs");
  const [openingQty, setOpeningQty]         = React.useState("");
  const [reorderPoint, setReorderPoint]     = React.useState("");
  const [unitCost, setUnitCost]             = React.useState("");
  const [sellingPrice, setSellingPrice]     = React.useState("");
  const [barcode, setBarcode]               = React.useState("");
  const [description, setDescription]       = React.useState("");
  const [trackInventory, setTrackInventory] = React.useState(true);

  // ── Fetch master data ────────────────────────────────────────────────────
  const { data: categories = [] } = useQuery({
    queryKey: inventoryCategoryKeys.list({ isActive: true }),
    queryFn:  () => inventoryCategoriesApi.getAll({ isActive: true }),
    enabled:  open,
    staleTime: 60_000,
  });

  const { data: brands = [] } = useQuery({
    queryKey: brandKeys.list({ isActive: true }),
    queryFn:  () => brandsApi.getAll({ isActive: true }),
    enabled:  open,
    staleTime: 60_000,
  });

  const { data: uoms = [] } = useQuery({
    queryKey: uomKeys.list({ isActive: true }),
    queryFn:  () => uomApi.getAll({ isActive: true }),
    enabled:  open,
    staleTime: 60_000,
  });

  // ── Create mutation ──────────────────────────────────────────────────────
  const { mutate: createProduct, isPending } = useMutation({
    mutationFn: () =>
      inventoryProductsApi.create({
        name:           name.trim(),
        description:    description.trim() || null,
        sku:            sku.trim() || null,
        barcode:        barcode.trim() || null,
        categoryId,
        brandId:        brandId || null,
        unitOfMeasureId: unitOfMeasureId || null,
        salePrice:      parseFloat(sellingPrice) || 0,
        costPrice:      parseFloat(unitCost) || 0,
        taxRate:        0,
        unit,
        openingStock:   parseFloat(openingQty) || 0,
        reorderLevel:   parseFloat(reorderPoint) || 0,
        trackInventory,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PRODUCT_LIST_KEY });
      toast.success("Stock item created successfully.");
      handleClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const isValid = name.trim() && categoryId;

  const margin = React.useMemo(() => {
    const sp = parseFloat(sellingPrice) || 0;
    const uc = parseFloat(unitCost) || 0;
    if (!sp || !uc) return null;
    return Math.round(((sp - uc) / sp) * 100);
  }, [sellingPrice, unitCost]);

  const reset = () => {
    setSku(""); setName(""); setCategoryId(""); setBrandId(""); setUoMId("");
    setUnit("pcs"); setOpeningQty(""); setReorderPoint("");
    setUnitCost(""); setSellingPrice("");
    setBarcode(""); setDescription(""); setTrackInventory(true);
  };

  const handleClose = () => { reset(); onClose(); };

  React.useEffect(() => { if (!open) reset(); }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={handleClose}
          />
          <motion.div
            className="fixed right-0 top-0 h-full w-full max-w-xl bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">New Stock Item</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Add a new item to the inventory catalog</p>
              </div>
              <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Item Identity */}
              <section>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Item Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">SKU</label>
                    <Input value={sku} onChange={e => setSku(e.target.value.toUpperCase())} placeholder="ITM-001" className="h-9 text-sm font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Barcode</label>
                    <Input value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="Scan or enter…" className="h-9 text-sm" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Item Name *</label>
                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="Full item name…" className="h-9 text-sm" />
                  </div>

                  {/* Category */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Category *</label>
                    <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="">Select category…</option>
                      {categories.filter(c => !c.parentId).map(c => (
                        <React.Fragment key={c.id}>
                          <option value={c.id}>{c.name}</option>
                          {categories.filter(sub => sub.parentId === c.id).map(sub => (
                            <option key={sub.id} value={sub.id}>&nbsp;&nbsp;↳ {sub.name}</option>
                          ))}
                        </React.Fragment>
                      ))}
                    </select>
                  </div>

                  {/* Brand */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Brand</label>
                    <select value={brandId} onChange={e => setBrandId(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="">— None —</option>
                      {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>

                  {/* Unit of Measure */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Unit of Measure</label>
                    <select value={unitOfMeasureId} onChange={e => {
                        setUoMId(e.target.value);
                        // Auto-fill the unit symbol
                        const uom = uoms.find(u => u.id === e.target.value);
                        if (uom) setUnit(uom.symbol);
                      }}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="">— Select —</option>
                      {uoms.map(u => <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>)}
                    </select>
                  </div>

                  {/* Unit (text fallback) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Unit</label>
                    <Input value={unit} onChange={e => setUnit(e.target.value)} placeholder="pcs" className="h-9 text-sm font-mono" />
                  </div>

                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)}
                      placeholder="Product specifications, dimensions, notes…" rows={2}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    />
                  </div>
                </div>
              </section>

              {/* Stock Levels */}
              <section>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Stock Levels</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Opening Qty</label>
                    <Input type="number" min={0} step={1} value={openingQty} onChange={e => setOpeningQty(e.target.value)} placeholder="0" className="h-9 text-sm text-right" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reorder Point</label>
                    <Input type="number" min={0} step={1} value={reorderPoint} onChange={e => setReorderPoint(e.target.value)} placeholder="10" className="h-9 text-sm text-right" />
                  </div>
                  <div className="col-span-2 flex items-center justify-between px-3 py-3 bg-muted/30 rounded-xl border border-border">
                    <div>
                      <p className="text-xs font-semibold">Track Inventory</p>
                      <p className="text-[11px] text-muted-foreground">Monitor stock levels and trigger reorder alerts</p>
                    </div>
                    <button onClick={() => setTrackInventory(p => !p)}
                      className={`relative h-5 w-9 rounded-full transition-colors ${trackInventory ? "bg-primary" : "bg-muted"}`}>
                      <motion.span animate={{ x: trackInventory ? 16 : 2 }}
                        className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm" />
                    </button>
                  </div>
                </div>
              </section>

              {/* Pricing */}
              <section>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Pricing</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cost Price</label>
                    <Input type="number" min={0} step={0.01} value={unitCost} onChange={e => setUnitCost(e.target.value)} placeholder="0.00" className="h-9 text-sm text-right" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Selling Price</label>
                    <Input type="number" min={0} step={0.01} value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} placeholder="0.00" className="h-9 text-sm text-right" />
                  </div>
                  {margin !== null && (
                    <div className="col-span-2 flex items-center justify-between px-3 py-2 bg-success/5 border border-success/20 rounded-xl">
                      <span className="text-xs text-muted-foreground">Gross Margin</span>
                      <span className={`text-sm font-bold ${margin >= 30 ? "text-success" : margin >= 15 ? "text-warning" : "text-destructive"}`}>{margin}%</span>
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={handleClose} disabled={isPending}>Cancel</Button>
              <Button onClick={() => createProduct()} disabled={!isValid || isPending}>
                {isPending ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</> : "Save Item"}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
