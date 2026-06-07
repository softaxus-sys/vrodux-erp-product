import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Scan, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { categoriesApi } from "@/lib/pos/categories.api";
import { useCreatePOSProduct } from "@/hooks/pos/use-products";
import type { ProductCategoryDto } from "@/lib/pos/types";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import { useBarcodeAutofill, AUTOFILL_SOURCE_LABELS } from "@/hooks/use-barcode-autofill";

const TAX_RATES = ["0", "5", "10", "15"];

interface AddPOSProductFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddPOSProductForm({ open, onClose }: AddPOSProductFormProps) {
  const [categoryId, setCategoryId]         = React.useState("");
  const [name, setName]                     = React.useState("");
  const [sku, setSku]                       = React.useState("");
  const [barcode, setBarcode]               = React.useState("");
  const [description, setDescription]       = React.useState("");
  const [price, setPrice]                   = React.useState("");
  const [costPrice, setCostPrice]           = React.useState("");
  const [taxRate, setTaxRate]               = React.useState("5");
  const [stock, setStock]                   = React.useState("0");
  const [minStock, setMinStock]             = React.useState("5");
  const [unit, setUnit]                     = React.useState("pcs");
  const [isActive, setIsActive]             = React.useState(true);

  const barcodeInputRef = React.useRef<HTMLInputElement>(null);

  // ── Barcode autofill ─────────────────────────────────────────────────────────
  const autofill = useBarcodeAutofill();

  // Auto-populate form when autofill data arrives
  React.useEffect(() => {
    if (!autofill.data) return;
    setBarcode(autofill.data.barcode);
    // Only fill name/description if they are empty, so manual entries are respected
    if (autofill.data.name)        setName(autofill.data.name);
    if (autofill.data.description) setDescription(autofill.data.description);
  }, [autofill.data]);

  // Auto-focus barcode field when form opens so scanner goes there immediately
  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => barcodeInputRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, [open]);

  // Global HID scanner — captureFromInputs:true intercepts scanner keystrokes even
  // when another input has focus, preventing barcode chars from polluting other fields.
  useBarcodeScanner({
    enabled:           open,
    captureFromInputs: true,
    barcodeInputRef,
    onScan: ({ barcode: scannedCode }) => {
      setBarcode(scannedCode);
      autofill.lookup(scannedCode);
      barcodeInputRef.current?.focus();
    },
  });

  // ── Real categories ──────────────────────────────────────────────────────────
  const { data: categoriesData, isLoading: catsLoading } = useQuery({
    queryKey: ["pos-categories"],
    queryFn:  () => categoriesApi.getAll({ pageSize: 200 }),
    staleTime: 5 * 60_000,
  });
  const categories: ProductCategoryDto[] = categoriesData?.items ?? [];

  React.useEffect(() => {
    if (categories.length > 0 && !categoryId) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  const createMutation = useCreatePOSProduct();

  const margin = React.useMemo(() => {
    const p = parseFloat(price) || 0;
    const c = parseFloat(costPrice) || 0;
    if (!p || !c) return null;
    return Math.round(((p - c) / p) * 100);
  }, [price, costPrice]);

  const isValid = name.trim() && sku.trim() && price && categoryId;

  const reset = () => {
    setName(""); setSku(""); setBarcode(""); setDescription("");
    setPrice(""); setCostPrice(""); setTaxRate("5");
    setStock("0"); setMinStock("5"); setUnit("pcs"); setIsActive(true);
    setCategoryId(categories[0]?.id ?? "");
    autofill.clear();
  };

  React.useEffect(() => { if (!open) reset(); }, [open]);

  const handleSubmit = async () => {
    if (!isValid) return;
    try {
      await createMutation.mutateAsync({
        name:          name.trim(),
        description:   description.trim() || null,
        sku:           sku.trim() || null,
        barcode:       barcode.trim() || null,
        categoryId,
        salePrice:     parseFloat(price),
        costPrice:     parseFloat(costPrice) || 0,
        taxRate:       parseFloat(taxRate),
        unit:          unit.trim() || "pcs",
        initialStock:  parseInt(stock, 10) || 0,
        reorderLevel:  parseInt(minStock, 10) || 5,
        trackInventory: true,
        imageUrl:      null,
      });
      onClose();
    } catch {
      // error shown via toast in mutation
    }
  };

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
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">

              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Category *</label>
                {catsLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />Loading categories…
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    {categories.map(c => (
                      <button key={c.id} onClick={() => setCategoryId(c.id)}
                        className={`py-2 px-3 rounded-lg border-2 text-xs font-medium text-left transition-all ${
                          categoryId === c.id
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/30"
                        }`}>
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
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

                  {/* ── Barcode with autofill ──────────────────────────────── */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Barcode</label>
                    <div className="relative">
                      <Input
                        ref={barcodeInputRef}
                        value={barcode}
                        onChange={e => { setBarcode(e.target.value); autofill.clear(); }}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const code = barcode.trim();
                            if (code) autofill.lookup(code);
                          }
                        }}
                        placeholder="Scan or type EAN/UPC…"
                        className="h-9 text-sm font-mono pr-8"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                        {autofill.status === "loading"
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                          : <Scan className="h-3.5 w-3.5 text-muted-foreground/60" />}
                      </span>
                    </div>

                    {/* Autofill status banner */}
                    <BarcodeStatusBanner autofill={autofill} />
                  </div>

                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)}
                      placeholder="Short product description…" rows={2}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Pricing</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tax Rate (%)</label>
                    <div className="flex gap-1.5">
                      {TAX_RATES.map(r => (
                        <button key={r} onClick={() => setTaxRate(r)}
                          className={`flex-1 h-9 rounded-lg border-2 text-xs font-medium transition-all ${
                            taxRate === r
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/30"
                          }`}>{r}%</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Unit</label>
                    <Input value={unit} onChange={e => setUnit(e.target.value)} placeholder="pcs" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Selling Price *</label>
                    <Input type="number" min={0} step={0.01} value={price} onChange={e => setPrice(e.target.value)}
                      placeholder="0.00" className="h-9 text-sm text-right" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cost Price</label>
                    <Input type="number" min={0} step={0.01} value={costPrice} onChange={e => setCostPrice(e.target.value)}
                      placeholder="0.00" className="h-9 text-sm text-right" />
                  </div>
                </div>
                {margin !== null && (
                  <div className="flex items-center justify-between mt-3 px-3 py-2 bg-success/5 border border-success/20 rounded-xl">
                    <span className="text-xs text-muted-foreground">Gross Margin</span>
                    <span className={`text-sm font-bold ${
                      margin >= 30 ? "text-success" : margin >= 15 ? "text-warning" : "text-destructive"
                    }`}>{margin}%</span>
                  </div>
                )}
              </div>

              {/* Inventory */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Inventory</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Opening Stock</label>
                    <Input type="number" min={0} value={stock} onChange={e => setStock(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reorder Level</label>
                    <Input type="number" min={0} value={minStock} onChange={e => setMinStock(e.target.value)} className="h-9 text-sm" />
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
              <Button variant="outline" onClick={onClose} disabled={createMutation.isPending}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!isValid || createMutation.isPending}>
                {createMutation.isPending
                  ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</>
                  : "Add to Catalogue"
                }
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Shared status banner ──────────────────────────────────────────────────────

function BarcodeStatusBanner({ autofill }: { autofill: ReturnType<typeof useBarcodeAutofill> }) {
  if (autofill.status === "idle" || autofill.status === "loading") {
    return (
      <p className="text-[10px] text-muted-foreground">
        Scan with a HID barcode scanner or type + press Enter to auto-fill.
      </p>
    );
  }

  if (autofill.status === "found" && autofill.data) {
    const { data } = autofill;
    if (data.alreadyExists) {
      return (
        <div className="flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-snug">
            <span className="font-semibold">Already in catalogue:</span> "{data.name}"
          </p>
        </div>
      );
    }
    return (
      <div className="flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3 shrink-0 mt-0.5" />
        <p className="text-[11px] leading-snug">
          <span className="font-semibold">Auto-filled</span> via {AUTOFILL_SOURCE_LABELS[data.source]}
        </p>
      </div>
    );
  }

  if (autofill.status === "not-found") {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/60 border border-border text-muted-foreground">
        <Info className="h-3 w-3 shrink-0" />
        <p className="text-[11px]">Not found in any database. Fill details manually.</p>
      </div>
    );
  }

  return null;
}
