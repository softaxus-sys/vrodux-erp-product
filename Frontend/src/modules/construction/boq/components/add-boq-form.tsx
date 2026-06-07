"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";

const UOM_OPTIONS = ["m²", "m³", "m", "nos", "kg", "ton", "ls", "hr", "day"];

interface BOQLine {
  id: string;
  itemCode: string;
  description: string;
  unit: string;
  quantity: string;
  unitRate: string;
}

interface AddBOQFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddBOQForm({ open, onClose }: AddBOQFormProps) {
  const [projectName, setProjectName]   = React.useState("");
  const [projectRef, setProjectRef]     = React.useState("");
  const [preparedBy, setPreparedBy]     = React.useState("");
  const [currency, setCurrency]         = React.useState("AED");
  const [vatRate, setVatRate]           = React.useState("5");
  const [lines, setLines]               = React.useState<BOQLine[]>([
    { id: "1", itemCode: "", description: "", unit: "m²", quantity: "", unitRate: "" },
  ]);
  const [notes, setNotes]               = React.useState("");

  const addLine = () =>
    setLines(prev => [...prev, { id: Date.now().toString(), itemCode: "", description: "", unit: "m²", quantity: "", unitRate: "" }]);
  const removeLine = (id: string) => setLines(prev => prev.filter(l => l.id !== id));
  const updateLine = (id: string, field: keyof BOQLine, value: string) =>
    setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));

  const subtotal = lines.reduce((sum, l) => {
    const qty = parseFloat(l.quantity) || 0;
    const rate = parseFloat(l.unitRate) || 0;
    return sum + qty * rate;
  }, 0);
  const vat = subtotal * ((parseFloat(vatRate) || 0) / 100);
  const total = subtotal + vat;

  const validLines = lines.filter(l => l.description.trim() && parseFloat(l.quantity) > 0 && parseFloat(l.unitRate) > 0);
  const isValid = projectName.trim() && validLines.length > 0;

  const reset = () => {
    setProjectName(""); setProjectRef(""); setPreparedBy(""); setCurrency("AED"); setVatRate("5");
    setLines([{ id: "1", itemCode: "", description: "", unit: "m²", quantity: "", unitRate: "" }]);
    setNotes("");
  };

  React.useEffect(() => { if (!open) reset(); }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="fixed right-0 top-0 h-full w-full max-w-3xl bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">New Bill of Quantities</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Create a BOQ for a construction project</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Header Info */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">BOQ Header</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Project Name *</label>
                    <Input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="Associated project name…" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Project Reference</label>
                    <Input value={projectRef} onChange={e => setProjectRef(e.target.value)} placeholder="PRJ-XXXX" className="h-9 text-sm font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Prepared By</label>
                    <Input value={preparedBy} onChange={e => setPreparedBy(e.target.value)} placeholder="Quantity surveyor…" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Currency</label>
                    <select value={currency} onChange={e => setCurrency(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {["AED", "USD", "EUR"].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">VAT Rate (%)</label>
                    <Input type="number" min={0} max={20} step={1} value={vatRate} onChange={e => setVatRate(e.target.value)} className="h-9 text-sm" />
                  </div>
                </div>
              </div>

              {/* BOQ Lines */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">BOQ Items *</label>
                  <button onClick={addLine} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium">
                    <Plus className="h-3.5 w-3.5" /> Add Item
                  </button>
                </div>
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40 border-b border-border">
                        <tr>
                          <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground w-24">Code</th>
                          <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground min-w-[200px]">Description</th>
                          <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground w-24">Unit</th>
                          <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground w-24">Qty</th>
                          <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground w-28">Rate</th>
                          <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground w-28">Amount</th>
                          <th className="w-8" />
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((line, i) => {
                          const qty = parseFloat(line.quantity) || 0;
                          const rate = parseFloat(line.unitRate) || 0;
                          const amount = qty * rate;
                          return (
                            <tr key={line.id} className="border-t border-border/40">
                              <td className="px-2 py-1.5">
                                <Input value={line.itemCode} onChange={e => updateLine(line.id, "itemCode", e.target.value)}
                                  placeholder="A.01" className="h-7 text-xs font-mono" />
                              </td>
                              <td className="px-2 py-1.5">
                                <Input value={line.description} onChange={e => updateLine(line.id, "description", e.target.value)}
                                  placeholder="Item description…" className="h-7 text-xs" />
                              </td>
                              <td className="px-2 py-1.5">
                                <select value={line.unit} onChange={e => updateLine(line.id, "unit", e.target.value)}
                                  className="w-full h-7 px-2 rounded border border-border bg-background text-xs focus:outline-none">
                                  {UOM_OPTIONS.map(u => <option key={u}>{u}</option>)}
                                </select>
                              </td>
                              <td className="px-2 py-1.5">
                                <Input type="number" min={0} value={line.quantity} onChange={e => updateLine(line.id, "quantity", e.target.value)}
                                  placeholder="0" className="h-7 text-xs text-right" />
                              </td>
                              <td className="px-2 py-1.5">
                                <Input type="number" min={0} step={0.01} value={line.unitRate} onChange={e => updateLine(line.id, "unitRate", e.target.value)}
                                  placeholder="0.00" className="h-7 text-xs text-right" />
                              </td>
                              <td className="px-3 py-1.5 text-right font-semibold text-foreground">
                                {amount > 0 ? formatCurrency(amount, currency) : <span className="text-muted-foreground font-normal">—</span>}
                              </td>
                              <td className="px-2 py-1.5">
                                {lines.length > 1 && (
                                  <button onClick={() => removeLine(line.id)} className="text-muted-foreground hover:text-destructive">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {subtotal > 0 && (
                        <tfoot className="border-t border-border bg-muted/20">
                          <tr>
                            <td colSpan={5} className="px-3 py-2 text-xs text-muted-foreground text-right">Subtotal</td>
                            <td className="px-3 py-2 text-right text-xs font-semibold">{formatCurrency(subtotal, currency)}</td>
                            <td />
                          </tr>
                          {parseFloat(vatRate) > 0 && (
                            <tr>
                              <td colSpan={5} className="px-3 py-2 text-xs text-muted-foreground text-right">VAT ({vatRate}%)</td>
                              <td className="px-3 py-2 text-right text-xs font-semibold text-warning">{formatCurrency(vat, currency)}</td>
                              <td />
                            </tr>
                          )}
                          <tr className="border-t border-border">
                            <td colSpan={5} className="px-3 py-2 text-xs font-bold text-right">Total BOQ Value</td>
                            <td className="px-3 py-2 text-right text-sm font-bold text-primary">{formatCurrency(total, currency)}</td>
                            <td />
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Scope exclusions, assumptions, revision notes…" rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose} disabled={!isValid}>Save as Draft</Button>
                <Button onClick={onClose} disabled={!isValid}>Create BOQ</Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
