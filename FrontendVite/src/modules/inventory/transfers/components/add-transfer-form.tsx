import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { X, Plus, Trash2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWarehouses } from "@/hooks/inventory/use-warehouses";
import { useInventoryProducts } from "@/hooks/inventory/use-inventory-products";
import { useCreateTransfer } from "@/hooks/inventory/use-transfers";
import { useAuthStore } from "@/store/auth.store";

const TRANSFER_TYPE_KEYS = ["internal", "warehouse_to_store", "return_supplier", "stock_adjustment", "inter_branch"];

interface TransferLine {
  id: string;
  productId: string;
  itemName: string;
  sku: string;
  qty: number;
  unitCost: number;
}

function newLine(): TransferLine {
  return { id: String(Date.now() + Math.random()), productId: "", itemName: "", sku: "", qty: 1, unitCost: 0 };
}

interface AddTransferFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddTransferForm({ open, onClose }: AddTransferFormProps) {
  const { t } = useTranslation("inventory");
  const { data: warehouses = [] } = useWarehouses();
  const { data: productsPage } = useInventoryProducts({ pageSize: 200 });
  const products = productsPage?.items ?? [];
  const createTransfer = useCreateTransfer();
  const userName = useAuthStore(s => s.user)?.name ?? "System";

  const [transferType, setTransferType] = React.useState("internal");
  const [fromWarehouse, setFromWarehouse] = React.useState("");
  const [toWarehouse, setToWarehouse]     = React.useState("");
  const [scheduledDate, setScheduledDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [reference, setReference]         = React.useState("");
  const [lines, setLines]                 = React.useState<TransferLine[]>([newLine()]);
  const [notes, setNotes]                 = React.useState("");

  // Default From/To from live warehouses once loaded
  React.useEffect(() => {
    if (open && warehouses.length > 0 && !fromWarehouse) {
      const def = warehouses.find(w => w.isDefault) ?? warehouses[0];
      setFromWarehouse(def.id);
      const other = warehouses.find(w => w.id !== def.id);
      if (other) setToWarehouse(other.id);
    }
  }, [open, warehouses, fromWarehouse]);

  const updateLine = (id: string, key: keyof TransferLine, value: string | number) =>
    setLines(prev => prev.map(l => l.id === id ? { ...l, [key]: value } : l));

  const selectProduct = (id: string, productId: string) => {
    const p = products.find(x => x.id === productId);
    setLines(prev => prev.map(l => l.id === id ? {
      ...l,
      productId,
      itemName: p?.name ?? "",
      sku:      p?.sku ?? "",
      unitCost: p?.costPrice ?? 0,
    } : l));
  };

  const validLines = lines.filter(l => l.productId && l.qty > 0);
  const isValid = !!fromWarehouse && !!toWarehouse && fromWarehouse !== toWarehouse && !!scheduledDate && validLines.length > 0;

  const handleCreate = () => {
    if (!isValid) return;
    const fromName = warehouses.find(w => w.id === fromWarehouse)?.name ?? "";
    const toName   = warehouses.find(w => w.id === toWarehouse)?.name ?? "";
    createTransfer.mutate({
      fromWarehouseId:   fromWarehouse,
      fromWarehouseName: fromName,
      toWarehouseId:     toWarehouse,
      toWarehouseName:   toName,
      requestedBy:       userName,
      expectedDate:      scheduledDate,
      notes:             [t(`transferForm.types.${transferType}`), reference, notes].filter(Boolean).join(" · ") || null,
      items: validLines.map(l => ({
        stockItemId: l.productId,
        itemName:    l.itemName,
        sku:         l.sku,
        quantity:    l.qty,
        unitCost:    l.unitCost,
      })),
    }, { onSuccess: () => onClose() });
  };

  const reset = () => {
    setTransferType("internal");
    setFromWarehouse(""); setToWarehouse("");
    setScheduledDate(new Date().toISOString().split("T")[0]); setReference("");
    setLines([newLine()]); setNotes("");
  };

  React.useEffect(() => { if (!open) reset(); }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed right-0 top-0 h-full w-full max-w-2xl bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">{t("transferForm.title")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{t("transferForm.subtitle")}</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Transfer Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("transferForm.transferType")}</label>
                <div className="flex gap-2 flex-wrap">
                  {TRANSFER_TYPE_KEYS.map(key => (
                    <button key={key} onClick={() => setTransferType(key)}
                      className={`px-3 py-1.5 rounded-lg border-2 text-xs font-medium transition-all ${
                        transferType === key ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                      }`}>
                      {t(`transferForm.types.${key}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* From → To */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("transferForm.transferRoute")}</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("transferForm.from")}</label>
                    <select value={fromWarehouse} onChange={e => setFromWarehouse(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground mt-5 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("transferForm.to")}</label>
                    <select value={toWarehouse} onChange={e => setToWarehouse(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {warehouses.filter(w => w.id !== fromWarehouse).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                </div>
                {fromWarehouse === toWarehouse && (
                  <p className="text-xs text-destructive mt-1.5">{t("transferForm.sameWarehouseError")}</p>
                )}
              </div>

              {/* Date & Reference */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("transferForm.scheduledDate")}</label>
                  <Input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("transferForm.reference")}</label>
                  <Input value={reference} onChange={e => setReference(e.target.value)} placeholder={t("transferForm.referencePlaceholder")} className="h-9 text-sm" />
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("transferForm.transferItems")}</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => setLines(p => [...p, newLine()])} className="h-7 text-xs gap-1">
                    <Plus className="w-3 h-3" /> {t("transferForm.addItem")}
                  </Button>
                </div>
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30 border-b border-border">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">{t("transferForm.colProduct")}</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground w-24">{t("transferForm.colSku")}</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-20">{t("transferForm.colQty")}</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-24">{t("transferForm.colUnitCost")}</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {lines.map(line => (
                        <tr key={line.id} className="hover:bg-muted/10">
                          <td className="px-2 py-1.5">
                            <select value={line.productId} onChange={e => selectProduct(line.id, e.target.value)}
                              className="w-full h-8 px-2 rounded-md border border-transparent bg-transparent text-xs focus:outline-none focus:border-primary/40 hover:border-border">
                              <option value="">{t("transferForm.selectProduct")}</option>
                              {products.map(p => (
                                <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ""}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-1.5 text-xs font-mono text-muted-foreground">{line.sku || "—"}</td>
                          <td className="px-2 py-1.5">
                            <Input type="number" min={1} step={1} value={line.qty || ""} onChange={e => updateLine(line.id, "qty", +e.target.value)}
                              className="h-8 text-xs text-right border-transparent bg-transparent focus-visible:border-primary/40 px-2" />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input type="number" min={0} step="0.01" value={line.unitCost || ""} onChange={e => updateLine(line.id, "unitCost", +e.target.value)}
                              className="h-8 text-xs text-right border-transparent bg-transparent focus-visible:border-primary/40 px-2" />
                          </td>
                          <td className="px-2 py-1.5">
                            <button onClick={() => setLines(p => p.filter(l => l.id !== line.id))} disabled={lines.length <= 1}
                              className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-30">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("transferForm.notes")}</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder={t("transferForm.notesPlaceholder")} rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose} disabled={createTransfer.isPending}>{t("transferForm.cancel")}</Button>
              <Button onClick={handleCreate} disabled={!isValid || createTransfer.isPending}>
                {createTransfer.isPending ? t("transferForm.creating") : t("transferForm.createTransfer")}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

