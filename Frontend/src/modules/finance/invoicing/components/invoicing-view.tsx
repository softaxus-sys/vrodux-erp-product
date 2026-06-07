"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Download, FileText, Search, DollarSign, Clock,
  CheckCircle2, XCircle, Send, ChevronLeft, ChevronRight,
  X, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  useInvoices, useCreateInvoice, useMarkInvoicePaid, useCancelInvoice,
} from "@/hooks/finance/use-invoices";
import { useInvoice } from "@/hooks/finance/use-invoices";
import type { InvoiceSummaryDto, InvoiceDto } from "@/lib/finance/invoices.api";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  draft:     { label: "Draft",     color: "text-muted-foreground", bg: "bg-muted",           icon: FileText },
  sent:      { label: "Sent",      color: "text-primary",          bg: "bg-primary/10",      icon: Send },
  paid:      { label: "Paid",      color: "text-success",          bg: "bg-success/10",      icon: CheckCircle2 },
  overdue:   { label: "Overdue",   color: "text-destructive",      bg: "bg-destructive/10",  icon: Clock },
  cancelled: { label: "Cancelled", color: "text-muted-foreground", bg: "bg-muted",           icon: XCircle },
};

function InvoiceDetailDrawer({ invoiceId, onClose }: { invoiceId: string; onClose: () => void }) {
  const { data: inv, isLoading } = useInvoice(invoiceId);
  const markPaid = useMarkInvoicePaid();
  const cancel   = useCancelInvoice();

  if (isLoading || !inv) return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={onClose} />
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }}
        className="fixed top-0 right-0 h-full w-full max-w-2xl bg-card border-l border-border shadow-2xl z-50 flex items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </motion.div>
    </AnimatePresence>
  );

  const sc = STATUS_CONFIG[inv.status] ?? { label: inv.status, color: "text-foreground", bg: "bg-muted", icon: FileText };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={onClose} />
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 h-full w-full max-w-2xl bg-card border-l border-border shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Invoice Detail</p>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Invoice Header */}
          <div className="p-6 border-b border-border space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-muted-foreground">{inv.invoiceNumber}</p>
                <h2 className="text-xl font-bold mt-0.5">{inv.customerName}</h2>
                {inv.customerEmail && <p className="text-sm text-muted-foreground">{inv.customerEmail}</p>}
              </div>
              <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold", sc.color, sc.bg)}>
                <sc.icon className="h-3.5 w-3.5" />{sc.label}
              </span>
            </div>
            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              {(inv.status === "draft" || inv.status === "sent" || inv.status === "overdue") && (
                <Button size="sm" variant="outline" className="gap-2 text-success border-success/30 hover:bg-success/5"
                  disabled={markPaid.isPending}
                  onClick={() => { markPaid.mutate(inv.id); onClose(); }}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Mark as Paid
                </Button>
              )}
              {inv.status !== "cancelled" && inv.status !== "paid" && (
                <Button size="sm" variant="outline" className="gap-2 text-destructive border-destructive/30"
                  disabled={cancel.isPending}
                  onClick={() => { cancel.mutate(inv.id); onClose(); }}>
                  <XCircle className="h-3.5 w-3.5" /> Cancel
                </Button>
              )}
            </div>
          </div>

          {/* Meta */}
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {[
                { label: "Invoice Date", value: formatDate(inv.invoiceDate, "medium") },
                { label: "Due Date",     value: formatDate(inv.dueDate, "medium") },
                { label: "Tax Rate",     value: `${inv.taxRate}%` },
                ...(inv.paidAt ? [{ label: "Paid On", value: formatDate(inv.paidAt, "medium") }] : []),
              ].map(r => (
                <div key={r.label} className="flex justify-between items-center py-2 border-b border-border/40">
                  <span className="text-xs text-muted-foreground">{r.label}</span>
                  <span className="text-sm font-medium">{r.value}</span>
                </div>
              ))}
            </div>

            {/* Line Items */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Line Items</h3>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Description</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Qty</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Unit Price</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {inv.items.map(item => (
                      <tr key={item.id} className="hover:bg-muted/20">
                        <td className="px-4 py-3">{item.description}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{item.quantity}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(item.unitPrice, "AED")}</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatCurrency(item.lineTotal, "AED")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-56 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(inv.subTotal, "AED")}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tax ({inv.taxRate}%)</span><span>{formatCurrency(inv.taxAmount, "AED")}</span></div>
                <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
                  <span>Total</span><span>{formatCurrency(inv.total, "AED")}</span>
                </div>
              </div>
            </div>

            {inv.notes && (
              <div className="rounded-lg bg-muted/40 p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Notes</p>
                <p className="text-sm">{inv.notes}</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function CreateInvoiceDrawer({ onClose }: { onClose: () => void }) {
  const createInvoice = useCreateInvoice();
  const today = new Date().toISOString().split("T")[0];

  const [customerName, setCustomerName] = React.useState("");
  const [customerEmail, setCustomerEmail] = React.useState("");
  const [invoiceDate, setInvoiceDate] = React.useState(today);
  const [dueDate, setDueDate]         = React.useState("");
  const [taxRate, setTaxRate]         = React.useState(5);
  const [notes, setNotes]             = React.useState("");
  const [items, setItems]             = React.useState([{ id: "1", description: "", quantity: 1, unitPrice: 0 }]);

  const addItem = () => setItems(p => [...p, { id: String(Date.now()), description: "", quantity: 1, unitPrice: 0 }]);
  const removeItem = (id: string) => setItems(p => p.filter(i => i.id !== id));
  const updateItem = (id: string, field: string, value: string | number) =>
    setItems(p => p.map(i => i.id === id ? { ...i, [field]: value } : i));

  const subTotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const taxAmount = subTotal * taxRate / 100;
  const total = subTotal + taxAmount;

  const isValid = customerName.trim() && invoiceDate && dueDate && items.every(i => i.description.trim());

  const handleSubmit = async () => {
    if (!isValid) return;
    await createInvoice.mutateAsync({
      customerName,
      customerEmail: customerEmail || null,
      invoiceDate,
      dueDate,
      taxRate,
      notes: notes || null,
      items: items.map(i => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
    });
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={onClose} />
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 h-full w-full max-w-2xl bg-card border-l border-border shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">New Invoice</p>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Customer Name *</Label>
              <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer name" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Customer Email</Label>
              <Input type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="customer@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Invoice Date *</Label>
              <Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Due Date *</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Tax Rate (%)</Label>
              <Input type="number" min={0} max={100} value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value) || 0)} />
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
                  {items.map(item => (
                    <tr key={item.id}>
                      <td className="px-2 py-2">
                        <Input value={item.description} onChange={e => updateItem(item.id, "description", e.target.value)}
                          placeholder="Item description" className="h-8 text-xs border-0 bg-transparent focus-visible:ring-1 px-2" />
                      </td>
                      <td className="px-2 py-2">
                        <Input type="number" min={1} value={item.quantity} onChange={e => updateItem(item.id, "quantity", +e.target.value)}
                          className="h-8 text-xs text-right border-0 bg-transparent focus-visible:ring-1 px-2" />
                      </td>
                      <td className="px-2 py-2">
                        <Input type="number" min={0} value={item.unitPrice} onChange={e => updateItem(item.id, "unitPrice", +e.target.value)}
                          className="h-8 text-xs text-right border-0 bg-transparent focus-visible:ring-1 px-2" />
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
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(subTotal, "AED")}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tax ({taxRate}%)</span><span>{formatCurrency(taxAmount, "AED")}</span></div>
              <div className="flex justify-between font-bold pt-2 border-t border-border"><span>Total</span><span>{formatCurrency(total, "AED")}</span></div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Payment terms, special instructions…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
          </div>
        </div>
        <div className="p-4 border-t border-border flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!isValid || createInvoice.isPending}>
            {createInvoice.isPending ? "Creating…" : "Create Invoice"}
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export function InvoicingView() {
  const [search, setSearch]         = React.useState("");
  const [statusFilter, setStatus]   = React.useState<string>("all");
  const [page, setPage]             = React.useState(1);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [showCreate, setShowCreate] = React.useState(false);

  const { data, isLoading } = useInvoices({
    page, pageSize: 20,
    search: search || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const invoices   = data?.items      ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalCount = data?.totalCount ?? 0;

  const totalValue = invoices.reduce((s, i) => s + i.total, 0);
  const paidCount  = invoices.filter(i => i.status === "paid").length;
  const overdueCount = invoices.filter(i => i.status === "overdue").length;

  const STAT_CARDS = [
    { label: "Total (page)", value: invoices.length,                  icon: FileText,    color: "text-primary",     bg: "bg-primary/10" },
    { label: "Paid",         value: paidCount,                        icon: CheckCircle2, color: "text-success",    bg: "bg-success/10" },
    { label: "Overdue",      value: overdueCount,                     icon: Clock,       color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Page Value",   value: formatCurrency(totalValue, "AED"), icon: DollarSign, color: "text-primary",     bg: "bg-primary/10", isText: true },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Create and manage sales invoices.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-2"><Download className="h-4 w-4" /> Export</Button>
          <Button size="sm" className="gap-2" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> New Invoice</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STAT_CARDS.map((card, i) => (
          <motion.div key={card.label}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-card border border-border rounded-xl p-4 space-y-2">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", card.bg)}>
              <card.icon className={cn("h-4 w-4", card.color)} />
            </div>
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className={cn("text-base font-bold leading-tight", card.color)}>{card.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search invoices…" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9 h-9" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(["all", ...Object.keys(STATUS_CONFIG)] as const).map(s => (
            <button key={s} onClick={() => { setStatus(s); setPage(1); }}
              className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize",
                statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
              {s === "all" ? "All" : STATUS_CONFIG[s]?.label ?? s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/30 border-b border-border">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Invoice #</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Customer</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden md:table-cell">Date</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Due</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Total</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">Loading…</td></tr>
            ) : invoices.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">No invoices found.</td></tr>
            ) : invoices.map((inv: InvoiceSummaryDto) => {
              const sc = STATUS_CONFIG[inv.status] ?? { label: inv.status, color: "text-foreground", bg: "bg-muted", icon: FileText };
              return (
                <tr key={inv.id} onClick={() => setSelectedId(inv.id)}
                  className="border-b border-border/30 last:border-0 hover:bg-muted/20 cursor-pointer transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium">{inv.customerName}</p>
                    {inv.customerEmail && <p className="text-xs text-muted-foreground">{inv.customerEmail}</p>}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">{formatDate(inv.invoiceDate, "medium")}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground hidden lg:table-cell">{formatDate(inv.dueDate, "medium")}</td>
                  <td className="px-4 py-3 text-sm text-right font-semibold">{formatCurrency(inv.total, "AED")}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>
                      <sc.icon className="h-3 w-3" />{sc.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/10">
            <p className="text-xs text-muted-foreground">Page {page} of {totalPages} · {totalCount} total</p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {selectedId && <InvoiceDetailDrawer invoiceId={selectedId} onClose={() => setSelectedId(null)} />}
      {showCreate && <CreateInvoiceDrawer onClose={() => setShowCreate(false)} />}
    </div>
  );
}
