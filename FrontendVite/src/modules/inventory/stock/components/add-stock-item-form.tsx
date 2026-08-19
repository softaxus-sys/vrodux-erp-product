import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Scan, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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
import { inventoryProductKeys, useInventoryProduct } from "@/hooks/inventory/use-inventory-products";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import { useBarcodeAutofill, AUTOFILL_SOURCE_LABELS } from "@/hooks/use-barcode-autofill";

interface AddStockItemFormProps {
  open: boolean;
  onClose: () => void;
  /** When set, the form opens in edit mode and updates this product. */
  editingId?: string | null;
}

export function AddStockItemForm({ open, onClose, editingId }: AddStockItemFormProps) {
  const { t } = useTranslation("inventory");
  const qc = useQueryClient();
  const isEdit = !!editingId;
  const { data: editingProduct } = useInventoryProduct(open && editingId ? editingId : "");

  // ── Form state ──────────────────────────────────────────────────────────────
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

  const barcodeInputRef = React.useRef<HTMLInputElement>(null);

  // ── Barcode autofill ─────────────────────────────────────────────────────────
  const autofill = useBarcodeAutofill();

  // Auto-populate form fields when autofill data arrives
  React.useEffect(() => {
    if (!autofill.data) return;
    setBarcode(autofill.data.barcode);
    if (autofill.data.name)        setName(autofill.data.name);
    if (autofill.data.description) setDescription(autofill.data.description);
    // If no SKU yet, derive one from barcode (uppercase, first 12 chars)
    if (!sku && autofill.data.barcode) {
      setSku(autofill.data.barcode.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 12));
    }
  }, [autofill.data]);

  // Prefill all fields when editing an existing product
  React.useEffect(() => {
    if (!open || !isEdit || !editingProduct) return;
    setSku(editingProduct.sku ?? "");
    setName(editingProduct.name);
    setCategoryId(editingProduct.categoryId);
    setBrandId(editingProduct.brandId ?? "");
    setUoMId(editingProduct.unitOfMeasureId ?? "");
    setUnit(editingProduct.unit);
    setReorderPoint(String(editingProduct.reorderLevel ?? ""));
    setUnitCost(String(editingProduct.costPrice ?? ""));
    setSellingPrice(String(editingProduct.salePrice ?? ""));
    setBarcode(editingProduct.barcode ?? "");
    setDescription(editingProduct.description ?? "");
    setTrackInventory(editingProduct.trackInventory);
  }, [open, isEdit, editingProduct]);

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

  // ── Fetch master data ────────────────────────────────────────────────────────
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

  // ── Create / Update mutation ─────────────────────────────────────────────────
  const { mutate: saveProduct, isPending } = useMutation({
    mutationFn: () => {
      const common = {
        name:            name.trim(),
        description:     description.trim() || null,
        sku:             sku.trim() || null,
        barcode:         barcode.trim() || null,
        categoryId,
        brandId:         brandId || null,
        unitOfMeasureId: unitOfMeasureId || null,
        salePrice:       parseFloat(sellingPrice) || 0,
        costPrice:       parseFloat(unitCost) || 0,
        taxRate:         0,
        unit,
        reorderLevel:    parseFloat(reorderPoint) || 0,
        trackInventory,
      };
      return isEdit && editingId
        ? inventoryProductsApi.update(editingId, common)
        : inventoryProductsApi.create({ ...common, openingStock: parseFloat(openingQty) || 0 });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryProductKeys.lists() });
      if (editingId) qc.invalidateQueries({ queryKey: inventoryProductKeys.detail(editingId) });
      toast.success(isEdit ? t("stockForm.toast.updated") : t("stockForm.toast.created"));
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
    autofill.clear();
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
                <h2 className="text-base font-bold text-foreground">{isEdit ? t("stockForm.editTitle") : t("stockForm.newTitle")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{isEdit ? t("stockForm.editSubtitle") : t("stockForm.newSubtitle")}</p>
              </div>
              <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Item Identity */}
              <section>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("stockForm.itemDetails")}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("stockForm.sku")}</label>
                    <Input value={sku} onChange={e => setSku(e.target.value.toUpperCase())} placeholder="ITM-001" className="h-9 text-sm font-mono" />
                  </div>

                  {/* ── Barcode with autofill ──────────────────────────────── */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("stockForm.barcode")}</label>
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
                        placeholder={t("stockForm.barcodePlaceholder")}
                        className="h-9 text-sm font-mono pr-8"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                        {autofill.status === "loading"
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                          : <Scan className="h-3.5 w-3.5 text-muted-foreground/60" />}
                      </span>
                    </div>
                  </div>

                  {/* Autofill status — spans full width below SKU + Barcode row */}
                  {autofill.status !== "idle" && (
                    <div className="col-span-2 -mt-1">
                      <InventoryBarcodeStatusBanner autofill={autofill} t={t} />
                    </div>
                  )}

                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("stockForm.itemName")}</label>
                    <Input value={name} onChange={e => setName(e.target.value)} placeholder={t("stockForm.itemNamePlaceholder")} className="h-9 text-sm" />
                  </div>

                  {/* Category */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("stockForm.category")}</label>
                    <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="">{t("stockForm.selectCategory")}</option>
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
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("stockForm.brand")}</label>
                    <select value={brandId} onChange={e => setBrandId(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="">{t("stockForm.none")}</option>
                      {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>

                  {/* Unit of Measure */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("stockForm.unitOfMeasure")}</label>
                    <select value={unitOfMeasureId} onChange={e => {
                        setUoMId(e.target.value);
                        const uom = uoms.find(u => u.id === e.target.value);
                        if (uom) setUnit(uom.symbol);
                      }}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="">{t("stockForm.select")}</option>
                      {uoms.map(u => <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>)}
                    </select>
                  </div>

                  {/* Unit (text fallback) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("stockForm.unit")}</label>
                    <Input value={unit} onChange={e => setUnit(e.target.value)} placeholder="pcs" className="h-9 text-sm font-mono" />
                  </div>

                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("stockForm.description")}</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)}
                      placeholder={t("stockForm.descriptionPlaceholder")} rows={2}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    />
                  </div>
                </div>
              </section>

              {/* Stock Levels */}
              <section>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("stockForm.stockLevels")}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("stockForm.openingQty")}</label>
                    <Input type="number" min={0} step={1} value={isEdit ? (editingProduct?.stockQuantity ?? "") : openingQty}
                      onChange={e => setOpeningQty(e.target.value)}
                      disabled={isEdit}
                      title={isEdit ? t("stockForm.openingQtyTitle") : undefined}
                      placeholder="0" className="h-9 text-sm text-right disabled:opacity-60" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("stockForm.reorderPoint")}</label>
                    <Input type="number" min={0} step={1} value={reorderPoint} onChange={e => setReorderPoint(e.target.value)} placeholder="10" className="h-9 text-sm text-right" />
                  </div>
                  <div className="col-span-2 flex items-center justify-between px-3 py-3 bg-muted/30 rounded-xl border border-border">
                    <div>
                      <p className="text-xs font-semibold">{t("stockForm.trackInventory")}</p>
                      <p className="text-[11px] text-muted-foreground">{t("stockForm.trackInventoryHint")}</p>
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
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("stockForm.pricing")}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("stockForm.costPrice")}</label>
                    <Input type="number" min={0} step={0.01} value={unitCost} onChange={e => setUnitCost(e.target.value)} placeholder="0.00" className="h-9 text-sm text-right" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("stockForm.sellingPrice")}</label>
                    <Input type="number" min={0} step={0.01} value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} placeholder="0.00" className="h-9 text-sm text-right" />
                  </div>
                  {margin !== null && (
                    <div className="col-span-2 flex items-center justify-between px-3 py-2 bg-success/5 border border-success/20 rounded-xl">
                      <span className="text-xs text-muted-foreground">{t("stockForm.grossMargin")}</span>
                      <span className={`text-sm font-bold ${margin >= 30 ? "text-success" : margin >= 15 ? "text-warning" : "text-destructive"}`}>{margin}%</span>
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={handleClose} disabled={isPending}>{t("stockForm.cancel")}</Button>
              <Button onClick={() => saveProduct()} disabled={!isValid || isPending}>
                {isPending ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />{t("stockForm.saving")}</> : (isEdit ? t("stockForm.saveChanges") : t("stockForm.saveItem"))}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Status banner ─────────────────────────────────────────────────────────────

function InventoryBarcodeStatusBanner({ autofill, t }: { autofill: ReturnType<typeof useBarcodeAutofill>; t: (k: string) => string }) {
  if (autofill.status === "loading") {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        {t("stockForm.banner.lookingUp")}
      </div>
    );
  }

  if (autofill.status === "found" && autofill.data) {
    const { data } = autofill;
    if (data.alreadyExists) {
      return (
        <div className="flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-snug">
            <span className="font-semibold">{t("stockForm.banner.alreadyInCatalogue")}</span> "{data.name}"
          </p>
        </div>
      );
    }
    return (
      <div className="flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3 shrink-0 mt-0.5" />
        <p className="text-[11px] leading-snug">
          <span className="font-semibold">{t("stockForm.banner.autoFilled")}</span> {t("stockForm.banner.from")} {AUTOFILL_SOURCE_LABELS[data.source]}
        </p>
      </div>
    );
  }

  if (autofill.status === "not-found") {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/60 border border-border text-muted-foreground">
        <Info className="h-3 w-3 shrink-0" />
        <p className="text-[11px]">{t("stockForm.banner.notFound")}</p>
      </div>
    );
  }

  return null;
}
