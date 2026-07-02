import * as React from "react";
import { Plus, FileText, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InvoiceStats } from "./invoice-stats";
import { InvoiceTable } from "./invoice-table";
import { InvoiceDrawer } from "./invoice-drawer";
import type { InvoiceDto as Invoice } from "@/lib/finance/finance.api";
import { useInvoices, useInvoiceSummary, useDeleteInvoice, useSendInvoice } from "@/hooks/finance/use-finance";
import { toCsv, downloadFile } from "@/lib/csv";
import { exportPdf } from "@/lib/pdf";
import { ExportMenu } from "@/components/ui/export-menu";
import { Can } from "@/components/auth/can";
import { toast } from "sonner";

export function InvoicingView() {
  const { data: invoices = [] } = useInvoices();
  const { data: invoiceSummary } = useInvoiceSummary();
  const deleteInvoice = useDeleteInvoice();
  const sendInvoice   = useSendInvoice();

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [selectedInvoice, setSelectedInvoice] = React.useState<Invoice | null>(null);
  const [createMode, setCreateMode] = React.useState(false);
  const [pendingDeleteInvoice, setPendingDeleteInvoice] = React.useState<Invoice | null>(null);

  const handleView = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setCreateMode(false);
    setDrawerOpen(true);
  };

  const handleCreate = () => {
    setSelectedInvoice(null);
    setCreateMode(true);
    setDrawerOpen(true);
  };

  const handleDelete = (invoice: Invoice) => {
    setPendingDeleteInvoice(invoice);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteInvoice) return;
    const inv = pendingDeleteInvoice;
    setPendingDeleteInvoice(null);
    try {
      await deleteInvoice.mutateAsync(inv.id);
      toast.success(`Invoice ${inv.invoiceNumber} deleted.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete invoice.");
    }
  };

  const exportCsv = () => {
    const csv = toCsv(invoices.map(inv => ({
      "Invoice #":    inv.invoiceNumber,
      "Customer":     inv.customerName,
      "Email":        inv.customerEmail,
      "Date":         inv.invoiceDate,
      "Due Date":     inv.dueDate,
      "Sub Total":    inv.subTotal,
      "Tax":          inv.taxAmount,
      "Total":        inv.total,
      "Status":       inv.status,
    })), ["Invoice #","Customer","Email","Date","Due Date","Sub Total","Tax","Total","Status"]);
    downloadFile(`invoices_${new Date().toISOString().split("T")[0]}.csv`, csv);
  };

  const exportPdfReport = () => exportPdf({
    title: "Invoices",
    subtitle: `${invoices.length} invoices`,
    columns: ["Invoice #","Customer","Date","Due Date","Sub Total","Tax","Total","Status"],
    rows: invoices.map(inv => [inv.invoiceNumber, inv.customerName, inv.invoiceDate, inv.dueDate, inv.subTotal, inv.taxAmount, inv.total, inv.status]),
    landscape: false,
  });

  const handleSend = async (invoice: Invoice) => {
    try {
      await sendInvoice.mutateAsync(invoice.id);
      toast.success(`Invoice ${invoice.invoiceNumber} sent to customer.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send invoice.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Invoicing</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Manage sales invoices, credit notes, and customer billing.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ExportMenu onCsv={exportCsv} onPdf={exportPdfReport} className="gap-2" />
          <Can permission="finance.invoicing.create">
            <Button size="sm" className="gap-2" onClick={handleCreate}>
              <Plus className="h-4 w-4" /> New Invoice
            </Button>
          </Can>
        </div>
      </div>

      {/* Summary KPIs */}
      {invoiceSummary && <InvoiceStats summary={invoiceSummary} />}

      {/* Invoice Table */}
      <InvoiceTable invoices={invoices} onView={handleView} onDelete={handleDelete} onSend={handleSend} />

      {/* Invoice Drawer (View / Create) */}
      <InvoiceDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        invoice={selectedInvoice}
        createMode={createMode}
      />

      {/* Delete Confirmation Modal */}
      {pendingDeleteInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="font-semibold text-sm">Delete Invoice?</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {pendingDeleteInvoice.invoiceNumber} — This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setPendingDeleteInvoice(null)}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={confirmDelete} disabled={deleteInvoice.isPending}>
                {deleteInvoice.isPending ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

