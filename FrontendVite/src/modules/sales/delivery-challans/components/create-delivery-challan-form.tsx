import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useCreateDeliveryChallan } from "@/hooks/sales/use-delivery-challans";
import type { SalesOrderDto } from "@/lib/pos/types";

const TODAY = new Date().toISOString().split("T")[0];

interface DeliverLine {
  salesOrderItemId: string;
  productId: string | null;
  description: string;
  orderedQuantity: number;
  deliverQty: number;
  unitPrice: number;
}

interface CreateDeliveryChallanFormProps {
  order: SalesOrderDto | null;
  open: boolean;
  onClose: () => void;
}

export function CreateDeliveryChallanForm({ order, open, onClose }: CreateDeliveryChallanFormProps) {
  const currency = useCurrency();
  const [challanDate, setChallanDate] = React.useState(TODAY);
  const [driverName, setDriverName]   = React.useState("");
  const [notes, setNotes]             = React.useState("");
  const [lines, setLines]             = React.useState<DeliverLine[]>([]);

  const { mutate: createChallan, isPending } = useCreateDeliveryChallan();

  React.useEffect(() => {
    if (open && order) {
      setChallanDate(TODAY);
      setDriverName("");
      setNotes("");
      setLines(order.items.map(i => ({
        salesOrderItemId: i.id,
        productId:        i.productId,
        description:      i.description,
        orderedQuantity:  i.quantity,
        deliverQty:       i.quantity,
        unitPrice:        i.unitPrice,
      })));
    }
  }, [open, order]);

  const handleClose = () => onClose();

  const updateQty = (id: string, qty: number) =>
    setLines(prev => prev.map(l => l.salesOrderItemId === id ? { ...l, deliverQty: qty } : l));

  const isValid = !!order && lines.some(l => l.deliverQty > 0);
  const total = lines.reduce((s, l) => s + l.deliverQty * l.unitPrice, 0);

  function handleSubmit() {
    if (!order) return;
    const validLines = lines.filter(l => l.deliverQty > 0);
    createChallan(
      {
        salesOrderId: order.id,
        challanDate,
        driverName: driverName.trim() || null,
        notes:      notes.trim() || null,
        items: validLines.map(l => ({
          salesOrderItemId:  l.salesOrderItemId,
          productId:         l.productId,
          description:       l.description,
          orderedQuantity:   l.orderedQuantity,
          deliveredQuantity: l.deliverQty,
          unitPrice:         l.unitPrice,
        })),
      },
      { onSuccess: handleClose },
    );
  }

  return (
    <AnimatePresence>
      {open && order && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={handleClose}
          />
          <motion.div
            className="fixed right-0 top-0 h-full w-full max-w-2xl bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">New Delivery Challan</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Against Order <span className="font-mono">{order.orderNumber}</span> — {order.customerName ?? "Walk-in Customer"}
                </p>
              </div>
              <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Challan Date *</label>
                  <Input type="date" value={challanDate} onChange={e => setChallanDate(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Driver Name</label>
                  <div className="relative">
                    <Truck className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input value={driverName} onChange={e => setDriverName(e.target.value)}
                      placeholder="Driver / carrier name" className="h-9 text-sm pl-9" />
                  </div>
                </div>
              </div>

              {/* Items */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Delivered Items</p>
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30 border-b border-border">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Item</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-20">Ordered</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-24">Delivered</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-28">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {lines.map(line => (
                        <tr key={line.salesOrderItemId} className="hover:bg-muted/10">
                          <td className="px-3 py-2 text-xs">{line.description}</td>
                          <td className="px-3 py-2 text-right text-xs text-muted-foreground">{line.orderedQuantity}</td>
                          <td className="px-2 py-1.5">
                            <Input type="number" min={0} step={1} value={line.deliverQty || ""}
                              onChange={e => updateQty(line.salesOrderItemId, +e.target.value)}
                              className="h-8 text-xs text-right" />
                          </td>
                          <td className="px-3 py-2 text-right text-xs font-semibold text-foreground">
                            {formatCurrency(line.deliverQty * line.unitPrice, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/10 border-t border-border text-xs">
                      <tr>
                        <td colSpan={3} className="px-3 py-2 text-right font-bold text-foreground">Total Delivered Value</td>
                        <td className="px-3 py-2 text-right font-bold text-primary text-sm">{formatCurrency(total, currency)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Delivery instructions, condition of goods, remarks…" rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={handleClose} disabled={isPending}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!isValid || isPending}>
                {isPending ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />Saving…</> : "Create Delivery Challan"}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
