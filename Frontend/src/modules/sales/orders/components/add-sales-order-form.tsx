"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";

const CURRENCIES       = ["AED", "USD", "EUR", "GBP", "SAR"];
const PAYMENT_TERMS    = ["Net 15", "Net 30", "Net 45", "Net 60", "Advance", "Cash on Delivery"];
const DELIVERY_OPTIONS = ["Ex-Works", "FOB", "CIF", "DDP", "Pick-Up", "Standard Delivery", "Express Delivery"];
const WAREHOUSES       = ["Dubai Main Warehouse", "Abu Dhabi Warehouse", "Sharjah Depot", "JBC Free Zone"];

interface OrderLine {
  id: string;
  sku: string;
  description: string;
  qty: number;
  unitPrice: number;
  discount: number;
}

function newLine(): OrderLine {
  return { id: String(Date.now() + Math.random()), sku: "", description: "", qty: 1, unitPrice: 0, discount: 0 };
}

interface AddSalesOrderFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddSalesOrderForm({ open, onClose }: AddSalesOrderFormProps) {
  const [customer, setCustomer]           = React.useState("");
  const [quotationRef, setQuotationRef]   = React.useState("");
  const [orderDate, setOrderDate]         = React.useState(new Date().toISOString().split("T")[0]);
  const [deliveryDate, setDeliveryDate]   = React.useState("");
  const [paymentTerms, setPaymentTerms]   = React.useState("Net 30");
  const [currency, setCurrency]           = React.useState("AED");
  const [deliveryMethod, setDeliveryMethod] = React.useState("Standard Delivery");
  const [warehouse, setWarehouse]         = React.useState("Dubai Main Warehouse");
  const [deliveryAddress, setDeliveryAddress] = React.useState("");
  const [vatRate]                         = React.useState(0.05);
  const [lines, setLines]                 = React.useState<OrderLine[]>([newLine(), newLine()]);
  const [notes, setNotes]                 = React.useState("");

  const lineSubtotal = (l: OrderLine) => l.qty * l.unitPrice * (1 - l.discount / 100);
  const subtotal  = lines.reduce((s, l) => s + lineSubtotal(l), 0);
  const vatAmount = subtotal * vatRate;
  const total     = subtotal + vatAmount;

  const updateLine = (id: string, key: keyof OrderLine, value: string | number) =>
    setLines(prev => prev.map(l => l.id === id ? { ...l, [key]: value } : l));

  const isValid = customer.trim() && orderDate && lines.some(l => l.qty > 0 && l.unitPrice > 0);

  const reset = () => {
    setCustomer(""); setQuotationRef(""); setOrderDate(new Date().toISOString().split("T")[0]);
    setDeliveryDate(""); setPaymentTerms("Net 30"); setCurrency("AED");
    setDeliveryMethod("Standard Delivery"); setWarehouse("Dubai Main Warehouse");
    setDeliveryAddress(""); setLines([newLine(), newLine()]); setNotes("");
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
            className="fixed right-0 top-0 h-full w-full max-w-3xl bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">New Sales Order</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Create a confirmed customer sales order</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Header fields */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer *</label>
                  <Input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Customer name…" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Currency</label>
                  <select value={currency} onChange={e => setCurrency(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Order Date *</label>
                  <Input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Delivery Date</label>
                  <Input type="date" value={deliveryDate} min={orderDate} onChange={e => setDeliveryDate(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment Terms</label>
                  <select value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quotation Ref.</label>
                  <Input value={quotationRef} onChange={e => setQuotationRef(e.target.value)} placeholder="QT-XXXXX" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Delivery Method</label>
                  <select value={deliveryMethod} onChange={e => setDeliveryMethod(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {DELIVERY_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dispatch Warehouse</label>
                  <select value={warehouse} onChange={e => setWarehouse(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {WAREHOUSES.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                </div>
                <div className="col-span-3 space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Delivery Address</label>
                  <Input value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} placeholder="Full delivery address…" className="h-9 text-sm" />
                </div>
              </div>

              {/* Order Lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Order Lines</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => setLines(p => [...p, newLine()])} className="h-7 text-xs gap-1">
                    <Plus className="w-3 h-3" /> Add Item
                  </Button>
                </div>
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30 border-b border-border">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground w-24">SKU</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Description</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-16">Qty</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-28">Unit Price</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-20">Disc%</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-28">Total</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {lines.map(line => (
                        <tr key={line.id} className="hover:bg-muted/10">
                          <td className="px-2 py-1.5">
                            <Input value={line.sku} onChange={e => updateLine(line.id, "sku", e.target.value)}
                              placeholder="SKU…" className="h-8 text-xs border-transparent bg-transparent focus-visible:border-primary/40 px-2" />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input value={line.description} onChange={e => updateLine(line.id, "description", e.target.value)}
                              placeholder="Item description…" className="h-8 text-xs border-transparent bg-transparent focus-visible:border-primary/40 px-2" />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input type="number" min={1} step={1} value={line.qty || ""} onChange={e => updateLine(line.id, "qty", +e.target.value)}
                              className="h-8 text-xs text-right border-transparent bg-transparent focus-visible:border-primary/40 px-2" />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input type="number" min={0} step={0.01} value={line.unitPrice || ""} onChange={e => updateLine(line.id, "unitPrice", +e.target.value)}
                              placeholder="0.00" className="h-8 text-xs text-right border-transparent bg-transparent focus-visible:border-primary/40 px-2" />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input type="number" min={0} max={100} step={1} value={line.discount || ""} onChange={e => updateLine(line.id, "discount", +e.target.value)}
                              placeholder="0" className="h-8 text-xs text-right border-transparent bg-transparent focus-visible:border-primary/40 px-2" />
                          </td>
                          <td className="px-3 py-1.5 text-right text-xs font-semibold text-foreground">
                            {formatCurrency(lineSubtotal(line), currency)}
                          </td>
                          <td className="px-2 py-1.5">
                            <button onClick={() => setLines(p => p.filter(l => l.id !== line.id))} disabled={lines.length <= 1}
                              className="p-1 rounded text-muted-foreground hover:text-destructive disabled:opacity-30">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/10 border-t border-border text-xs">
                      <tr><td colSpan={5} className="px-3 py-2 text-right text-muted-foreground font-medium">Subtotal</td><td className="px-3 py-2 text-right font-semibold">{formatCurrency(subtotal, currency)}</td><td /></tr>
                      <tr><td colSpan={5} className="px-3 py-2 text-right text-muted-foreground font-medium">VAT (5%)</td><td className="px-3 py-2 text-right font-semibold">{formatCurrency(vatAmount, currency)}</td><td /></tr>
                      <tr className="border-t border-border"><td colSpan={5} className="px-3 py-2 text-right font-bold text-foreground">Total</td><td className="px-3 py-2 text-right font-bold text-primary">{formatCurrency(total, currency)}</td><td /></tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Special instructions, packaging requirements…" rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose} disabled={!isValid}>Save as Draft</Button>
                <Button onClick={onClose} disabled={!isValid}>Confirm Order</Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
