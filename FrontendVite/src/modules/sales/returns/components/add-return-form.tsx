import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { useCreateReturn } from "@/hooks/sales/use-returns";

const RETURN_REASONS = [
  "Defective / Damaged",
  "Wrong Item Delivered",
  "Customer Changed Mind",
  "Duplicate Order",
  "Item Not as Described",
  "Quality Issue",
  "Missing Parts",
  "Late Delivery",
  "Other",
];

const RETURN_ACTIONS = [
  { value: "refund",      label: "Full Refund" },
  { value: "exchange",    label: "Exchange / Replacement" },
  { value: "credit_note", label: "Credit Note" },
  { value: "repair",      label: "Repair & Return" },
];

interface ReturnLine {
  id: string;
  sku: string;
  description: string;
  qtyOrdered: number;
  qtyReturned: number;
  unitPrice: number;
  reason: string;
}

function newLine(): ReturnLine {
  return { id: String(Date.now() + Math.random()), sku: "", description: "", qtyOrdered: 0, qtyReturned: 1, unitPrice: 0, reason: "Defective / Damaged" };
}

interface AddReturnFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddReturnForm({ open, onClose }: AddReturnFormProps) {
  const { t } = useTranslation("sales");
  const createReturn = useCreateReturn();
  const [orderRef, setOrderRef]       = React.useState("");
  const [customer, setCustomer]       = React.useState("");
  const [returnDate, setReturnDate]   = React.useState(new Date().toISOString().split("T")[0]);
  const [returnAction, setReturnAction] = React.useState("refund");
  const [lines, setLines]             = React.useState<ReturnLine[]>([newLine()]);
  const [notes, setNotes]             = React.useState("");

  const totalRefund = lines.reduce((s, l) => s + l.qtyReturned * l.unitPrice, 0);

  const updateLine = (id: string, key: keyof ReturnLine, value: string | number) =>
    setLines(prev => prev.map(l => l.id === id ? { ...l, [key]: value } : l));

  const isValid = orderRef.trim() && customer.trim() && lines.some(l => l.qtyReturned > 0 && l.unitPrice > 0);

  const reset = () => {
    setOrderRef(""); setCustomer(""); setReturnDate(new Date().toISOString().split("T")[0]);
    setReturnAction("refund"); setLines([newLine()]); setNotes("");
  };

  React.useEffect(() => { if (!open) reset(); }, [open]);

  const handleProcess = async () => {
    try {
      const validLines = lines.filter(l => l.qtyReturned > 0 && l.unitPrice > 0);
      await createReturn.mutateAsync({
        salesOrderId: orderRef.trim(),
        reason: "other" as const,
        reasonDetail: notes.trim() || undefined,
        returnAction,
        items: validLines.map(l => ({
          description: l.description || l.sku || "Item",
          quantity: l.qtyReturned,
          unitPrice: l.unitPrice,
          lineTotal: l.qtyReturned * l.unitPrice,
        })),
      });
      onClose();
    } catch { /* hook toasts */ }
  };

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
            className="fixed right-0 top-0 h-full w-full max-w-2xl bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">{t("returns.form.title")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{t("returns.form.description")}</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Header fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("returns.form.orderRef")}</label>
                  <Input value={orderRef} onChange={e => setOrderRef(e.target.value)} placeholder="SO-XXXXX" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("returns.form.returnDate")}</label>
                  <Input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("returns.form.customer")}</label>
                  <Input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Customer name…" className="h-9 text-sm" />
                </div>
              </div>

              {/* Return Action */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("returns.form.returnAction")}</label>
                <div className="grid grid-cols-2 gap-2">
                  {RETURN_ACTIONS.map(a => (
                    <button key={a.value} onClick={() => setReturnAction(a.value)}
                      className={`py-2.5 rounded-xl border-2 text-xs font-medium transition-all ${
                        returnAction === a.value ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                      }`}>
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Return Lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("returns.form.returnItems")}</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => setLines(p => [...p, newLine()])} className="h-7 text-xs gap-1">
                    <Plus className="w-3 h-3" /> {t("returns.form.button.addItem")}
                  </Button>
                </div>
                <div className="space-y-3">
                  {lines.map((line, idx) => (
                    <div key={line.id} className="bg-muted/10 rounded-xl border border-border p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground w-4">{idx + 1}</span>
                        <Input value={line.sku} onChange={e => updateLine(line.id, "sku", e.target.value)}
                          placeholder="SKU" className="h-8 text-xs w-24" />
                        <Input value={line.description} onChange={e => updateLine(line.id, "description", e.target.value)}
                          placeholder="Item description…" className="h-8 text-xs flex-1" />
                        <button onClick={() => setLines(p => p.filter(l => l.id !== line.id))} disabled={lines.length <= 1}
                          className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-30">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-2 ml-6">
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground uppercase">{t("returns.form.qtyReturned")}</label>
                          <Input type="number" min={1} step={1} value={line.qtyReturned || ""} onChange={e => updateLine(line.id, "qtyReturned", +e.target.value)}
                            className="h-7 text-xs text-right" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground uppercase">{t("returns.form.unitPrice")}</label>
                          <Input type="number" min={0} step={0.01} value={line.unitPrice || ""} onChange={e => updateLine(line.id, "unitPrice", +e.target.value)}
                            placeholder="0.00" className="h-7 text-xs text-right" />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <label className="text-[10px] text-muted-foreground uppercase">{t("returns.form.reason")}</label>
                          <select value={line.reason} onChange={e => updateLine(line.id, "reason", e.target.value)}
                            className="w-full h-7 px-2 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                            {RETURN_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              {totalRefund > 0 && (
                <div className="flex items-center justify-between px-4 py-3 bg-destructive/5 border border-destructive/20 rounded-xl">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-destructive" />
                    <span className="text-sm font-semibold text-foreground">{t("returns.form.totalRefund")}</span>
                  </div>
                  <span className="text-lg font-bold text-destructive">{formatCurrency(totalRefund, "AED")}</span>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("returns.form.notes")}</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Condition of returned items, inspection notes…" rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose}>{t("returns.form.button.cancel")}</Button>
              <Button onClick={handleProcess} disabled={!isValid || createReturn.isPending}>{t("returns.form.button.process")}</Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

