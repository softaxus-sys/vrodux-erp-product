"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const WAREHOUSES     = ["Dubai Main Warehouse", "Abu Dhabi Warehouse", "Sharjah Depot", "JBC Free Zone", "Petty Cash – Dubai HQ"];
const TRANSFER_TYPES = ["Internal Transfer", "Warehouse to Store", "Return to Supplier", "Stock Adjustment", "Inter-Branch"];

interface TransferLine {
  id: string;
  itemCode: string;
  description: string;
  qty: number;
  uom: string;
}

function newLine(): TransferLine {
  return { id: String(Date.now() + Math.random()), itemCode: "", description: "", qty: 1, uom: "Pcs" };
}

interface AddTransferFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddTransferForm({ open, onClose }: AddTransferFormProps) {
  const [transferType, setTransferType] = React.useState("Internal Transfer");
  const [fromWarehouse, setFromWarehouse] = React.useState("Dubai Main Warehouse");
  const [toWarehouse, setToWarehouse]     = React.useState("Abu Dhabi Warehouse");
  const [scheduledDate, setScheduledDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [reference, setReference]         = React.useState("");
  const [lines, setLines]                 = React.useState<TransferLine[]>([newLine()]);
  const [notes, setNotes]                 = React.useState("");

  const updateLine = (id: string, key: keyof TransferLine, value: string | number) =>
    setLines(prev => prev.map(l => l.id === id ? { ...l, [key]: value } : l));

  const isValid = fromWarehouse !== toWarehouse && scheduledDate && lines.some(l => l.qty > 0 && (l.itemCode.trim() || l.description.trim()));

  const reset = () => {
    setTransferType("Internal Transfer");
    setFromWarehouse("Dubai Main Warehouse"); setToWarehouse("Abu Dhabi Warehouse");
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
                      {WAREHOUSES.map(w => <option key={w} value={w}>{w}</option>)}
                    </select>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground mt-5 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">To</label>
                    <select value={toWarehouse} onChange={e => setToWarehouse(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {WAREHOUSES.filter(w => w !== fromWarehouse).map(w => <option key={w} value={w}>{w}</option>)}
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
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground w-28">Item Code</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Description</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-20">Qty</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground w-16">UoM</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {lines.map(line => (
                        <tr key={line.id} className="hover:bg-muted/10">
                          <td className="px-2 py-1.5">
                            <Input value={line.itemCode} onChange={e => updateLine(line.id, "itemCode", e.target.value)}
                              placeholder="SKU…" className="h-8 text-xs border-transparent bg-transparent focus-visible:border-primary/40 px-2" />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input value={line.description} onChange={e => updateLine(line.id, "description", e.target.value)}
                              placeholder="Item name / description…" className="h-8 text-xs border-transparent bg-transparent focus-visible:border-primary/40 px-2" />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input type="number" min={1} step={1} value={line.qty || ""} onChange={e => updateLine(line.id, "qty", +e.target.value)}
                              className="h-8 text-xs text-right border-transparent bg-transparent focus-visible:border-primary/40 px-2" />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input value={line.uom} onChange={e => updateLine(line.id, "uom", e.target.value)}
                              placeholder="Pcs" className="h-8 text-xs border-transparent bg-transparent focus-visible:border-primary/40 px-2" />
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
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={onClose} disabled={!isValid}>Create Transfer</Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
