import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWarehouses } from "@/hooks/inventory/use-warehouses";
import { useInventoryProducts } from "@/hooks/inventory/use-inventory-products";
import { useCreateTransfer } from "@/hooks/inventory/use-transfers";
import { useAuthStore } from "@/store/auth.store";

const TRANSFER_TYPES = ["Internal Transfer", "Warehouse to Store", "Return to Supplier", "Stock Adjustment", "Inter-Branch"];

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
  const { data: warehouses = [] } = useWarehouses();
  const { data: productsPage } = useInventoryProducts({ pageSize: 200 });
  const products = productsPage?.items ?? [];
  const createTransfer = useCreateTransfer();
  const userName = useAuthStore(s => s.user)?.name ?? "System";

  const [transferType, setTransferType] = React.useState("Internal Transfer");
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
      notes:             [transferType, reference, notes].filter(Boolean).join(" · ") || null,
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
    setTransferType("Internal Transfer");
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
                <h2 className="text-base font-bold text-foreground">New Stock Transfer</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Move stock between warehouses or locations</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Transfer Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Transfer Type</label>
                <div className="flex gap-2 flex-wrap">
                  {TRANSFER_TYPES.map(t => (
                    <button key={t} onClick={() => setTransferType(t)}
                      className={`px-3 py-1.5 rounded-lg border-2 text-xs font-medium transition-all ${
                        transferType === t ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* From → To */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Transfer Route</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">From</label>
                    <select value={fromWarehouse} onChange={e => setFromWarehouse(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground mt-5 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">To</label>
                    <select value={toWarehouse} onChange={e => setToWarehouse(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {warehouses.filter(w => w.id !== fromWarehouse).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                </div>
                {fromWarehouse === toWarehouse && (
                  <p className="text-xs text-destructive mt-1.5">Source and destination cannot be the same.</p>
                )}
              </div>

              {/* Date & Reference */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Scheduled Date *</label>
                  <Input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reference</label>
                  <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="PO #, SO #, internal ref…" className="h-9 text-sm" />
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Transfer Items</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => setLines(p => [...p, newLine()])} className="h-7 text-xs gap-1">
                    <Plus className="w-3 h-3" /> Add Item
                  </Button>
                </div>
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30 border-b border-border">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Product</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground w-24">SKU</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-20">Qty</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-24">Unit Cost</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {lines.map(line => (
                        <tr key={line.id} className="hover:bg-muted/10">
                          <td className="px-2 py-1.5">
                            <select value={line.productId} onChange={e => selectProduct(line.id, e.target.value)}
                              className="w-full h-8 px-2 rounded-md border border-transparent bg-transparent text-xs focus:outline-none focus:border-primary/40 hover:border-border">
                              <option value="">Select product…</option>
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
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Reason for transfer, handling instructions…" rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose} disabled={createTransfer.isPending}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!isValid || createTransfer.isPending}>
                {createTransfer.isPending ? "Creating…" : "Create Transfer"}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

