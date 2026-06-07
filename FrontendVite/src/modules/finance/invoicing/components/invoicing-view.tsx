import * as React from "react";
import { Plus, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InvoiceStats } from "./invoice-stats";
import { InvoiceTable } from "./invoice-table";
import { InvoiceDrawer } from "./invoice-drawer";
import type { InvoiceDto as Invoice } from "@/lib/finance/finance.api";
import { useInvoices, useInvoiceSummary, useDeleteInvoice, useSendInvoice } from "@/hooks/finance/use-finance";
import { toast } from "sonner";

export function InvoicingView() {
  const { data: invoices = [] } = useInvoices();
  const { data: invoiceSummary } = useInvoiceSummary();
  const deleteInvoice = useDeleteInvoice();
  const sendInvoice   = useSendInvoice();

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [selectedInvoice, setSelectedInvoice] = React.useState<Invoice | null>(null);
  const [createMode, setCreateMode] = React.useState(false);

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

  const handleDelete = async (invoice: Invoice) => {
    if (!window.confirm(`Delete invoice ${invoice.invoiceNumber}? This cannot be undone.`)) return;
    try {
      await deleteInvoice.mutateAsync(invoice.id);
      toast.success(`Invoice ${invoice.invoiceNumber} deleted.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete invoice.");
    }
  };

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
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button size="sm" className="gap-2" onClick={handleCreate}>
            <Plus className="h-4 w-4" /> New Invoice
          </Button>
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
    </div>
  );
}

