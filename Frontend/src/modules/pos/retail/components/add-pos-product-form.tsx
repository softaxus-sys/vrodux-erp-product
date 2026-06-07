"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CATEGORIES = [
  { value: "beverages",    label: "🥤 Beverages" },
  { value: "snacks",       label: "🍫 Snacks" },
  { value: "electronics",  label: "🔌 Electronics" },
  { value: "accessories",  label: "🕶️ Accessories" },
  { value: "stationery",   label: "📝 Stationery" },
  { value: "personal_care",label: "🧴 Personal Care" },
  { value: "gifts",        label: "🎁 Gifts" },
  { value: "tobacco",      label: "🚬 Tobacco" },
];

const TAX_RATES = ["0", "5", "10", "15"];
const CURRENCIES = ["AED", "USD", "EUR"];

interface AddPOSProductFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddPOSProductForm({ open, onClose }: AddPOSProductFormProps) {
  const [category, setCategory]         = React.useState("beverages");
  const [name, setName]                 = React.useState("");
  const [sku, setSku]                   = React.useState("");
  const [barcode, setBarcode]           = React.useState("");
  const [description, setDescription]   = React.useState("");
  const [currency, setCurrency]         = React.useState("AED");
  const [price, setPrice]               = React.useState("");
  const [costPrice, setCostPrice]       = React.useState("");
  const [taxRate, setTaxRate]           = React.useState("5");
  const [stock, setStock]               = React.useState("0");
  const [minStock, setMinStock]         = React.useState("5");
  const [unit, setUnit]                 = React.useState("pcs");
  const [isActive, setIsActive]         = React.useState(true);

  const margin = React.useMemo(() => {
    const p = parseFloat(price) || 0;
    const c = parseFloat(costPrice) || 0;
    if (!p || !c) return null;
    return Math.round(((p - c) / p) * 100);
  }, [price, costPrice]);

  const isValid = name.trim() && sku.trim() && price;

  const reset = () => {
    setCategory("beverages"); setName(""); setSku(""); setBarcode(""); setDescription("");
    setCurrency("AED"); setPrice(""); setCostPrice(""); setTaxRate("5");
    setStock("0"); setMinStock("5"); setUnit("pcs"); setIsActive(true);
  };

  React.useEffect(() => { if (!open) reset(); }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="fixed right-0 top-0 h-full w-full max-w-lg bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">Add Product</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Add a new product to the POS catalogue</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Category</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {CATEGORIES.map(c => (
                    <button key={c.value} onClick={() => setCategory(c.value)}
                      className={`py-2 px-3 rounded-lg border-2 text-xs font-medium text-left transition-all ${
                        category === c.value ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                      }`}>{c.label}</button>
                  ))}
                </div>
              </div>

              {/* Product Info */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Product Information</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Product Name *</label>
                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="Product name…" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">SKU *</label>
                    <Input value={sku} onChange={e => setSku(e.target.value)} placeholder="SKU-XXXX" className="h-9 text-sm font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Barcode</label>
                    <Input value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="EAN / UPC…" className="h-9 text-sm font-mono" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Short product description…" rows={2}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Pricing</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Currency</label>
                    <select value={currency} onChange={e => setCurrency(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tax Rate (%)</label>
                    <div className="flex gap-1.5">
                      {TAX_RATES.map(r => (
                        <button key={r} onClick={() => setTaxRate(r)}
                          className={`flex-1 h-9 rounded-lg border-2 text-xs font-medium transition-all ${
                            taxRate === r ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                          }`}>{r}%</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Selling Price *</label>
                    <Input type="number" min={0} step={0.01} value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" className="h-9 text-sm text-right" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cost Price</label>
                    <Input type="number" min={0} step={0.01} value={costPrice} onChange={e => setCostPrice(e.target.value)} placeholder="0.00" className="h-9 text-sm text-right" />
                  </div>
                </div>
                {margin !== null && (
                  <div className="flex items-center justify-between mt-3 px-3 py-2 bg-success/5 border border-success/20 rounded-xl">
                    <span className="text-xs text-muted-foreground">Gross Margin</span>
                    <span className={`text-sm font-bold ${margin >= 30 ? "text-success" : margin >= 15 ? "text-warning" : "text-destructive"}`}>{margin}%</span>
                  </div>
                )}
              </div>

              {/* Inventory */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Inventory</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Opening Stock</label>
                    <Input type="number" min={0} value={stock} onChange={e => setStock(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Min. Stock</label>
                    <Input type="number" min={0} value={minStock} onChange={e => setMinStock(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Unit</label>
                    <Input value={unit} onChange={e => setUnit(e.target.value)} placeholder="pcs" className="h-9 text-sm" />
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between px-3 py-3 bg-muted/30 rounded-xl">
                <div>
                  <p className="text-xs font-semibold">Active in POS</p>
                  <p className="text-[11px] text-muted-foreground">Visible and selectable at checkout</p>
                </div>
                <button onClick={() => setIsActive(p => !p)}
                  className={`relative h-5 w-9 rounded-full transition-colors ${isActive ? "bg-primary" : "bg-muted"}`}>
                  <motion.span animate={{ x: isActive ? 16 : 2 }}
                    className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm" />
                </button>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={onClose} disabled={!isValid}>Add to Catalogue</Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
