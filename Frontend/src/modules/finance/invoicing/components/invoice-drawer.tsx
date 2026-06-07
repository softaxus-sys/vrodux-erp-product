"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Printer, Send, Download, CheckCircle2,
  Building2, Calendar, Hash, CreditCard, FileText, Plus, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InvoiceDtoStatusBadge } from "./invoice-status-badge";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import type { InvoiceDtoDto } from "@/lib/finance/invoices.api";
import { toast } from "sonner";

interface InvoiceDtoDrawerProps {
  open: boolean;
  onClose: () => void;
  invoice: InvoiceDto | null;
  createMode: boolean;
}

function DetailRow({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex justify-between items-start gap-4 py-2 border-b border-border/50 last:border-0", className)}>
      <span className="text-xs text-muted-foreground shrink-0 w-32">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}

function ViewInvoiceDto({ invoice }: { invoice: InvoiceDto }) {
  const isDraft = invoice.status === "draft";
  const isOverdue = invoice.status === "overdue";

  return (
    <div className="flex flex-col h-full">
      {/* InvoiceDto Header */}
      <div className="p-6 border-b border-border space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-muted-foreground">{invoice.number}</p>
            <h2 className="text-xl font-bold mt-0.5">{invoice.customerName}</h2>
            <p className="text-sm text-muted-foreground">{invoice.customerEmail}</p>
          </div>
          <InvoiceDtoStatusBadge status={invoice.status} />
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          {isDraft && (
            <Button size="sm" className="gap-2" onClick={() => toast.success("InvoiceDto sent to customer!")}>
              <Send className="h-3.5 w-3.5" /> Send InvoiceDto
            </Button>
          )}
          {(invoice.status === "sent" || invoice.status === "partial" || isOverdue) && (
            <Button size="sm" variant="outline" className="gap-2 text-success border-success/30 hover:bg-success/5"
              onClick={() => toast.success("Payment recorded!")}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Record Payment
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-2">
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
          <Button size="sm" variant="outline" className="gap-2">
            <Download className="h-3.5 w-3.5" /> PDF
          </Button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Meta info */}
        <div className="grid grid-cols-2 gap-x-6">
          <div className="space-y-0">
            <DetailRow label="Issue Date" value={formatDate(invoice.issueDate, "medium")} />
            <DetailRow label="Due Date" value={
              <span className={isOverdue ? "text-destructive font-bold" : ""}>
                {formatDate(invoice.dueDate, "medium")}
                {isOverdue && " (Overdue)"}
              </span>
            } />
            {invoice.paidDate && (
              <DetailRow label="Paid On" value={formatDate(invoice.paidDate, "medium")} />
            )}
            <DetailRow label="Branch" value={invoice.branch} />
            <DetailRow label="Created By" value={invoice.createdBy} />
          </div>
          <div className="space-y-0">
            {invoice.reference && <DetailRow label="Reference" value={invoice.reference} />}
            {invoice.customerTrn && <DetailRow label="Customer TRN" value={invoice.customerTrn} />}
            {invoice.paymentMethod && (
              <DetailRow label="Payment Method" value={
                <span className="capitalize">{invoice.paymentMethod.replace("_", " ")}</span>
              } />
            )}
          </div>
        </div>

        {/* Line items */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Line Items</h3>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Description</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Qty</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Unit Price</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">VAT</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {invoice.items.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3">{item.description}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(item.unitPrice, "AED")}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{item.vatRate}%</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(item.total, "AED")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(invoice.subtotal, "AED")}</span>
            </div>
            {invoice.discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Discount</span>
                <span className="text-success">-{formatCurrency(invoice.discount, "AED")}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">VAT ({invoice.vatRate}%)</span>
              <span>{formatCurrency(invoice.vatAmount, "AED")}</span>
            </div>
            <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
              <span>Total</span>
              <span>{formatCurrency(invoice.total, "AED")}</span>
            </div>
            {invoice.paidAmount > 0 && (
              <>
                <div className="flex justify-between text-sm text-success">
                  <span>Paid</span>
                  <span>-{formatCurrency(invoice.paidAmount, "AED")}</span>
                </div>
                <div className="flex justify-between font-bold text-sm pt-1 border-t border-border">
                  <span>Balance Due</span>
                  <span className={invoice.balanceDue > 0 ? "text-warning" : "text-success"}>
                    {formatCurrency(invoice.balanceDue, "AED")}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="rounded-lg bg-muted/40 p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Notes</p>
            <p className="text-sm">{invoice.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CreateInvoiceDto({ onClose }: { onClose: () => void }) {
  const [items, setItems] = React.useState([
    { id: "1", description: "", quantity: 1, unitPrice: 0 }
  ]);

  const addItem = () => setItems((prev) => [...prev, { id: String(Date.now()), description: "", quantity: 1, unitPrice: 0 }]);
  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const vat = subtotal * 0.05;
  const total = subtotal + vat;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("InvoiceDto created successfully!");
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="p-6 border-b border-border">
        <h2 className="text-lg font-bold">New InvoiceDto</h2>
        <p className="text-sm text-muted-foreground">Create a new sales invoice</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Customer */}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label>Customer *</Label>
            <Input placeholder="Select or search customer..." required />
          </div>
          <div className="space-y-1.5">
            <Label>Issue Date *</Label>
            <Input type="date" defaultValue={new Date().toISOString().split("T")[0]} required />
          </div>
          <div className="space-y-1.5">
            <Label>Due Date *</Label>
            <Input type="date" required />
          </div>
          <div className="space-y-1.5">
            <Label>Reference / PO Number</Label>
            <Input placeholder="e.g. PO-2026-001" />
          </div>
          <div className="space-y-1.5">
            <Label>Branch</Label>
            <Input defaultValue="Dubai HQ" />
          </div>
        </div>

        {/* Line Items */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <Label className="text-sm font-semibold">Line Items</Label>
            <Button type="button" variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={addItem}>
              <Plus className="h-3 w-3" /> Add Item
            </Button>
          </div>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">Description</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground w-16">Qty</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground w-28">Unit Price</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground w-24">Total</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-2 py-2">
                      <Input
                        placeholder="Item description"
                        value={item.description}
                        onChange={(e) => setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, description: e.target.value } : i))}
                        className="h-8 text-xs border-0 bg-transparent focus-visible:ring-1 px-2"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, quantity: +e.target.value } : i))}
                        className="h-8 text-xs text-right border-0 bg-transparent focus-visible:ring-1 px-2"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        min={0}
                        value={item.unitPrice}
                        onChange={(e) => setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, unitPrice: +e.target.value } : i))}
                        className="h-8 text-xs text-right border-0 bg-transparent focus-visible:ring-1 px-2"
                      />
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">
                      {formatCurrency(item.quantity * item.unitPrice, "AED")}
                    </td>
                    <td className="px-2 py-2">
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => removeItem(item.id)} disabled={items.length === 1}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-56 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(subtotal, "AED")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">VAT (5%)</span>
              <span>{formatCurrency(vat, "AED")}</span>
            </div>
            <div className="flex justify-between font-bold pt-2 border-t border-border">
              <span>Total</span>
              <span>{formatCurrency(total, "AED")}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label>Notes</Label>
          <textarea
            placeholder="Payment terms, special instructions..."
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="outline">Save as Draft</Button>
        <Button type="submit">Save & Send</Button>
      </div>
    </form>
  );
}

export function InvoiceDtoDrawer({ open, onClose, invoice, createMode }: InvoiceDtoDrawerProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-2xl bg-card border-l border-border shadow-2xl z-50 flex flex-col"
          >
            {/* Drawer close */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                {createMode ? "New InvoiceDto" : "InvoiceDto Detail"}
              </p>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-hidden">
              {createMode ? (
                <CreateInvoiceDto onClose={onClose} />
              ) : invoice ? (
                <ViewInvoiceDto invoice={invoice} />
              ) : null}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
