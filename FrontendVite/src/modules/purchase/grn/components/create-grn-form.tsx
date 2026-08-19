import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useCreateGoodsReceiptNote } from "@/hooks/purchase/use-grn";
import type { PurchaseOrderDto } from "@/lib/pos/types";

const TODAY = new Date().toISOString().split("T")[0];

interface ReceiveLine {
  purchaseOrderItemId: string;
  productId: string | null;
  description: string;
  orderedQuantity: number;
  alreadyReceived: number;
  receiveQty: number;
  unitCost: number;
}

interface CreateGrnFormProps {
  order: PurchaseOrderDto | null;
  open: boolean;
  onClose: () => void;
}

export function CreateGrnForm({ order, open, onClose }: CreateGrnFormProps) {
  const { t } = useTranslation("purchase");
  const currency = useCurrency();
  const [grnDate, setGrnDate]     = React.useState(TODAY);
  const [driverName, setDriverName] = React.useState("");
  const [notes, setNotes]         = React.useState("");
  const [lines, setLines]         = React.useState<ReceiveLine[]>([]);

  const { mutate: createGrn, isPending } = useCreateGoodsReceiptNote();

  React.useEffect(() => {
    if (open && order) {
      setGrnDate(TODAY);
      setDriverName("");
      setNotes("");
      setLines(order.items.map(i => ({
        purchaseOrderItemId: i.id,
        productId:           i.productId,
        description:         i.description,
        orderedQuantity:     i.quantity,
        alreadyReceived:     0,
        receiveQty:          i.quantity,
        unitCost:            i.unitCost,
      })));
    }
  }, [open, order]);

  const handleClose = () => onClose();

  const updateQty = (id: string, qty: number) =>
    setLines(prev => prev.map(l => l.purchaseOrderItemId === id ? { ...l, receiveQty: qty } : l));

  const isValid = !!order && lines.some(l => l.receiveQty > 0);
  const total = lines.reduce((s, l) => s + l.receiveQty * l.unitCost, 0);

  function handleSubmit() {
    if (!order) return;
    const validLines = lines.filter(l => l.receiveQty > 0);
    createGrn(
      {
        purchaseOrderId: order.id,
        grnDate,
        driverName: driverName.trim() || null,
        notes:      notes.trim() || null,
        items: validLines.map(l => ({
          purchaseOrderItemId: l.purchaseOrderItemId,
          productId:           l.productId,
          description:         l.description,
          orderedQuantity:     l.orderedQuantity,
          receivedQuantity:    l.receiveQty,
          unitCost:            l.unitCost,
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
                <h2 className="text-base font-bold text-foreground">{t("grn.form.title")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Against PO <span className="font-mono">{order.orderNumber}</span> — {order.vendorName}
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
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("grn.form.date")}</label>
                  <Input type="date" value={grnDate} onChange={e => setGrnDate(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("grn.form.driver")}</label>
                  <div className="relative">
                    <Truck className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input value={driverName} onChange={e => setDriverName(e.target.value)}
                      placeholder={t("grn.form.driver")} className="h-9 text-sm pl-9" />
                  </div>
                </div>
              </div>

              {/* Items */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t("grn.form.items")}</p>
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30 border-b border-border">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">{t("common.item")}</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-20">{t("common.ordered")}</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-24">{t("common.received")}</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-28">{t("common.total")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {lines.map(line => (
                        <tr key={line.purchaseOrderItemId} className="hover:bg-muted/10">
                          <td className="px-3 py-2 text-xs">{line.description}</td>
                          <td className="px-3 py-2 text-right text-xs text-muted-foreground">{line.orderedQuantity}</td>
                          <td className="px-2 py-1.5">
                            <Input type="number" min={0} step={1} value={line.receiveQty || ""}
                              onChange={e => updateQty(line.purchaseOrderItemId, +e.target.value)}
                              className="h-8 text-xs text-right" />
                          </td>
                          <td className="px-3 py-2 text-right text-xs font-semibold text-foreground">
                            {formatCurrency(line.receiveQty * line.unitCost, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/10 border-t border-border text-xs">
                      <tr>
                        <td colSpan={3} className="px-3 py-2 text-right font-bold text-foreground">{t("common.totalValue")}</td>
                        <td className="px-3 py-2 text-right font-bold text-primary text-sm">{formatCurrency(total, currency)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("common.notes")}</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder={t("grn.form.description")} rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={handleClose} disabled={isPending}>{t("common.cancel")}</Button>
              <Button onClick={handleSubmit} disabled={!isValid || isPending}>
                {isPending ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />{t("common.saving")}</> : t("grn.form.confirm")}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
