"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";

const CURRENCIES    = ["AED", "USD", "EUR", "GBP", "SAR"];
const PAYMENT_TERMS = ["Net 15", "Net 30", "Net 45", "Net 60", "Advance", "Cash on Delivery"];
const VAT_OPTIONS   = [{ label: "Standard (5%)", rate: 0.05 }, { label: "Zero Rated (0%)", rate: 0 }, { label: "Exempt", rate: 0 }];

interface QuotationLine {
  id: string;
  description: string;
  qty: number;
  unitPrice: number;
  discount: number;
}

function newLine(): QuotationLine {
  return { id: String(Date.now() + Math.random()), description: "", qty: 1, unitPrice: 0, discount: 0 };
}

interface AddQuotationFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddQuotationForm({ open, onClose }: AddQuotationFormProps) {
  const [customer, setCustomer]         = React.useState("");
  const [contactEmail, setContactEmail] = React.useState("");
  const [validUntil, setValidUntil]     = React.useState("");
  const [paymentTerms, setPaymentTerms] = React.useState("Net 30");
  const [currency, setCurrency]         = React.useState("AED");
  const [vatRate, setVatRate]           = React.useState(0.05);
  const [reference, setReference]       = React.useState("");
  const [lines, setLines]               = React.useState<QuotationLine[]>([newLine(), newLine()]);
  const [notes, setNotes]               = React.useState("");

  const lineSubtotal = (l: QuotationLine) => l.qty * l.unitPrice * (1 - l.discount / 100);
  const subtotal = lines.reduce((s, l) => s + lineSubtotal(l), 0);
  const vatAmount = subtotal * vatRate;
  const total = subtotal + vatAmount;

  const updateLine = (id: string, key: keyof QuotationLine, value: string | number) =>
    setLines(prev => prev.map(l => l.id === id ? { ...l, [key]: value } : l));

  const isValid = customer.trim() && lines.some(l => l.description.trim() && l.qty > 0 && l.unitPrice > 0);

  const reset = () => {
    setCustomer(""); setContactEmail(""); setValidUntil(""); setPaymentTerms("Net 30");
    setCurrency("AED"); setVatRate(0.05); setReference(""); setLines([newLine(), newLine()]); setNotes("");
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
                <h2 className="text-base font-bold text-foreground">New Quotation</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Create a sales quotation for a customer</p>
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
                  <Input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Customer / Company name…" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Currency</label>
                  <select value={currency} onChange={e => setCurrency(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact Email</label>
                  <Input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="email@client.com" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valid Until</label>
                  <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment Terms</label>
                  <select value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">VAT</label>
                  <select value={vatRate} onChange={e => setVatRate(+e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {VAT_OPTIONS.map(v => <option key={v.label} value={v.rate}>{v.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reference</label>
                  <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="RFQ #, PO #…" className="h-9 text-sm" />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Line Items</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => setLines(p => [...p, newLine()])} className="h-7 text-xs gap-1">
                    <Plus className="w-3 h-3" /> Add Line
                  </Button>
                </div>
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30 border-b border-border">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Description</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-16">Qty</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-28">Unit Price</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-20">Disc %</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-28">Subtotal</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {lines.map(line => (
                        <tr key={line.id} className="hover:bg-muted/10">
                          <td className="px-2 py-1.5">
                            <Input value={line.description} onChange={e => updateLine(line.id, "description", e.target.value)}
                              placeholder="Product / service description…" className="h-8 text-xs border-transparent bg-transparent focus-visible:border-primary/40 px-2" />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input type="number" min={1} step={1} value={line.qty || ""} onChange={e => updateLine(line.id, "qty", +e.target.value)}
                              placeholder="1" className="h-8 text-xs text-right border-transparent bg-transparent focus-visible:border-primary/40 px-2" />
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
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-right text-muted-foreground font-medium">Subtotal</td>
                        <td className="px-3 py-2 text-right font-semibold text-foreground">{formatCurrency(subtotal, currency)}</td>
                        <td />
                      </tr>
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-right text-muted-foreground font-medium">VAT ({(vatRate * 100).toFixed(0)}%)</td>
                        <td className="px-3 py-2 text-right font-semibold text-foreground">{formatCurrency(vatAmount, currency)}</td>
                        <td />
                      </tr>
                      <tr className="border-t border-border">
                        <td colSpan={4} className="px-3 py-2 text-right font-bold text-foreground">Total</td>
                        <td className="px-3 py-2 text-right font-bold text-primary text-sm">{formatCurrency(total, currency)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Terms & Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Terms, delivery details, special conditions…" rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose} disabled={!isValid}>Save as Draft</Button>
                <Button onClick={onClose} disabled={!isValid}>Send to Customer</Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
