import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Printer, Send, Download, CheckCircle2,
  Plus, Trash2, Pencil, ArrowLeft, XCircle, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InvoiceStatusBadge } from "./invoice-status-badge";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { InvoiceQuotationsPanel } from "./invoice-quotations-panel";
import type { InvoiceDto as Invoice } from "@/lib/finance/finance.api";
import {
  useCreateInvoice, useUpdateInvoice,
  useSendInvoice, useMarkInvoicePaid, useCancelInvoice,
  useInvoiceById,
} from "@/hooks/finance/use-finance";
import { toast } from "sonner";
import { printInvoice } from "./invoice-print";
import { useCompanyName } from "@/hooks/use-company-name";

interface InvoiceDrawerProps {
  open: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  createMode: boolean;
}

const STATUS_OPTION_VALUES = ["draft", "sent", "partial", "overdue", "paid", "cancelled"] as const;

function DetailRow({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex justify-between items-start gap-4 py-2 border-b border-border/50 last:border-0", className)}>
      <span className="text-xs text-muted-foreground shrink-0 w-32">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}

/* ─── Edit Invoice ─────────────────────────────────────────────────────────── */

function EditInvoice({
  invoice,
  onClose,
  onCancel,
}: {
  invoice: Invoice;
  onClose: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation("finance");
  const currency = useCurrency();
  const { data: detail, isLoading } = useInvoiceById(invoice.id);
  const updateInvoice = useUpdateInvoice();

  const [customerName,  setCustomerName]  = React.useState(invoice.customerName);
  const [customerEmail, setCustomerEmail] = React.useState(invoice.customerEmail ?? "");
  const [invoiceDate,   setInvoiceDate]   = React.useState(invoice.invoiceDate);
  const [dueDate,       setDueDate]       = React.useState(invoice.dueDate);
  const [taxRate,       setTaxRate]       = React.useState(invoice.taxRate);
  const [notes,         setNotes]         = React.useState("");
  const [status,        setStatus]        = React.useState<string>(invoice.status);
  const [items, setItems] = React.useState([
    { id: "1", description: "", quantity: 1, unitPrice: 0 },
  ]);

  React.useEffect(() => {
    if (!detail) return;
    setNotes(detail.notes ?? "");
    setItems(
      detail.items.length > 0
        ? detail.items.map(i => ({
            id: i.id,
            description: i.description,
            quantity: Number(i.quantity),
            unitPrice: Number(i.unitPrice),
          }))
        : [{ id: "1", description: "", quantity: 1, unitPrice: 0 }]
    );
  }, [detail]);

  const addItem = () =>
    setItems(prev => [...prev, { id: String(Date.now()), description: "", quantity: 1, unitPrice: 0 }]);
  const removeItem = (id: string) =>
    setItems(prev => prev.filter(i => i.id !== id));

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const vat   = subtotal * (taxRate / 100);
  const total = subtotal + vat;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeItems = items.filter(i => i.description.trim() && i.quantity > 0);
    if (!activeItems.length) { toast.error(t("invoicing.drawer.form.atLeastOneItem")); return; }
    try {
      await updateInvoice.mutateAsync({
        id: invoice.id,
        data: {
          customerName:  customerName.trim(),
          customerEmail: customerEmail.trim() || undefined,
          invoiceDate,
          dueDate,
          taxRate,
          notes:   notes.trim() || undefined,
          status,
          items: activeItems.map(i => ({
            description: i.description.trim(),
            quantity:    i.quantity,
            unitPrice:   i.unitPrice,
          })),
        },
      });
      toast.success(t("invoicing.drawer.edit.updated"));
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("invoicing.drawer.edit.updateFailed"));
    }
  };

  const isPending = updateInvoice.isPending;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">{t("invoicing.drawer.edit.loading")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onCancel}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg font-bold">{t("invoicing.drawer.edit.title")}</h2>
            <p className="text-xs text-muted-foreground font-mono">{invoice.invoiceNumber}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Customer + dates + status */}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label>{t("invoicing.drawer.form.customerName")}</Label>
            <Input value={customerName} onChange={e => setCustomerName(e.target.value)}
              placeholder={t("invoicing.drawer.form.customerNamePh")} required />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>{t("invoicing.drawer.form.customerEmail")}</Label>
            <Input type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)}
              placeholder={t("invoicing.drawer.form.customerEmailPh")} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("invoicing.drawer.form.invoiceDate")}</Label>
            <Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>{t("invoicing.drawer.form.dueDate")}</Label>
            <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>{t("invoicing.drawer.form.taxRate")}</Label>
            <Input type="number" min={0} max={100} step={0.01} value={taxRate}
              onChange={e => setTaxRate(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("invoicing.drawer.form.status")}</Label>
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              {STATUS_OPTION_VALUES.map(value => (
                <option key={value} value={value}>{t(`invoicing.status.${value}`)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Line Items */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <Label className="text-sm font-semibold">{t("invoicing.drawer.form.lineItems")}</Label>
            <Button type="button" variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={addItem}>
              <Plus className="h-3 w-3" /> {t("invoicing.drawer.form.addItem")}
            </Button>
          </div>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">{t("invoicing.drawer.form.description")}</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground w-16">{t("invoicing.drawer.form.qty")}</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground w-28">{t("invoicing.drawer.form.unitPrice")}</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground w-24">{t("invoicing.drawer.form.total")}</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-2 py-2">
                      <Input placeholder={t("invoicing.drawer.form.descriptionPh")} value={item.description}
                        onChange={(e) => setItems(prev => prev.map(i => i.id === item.id ? { ...i, description: e.target.value } : i))}
                        className="h-8 text-xs border-0 bg-transparent focus-visible:ring-1 px-2" />
                    </td>
                    <td className="px-2 py-2">
                      <Input type="number" min={1} value={item.quantity}
                        onChange={(e) => setItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: +e.target.value } : i))}
                        className="h-8 text-xs text-right border-0 bg-transparent focus-visible:ring-1 px-2" />
                    </td>
                    <td className="px-2 py-2">
                      <Input type="number" min={0} step={0.01} value={item.unitPrice}
                        onChange={(e) => setItems(prev => prev.map(i => i.id === item.id ? { ...i, unitPrice: +e.target.value } : i))}
                        className="h-8 text-xs text-right border-0 bg-transparent focus-visible:ring-1 px-2" />
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">
                      {formatCurrency(item.quantity * item.unitPrice, currency)}
                    </td>
                    <td className="px-2 py-2">
                      <Button type="button" variant="ghost" size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
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
              <span className="text-muted-foreground">{t("invoicing.drawer.form.subtotal")}</span>
              <span>{formatCurrency(subtotal, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("invoicing.drawer.form.taxPct", { rate: taxRate })}</span>
              <span>{formatCurrency(vat, currency)}</span>
            </div>
            <div className="flex justify-between font-bold pt-2 border-t border-border">
              <span>{t("invoicing.drawer.form.total")}</span>
              <span>{formatCurrency(total, currency)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label>{t("invoicing.drawer.form.notes")}</Label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder={t("invoicing.drawer.form.notesPh")}
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border flex gap-2 justify-between">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> {t("invoicing.drawer.edit.back")}
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>{t("common:action.cancel")}</Button>
          <Button type="submit" disabled={isPending || !customerName.trim() || !invoiceDate || !dueDate}>
            {isPending ? t("common:action.saving") : t("invoicing.drawer.edit.saveChanges")}
          </Button>
        </div>
      </div>
    </form>
  );
}

/* ─── View Invoice ─────────────────────────────────────────────────────────── */

function ViewInvoice({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const { t } = useTranslation("finance");
  const currency = useCurrency();
  const [editMode, setEditMode] = React.useState(false);
  const [confirmCancel, setConfirmCancel] = React.useState(false);

  const sendInvoice   = useSendInvoice();
  const markPaid      = useMarkInvoicePaid();
  const cancelInvoice = useCancelInvoice();
  const { data: detail } = useInvoiceById(invoice.id);

  // The legal name from Settings → General, falling back to the workspace name.
  const companyName = useCompanyName();

  const handlePrint = () => {
    if (!detail) { toast.error(t("invoicing.drawer.view.printLoading")); return; }
    printInvoice(detail, companyName);
  };

  if (editMode) {
    return <EditInvoice invoice={invoice} onClose={onClose} onCancel={() => setEditMode(false)} />;
  }

  const isDraft  = invoice.status === "draft";
  const isOverdue = invoice.status === "overdue";
  const canPay  = ["sent", "partial", "overdue"].includes(invoice.status);
  const canEdit = !["paid", "cancelled"].includes(invoice.status);

  const handleSend = async () => {
    try {
      await sendInvoice.mutateAsync(invoice.id);
      toast.success(t("invoicing.drawer.view.sent"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("invoicing.drawer.view.sendFailed"));
    }
  };

  const handlePay = async () => {
    try {
      await markPaid.mutateAsync(invoice.id);
      toast.success(t("invoicing.drawer.view.paid"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("invoicing.drawer.view.payFailed"));
    }
  };

  const handleCancel = () => setConfirmCancel(true);

  const doCancel = async () => {
    setConfirmCancel(false);
    try {
      await cancelInvoice.mutateAsync(invoice.id);
      toast.success(t("invoicing.drawer.view.cancelled"));
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("invoicing.drawer.view.cancelFailed"));
    }
  };

  const isPending = sendInvoice.isPending || markPaid.isPending || cancelInvoice.isPending;

  return (
    <div className="flex flex-col h-full">
      {/* Invoice Header */}
      <div className="p-6 border-b border-border space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-muted-foreground">{invoice.invoiceNumber}</p>
            <h2 className="text-xl font-bold mt-0.5">{invoice.customerName}</h2>
            <p className="text-sm text-muted-foreground">{invoice.customerEmail}</p>
          </div>
          <InvoiceStatusBadge status={invoice.status} />
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          {isDraft && (
            <Button size="sm" className="gap-2" onClick={handleSend} disabled={isPending}>
              <Send className="h-3.5 w-3.5" />
              {sendInvoice.isPending ? t("common:action.sending") : t("invoicing.drawer.view.sendInvoice")}
            </Button>
          )}
          {canPay && (
            <Button size="sm" variant="outline"
              className="gap-2 text-success border-success/30 hover:bg-success/5"
              onClick={handlePay} disabled={isPending}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              {markPaid.isPending ? t("invoicing.drawer.view.recording") : t("invoicing.drawer.view.recordPayment")}
            </Button>
          )}
          {canEdit && (
            <Button size="sm" variant="outline" className="gap-2"
              onClick={() => setEditMode(true)} disabled={isPending}>
              <Pencil className="h-3.5 w-3.5" /> {t("invoicing.drawer.view.edit")}
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-2" onClick={handlePrint} disabled={!detail}>
            <Printer className="h-3.5 w-3.5" /> {t("invoicing.drawer.view.print")}
          </Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={handlePrint} disabled={!detail}>
            <Download className="h-3.5 w-3.5" /> {t("invoicing.drawer.view.pdf")}
          </Button>
          {isDraft && (
            <Button size="sm" variant="ghost"
              className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/5"
              onClick={handleCancel} disabled={isPending}>
              <XCircle className="h-3.5 w-3.5" />
              {cancelInvoice.isPending ? t("invoicing.drawer.view.cancelling") : t("invoicing.drawer.view.cancelInvoice")}
            </Button>
          )}
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Meta info */}
        <div className="space-y-0">
          <DetailRow label={t("invoicing.drawer.view.invoiceDate")} value={formatDate(invoice.invoiceDate, "medium")} />
          <DetailRow label={t("invoicing.drawer.view.dueDate")} value={
            <span className={isOverdue ? "text-destructive font-bold" : ""}>
              {formatDate(invoice.dueDate, "medium")}
              {isOverdue && t("invoicing.drawer.view.overdueSuffix")}
            </span>
          } />
          {invoice.paidAt && (
            <DetailRow label={t("invoicing.drawer.view.paidOn")} value={formatDate(invoice.paidAt, "medium")} />
          )}
          <DetailRow label={t("invoicing.drawer.view.created")} value={formatDate(invoice.createdAt, "medium")} />
          <DetailRow label={t("invoicing.drawer.view.items")} value={t("invoicing.drawer.view.itemsCount", { count: invoice.itemCount })} />
        </div>

        {/* Totals */}
        <div>
          <h3 className="text-sm font-semibold mb-3">{t("invoicing.drawer.view.amountBreakdown")}</h3>
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("invoicing.drawer.view.subtotal")}</span>
                <span>{formatCurrency(invoice.subTotal, currency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("invoicing.drawer.form.taxPct", { rate: invoice.taxRate })}</span>
                <span>{formatCurrency(invoice.taxAmount, currency)}</span>
              </div>
              <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
                <span>{t("invoicing.drawer.form.total")}</span>
                <span>{formatCurrency(invoice.total, currency)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quotations this invoice was raised from. Renders nothing for tenants without Sales. */}
        <InvoiceQuotationsPanel invoiceId={invoice.id} invoiceNumber={invoice.invoiceNumber} />
      </div>

      {/* Cancel confirmation modal */}
      {confirmCancel && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-none">
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="font-semibold text-sm">{t("invoicing.drawer.view.cancelConfirmTitle")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("invoicing.drawer.view.cancelConfirmBody", { number: invoice.invoiceNumber })}
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmCancel(false)}>{t("invoicing.drawer.view.keep")}</Button>
              <Button variant="destructive" size="sm" onClick={doCancel} disabled={cancelInvoice.isPending}>
                {cancelInvoice.isPending ? t("invoicing.drawer.view.cancelling") : t("invoicing.drawer.view.cancelInvoice")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Create Invoice ───────────────────────────────────────────────────────── */

function CreateInvoice({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("finance");
  const currency = useCurrency();
  const createInvoice = useCreateInvoice();

  const [customerName,  setCustomerName]  = React.useState("");
  const [customerEmail, setCustomerEmail] = React.useState("");
  const [invoiceDate,   setInvoiceDate]   = React.useState(new Date().toISOString().split("T")[0]);
  const [dueDate,       setDueDate]       = React.useState("");
  const [taxRate]                         = React.useState(5);
  const [notes,         setNotes]         = React.useState("");
  const [items, setItems] = React.useState([
    { id: "1", description: "", quantity: 1, unitPrice: 0 }
  ]);

  const addItem    = () => setItems((prev) => [...prev, { id: String(Date.now()), description: "", quantity: 1, unitPrice: 0 }]);
  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const vat   = subtotal * (taxRate / 100);
  const total = subtotal + vat;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !invoiceDate || !dueDate) return;
    const activeItems = items.filter(i => i.description.trim() && i.quantity > 0 && i.unitPrice > 0);
    if (activeItems.length === 0) { toast.error(t("invoicing.drawer.form.atLeastOneItem")); return; }

    try {
      await createInvoice.mutateAsync({
        customerName:  customerName.trim(),
        customerEmail: customerEmail.trim() || undefined,
        invoiceDate,
        dueDate,
        taxRate,
        notes: notes.trim() || undefined,
        items: activeItems.map(i => ({
          description: i.description.trim(),
          quantity:    i.quantity,
          unitPrice:   i.unitPrice,
        })),
      });
      toast.success(t("invoicing.drawer.create.created"));
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("invoicing.drawer.create.createFailed"));
    }
  };

  const isPending = createInvoice.isPending;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="p-6 border-b border-border">
        <h2 className="text-lg font-bold">{t("invoicing.drawer.create.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("invoicing.drawer.create.subtitle")}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Customer */}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label>{t("invoicing.drawer.form.customerName")}</Label>
            <Input value={customerName} onChange={e => setCustomerName(e.target.value)}
              placeholder={t("invoicing.drawer.form.customerNamePh")} required />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>{t("invoicing.drawer.form.customerEmail")}</Label>
            <Input type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)}
              placeholder={t("invoicing.drawer.form.customerEmailPh")} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("invoicing.drawer.form.invoiceDate")}</Label>
            <Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>{t("invoicing.drawer.form.dueDate")}</Label>
            <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required />
          </div>
        </div>

        {/* Line Items */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <Label className="text-sm font-semibold">{t("invoicing.drawer.form.lineItems")}</Label>
            <Button type="button" variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={addItem}>
              <Plus className="h-3 w-3" /> {t("invoicing.drawer.form.addItem")}
            </Button>
          </div>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">{t("invoicing.drawer.form.description")}</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground w-16">{t("invoicing.drawer.form.qty")}</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground w-28">{t("invoicing.drawer.form.unitPrice")}</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground w-24">{t("invoicing.drawer.form.total")}</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-2 py-2">
                      <Input placeholder={t("invoicing.drawer.form.descriptionPh")} value={item.description}
                        onChange={(e) => setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, description: e.target.value } : i))}
                        className="h-8 text-xs border-0 bg-transparent focus-visible:ring-1 px-2" />
                    </td>
                    <td className="px-2 py-2">
                      <Input type="number" min={1} value={item.quantity}
                        onChange={(e) => setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, quantity: +e.target.value } : i))}
                        className="h-8 text-xs text-right border-0 bg-transparent focus-visible:ring-1 px-2" />
                    </td>
                    <td className="px-2 py-2">
                      <Input type="number" min={0} step={0.01} value={item.unitPrice}
                        onChange={(e) => setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, unitPrice: +e.target.value } : i))}
                        className="h-8 text-xs text-right border-0 bg-transparent focus-visible:ring-1 px-2" />
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">
                      {formatCurrency(item.quantity * item.unitPrice, currency)}
                    </td>
                    <td className="px-2 py-2">
                      <Button type="button" variant="ghost" size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
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
              <span className="text-muted-foreground">{t("invoicing.drawer.form.subtotal")}</span>
              <span>{formatCurrency(subtotal, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("invoicing.drawer.form.vatPct", { rate: 5 })}</span>
              <span>{formatCurrency(vat, currency)}</span>
            </div>
            <div className="flex justify-between font-bold pt-2 border-t border-border">
              <span>{t("invoicing.drawer.form.total")}</span>
              <span>{formatCurrency(total, currency)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label>{t("invoicing.drawer.form.notes")}</Label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder={t("invoicing.drawer.form.notesPh")}
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>{t("common:action.cancel")}</Button>
        <Button type="submit" disabled={isPending || !customerName.trim() || !invoiceDate || !dueDate}>
          {isPending ? t("common:action.creating") : t("invoicing.drawer.create.submit")}
        </Button>
      </div>
    </form>
  );
}

/* ─── Drawer shell ─────────────────────────────────────────────────────────── */

export function InvoiceDrawer({ open, onClose, invoice, createMode }: InvoiceDrawerProps) {
  const { t } = useTranslation("finance");
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
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                {createMode ? t("invoicing.drawer.shell.newInvoice") : t("invoicing.drawer.shell.invoiceDetail")}
              </p>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-hidden">
              {createMode ? (
                <CreateInvoice onClose={onClose} />
              ) : invoice ? (
                <ViewInvoice invoice={invoice} onClose={onClose} />
              ) : null}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
