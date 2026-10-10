import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import {
  useBom, useBoms, useCreateProductionOrder, useStockWarehouses, useUpdateProductionOrder,
} from "@/hooks/manufacturing/use-manufacturing";
import { fmtQty, type ProductionOrderDto } from "@/lib/manufacturing/manufacturing.api";

interface Props {
  open: boolean;
  onClose: () => void;
  /** A planned order being re-planned. Its BOM cannot be changed. */
  editing?: ProductionOrderDto | null;
}

const num = (s: string) => { const n = parseFloat(s); return Number.isFinite(n) ? n : 0; };
const LABEL  = "text-xs font-semibold text-muted-foreground uppercase tracking-wide";
const SELECT = "w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60";

export function PlanOrderForm({ open, onClose, editing }: Props) {
  const { t } = useTranslation("manufacturing");
  const currency = useCurrency();
  const isEdit = !!editing;
  const { data: boms = [], isLoading: loadingBoms } = useBoms("active", open && !isEdit);
  const { data: warehouses = [] } = useStockWarehouses(open);
  const create = useCreateProductionOrder();
  const update = useUpdateProductionOrder();
  const saving = create.isPending || update.isPending;

  const [bomId, setBomId] = React.useState("");
  const [quantity, setQuantity] = React.useState("");
  const [warehouseId, setWarehouseId] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [reference, setReference] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [planSubs, setPlanSubs] = React.useState(true);

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      setBomId(editing.bomId); setQuantity(String(editing.plannedQuantity));
      setWarehouseId(editing.warehouseId ?? ""); setStartDate(editing.plannedStartDate ?? "");
      setDueDate(editing.dueDate ?? ""); setReference(editing.reference ?? ""); setNotes(editing.notes ?? "");
    } else {
      setBomId(""); setQuantity(""); setWarehouseId("");
      setStartDate(new Date().toISOString().split("T")[0]); setDueDate(""); setReference(""); setNotes("");
    }
  }, [open, editing]);

  // New order: start on the default warehouse once the list arrives.
  React.useEffect(() => {
    if (open && !editing && !warehouseId) {
      const def = warehouses.find(w => w.isDefault);
      if (def) setWarehouseId(def.id);
    }
  }, [open, editing, warehouses, warehouseId]);

  // The BOM's lines drive the materials preview (new orders only — an existing order keeps its own copy).
  const { data: bom } = useBom(open && !isEdit && bomId ? bomId : null);

  const pickBom = (id: string) => {
    setBomId(id);
    const picked = boms.find(b => b.id === id);
    if (picked && !quantity) setQuantity(String(picked.outputQuantity));
  };

  const qty = num(quantity);
  const preview = React.useMemo(() => {
    if (isEdit && editing) {
      const ratio = editing.plannedQuantity > 0 ? qty / editing.plannedQuantity : 0;
      return editing.components.map(c => ({
        id: c.id, name: c.name, unit: c.unit, required: c.requiredQuantity * ratio, cost: c.requiredQuantity * ratio * c.unitCost,
      }));
    }
    if (!bom || bom.outputQuantity <= 0) return [];
    const batches = qty / bom.outputQuantity;
    return bom.lines.map(l => ({
      id: l.id, name: l.componentName, unit: l.unit, required: l.effectiveQuantity * batches, cost: l.effectiveQuantity * batches * l.unitCost,
    }));
  }, [isEdit, editing, bom, qty]);
  const estimatedCost = preview.reduce((s, p) => s + p.cost, 0);

  const valid = !!bomId && qty > 0;

  const save = () => {
    if (!valid) return;
    const body = {
      bomId, plannedQuantity: qty, warehouseId: warehouseId || null,
      plannedStartDate: startDate || null, dueDate: dueDate || null,
      reference: reference.trim() || null, notes: notes.trim() || null,
      planSubAssemblies: !isEdit && planSubs,
    };
    if (isEdit && editing) update.mutate({ id: editing.id, body }, { onSuccess: onClose });
    else create.mutate(body, { onSuccess: onClose });
  };

  const unit = isEdit ? editing?.unit : bom?.unit;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div className="fixed end-0 top-0 h-full w-full max-w-lg bg-card border-s border-border z-[70] flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 280 }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-bold">{isEdit ? t("orderForm.titleEdit") : t("orderForm.titleNew")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{t("orderForm.subtitle")}</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground" aria-label={t("action.close")}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="space-y-1.5">
                <label className={LABEL}>{t("orderForm.bom")}</label>
                {isEdit ? (
                  <div className="h-9 px-3 rounded-lg border border-border bg-muted/30 text-sm flex items-center">
                    {editing?.productName} <span className="text-muted-foreground ms-1.5 text-xs">{editing?.bomNumber}</span>
                  </div>
                ) : (
                  <>
                    <select value={bomId} onChange={e => pickBom(e.target.value)} className={SELECT} disabled={loadingBoms}>
                      <option value="">{loadingBoms ? t("loading") : t("orderForm.bomPlaceholder")}</option>
                      {boms.map(b => <option key={b.id} value={b.id}>{b.productName} — {b.name}</option>)}
                    </select>
                    {!loadingBoms && boms.length === 0 && (
                      <p className="text-[11px] text-amber-600">{t("orderForm.noActiveBoms")}</p>
                    )}
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={LABEL}>{t("orderForm.quantity")}{unit ? ` (${unit})` : ""}</label>
                  <Input type="number" min={0} step="any" value={quantity} onChange={e => setQuantity(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className={LABEL}>{t("orderForm.warehouse")}</label>
                  <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)} className={SELECT}>
                    <option value="">{t("orderForm.noWarehouse")}</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className={LABEL}>{t("orderForm.startDate")}</label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className={LABEL}>{t("orderForm.dueDate")}</label>
                  <Input type="date" value={dueDate} min={startDate || undefined} onChange={e => setDueDate(e.target.value)} className="h-9 text-sm" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className={LABEL}>{t("orderForm.reference")}</label>
                <Input value={reference} onChange={e => setReference(e.target.value)} placeholder={t("orderForm.referencePlaceholder")} className="h-9 text-sm" />
              </div>

              <div className="space-y-1.5">
                <label className={LABEL}>{t("orderForm.notes")}</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>

              {!isEdit && (
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={planSubs} onChange={e => setPlanSubs(e.target.checked)} className="mt-0.5" />
                  <span>
                    {t("orderForm.planSubAssemblies")}
                    <span className="block text-[11px] text-muted-foreground">{t("orderForm.planSubAssembliesHint")}</span>
                  </span>
                </label>
              )}

              {preview.length > 0 && qty > 0 && (
                <div className="space-y-2">
                  <label className={LABEL}>{t("orderForm.materials")}</label>
                  <div className="rounded-lg border border-border divide-y divide-border">
                    {preview.map(p => (
                      <div key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <span className="truncate">{p.name}</span>
                        <span className="tabular-nums text-muted-foreground shrink-0 ms-3">{fmtQty(p.required)} {p.unit}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-3 py-2 text-sm bg-muted/30">
                      <span className="text-muted-foreground">{t("orderForm.estimatedCost")}</span>
                      <span className="font-semibold tabular-nums">{formatCurrency(estimatedCost, currency)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-border flex justify-between shrink-0">
              <Button variant="outline" onClick={onClose} disabled={saving}>{t("action.cancel")}</Button>
              <Button onClick={save} disabled={!valid || saving} className="gap-1.5">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {isEdit ? t("action.save") : t("orderForm.create")}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
