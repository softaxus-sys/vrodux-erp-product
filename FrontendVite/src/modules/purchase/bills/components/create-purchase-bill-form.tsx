import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { useCreatePurchaseBill, useSuppliers } from "@/hooks/finance/use-finance";
import { useCurrency, useCurrencyOptions } from "@/hooks/use-currency";

const TODAY = new Date().toISOString().split("T")[0];

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}


interface BillLine {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface CreatePurchaseBillFormProps {
  open: boolean;
  onClose: () => void;
}

export function CreatePurchaseBillForm({ open, onClose }: CreatePurchaseBillFormProps) {
  const { t } = useTranslation("purchase");
  const defaultCurrency = useCurrency();
  const CURRENCIES      = useCurrencyOptions();
  const [supplierId, setSupplierId] = React.useState("");
  const [billDate, setBillDate]     = React.useState(TODAY);
  const [dueDate, setDueDate]       = React.useState(addDays(TODAY, 30));
  const [taxed, setTaxed]           = React.useState(true);
  const [taxRate, setTaxRate]       = React.useState(5);
  const [currencyCode, setCurrencyCode] = React.useState(defaultCurrency);
  const [reference, setReference]   = React.useState("");
  const [notes, setNotes]           = React.useState("");
  const [lines, setLines]           = React.useState<BillLine[]>([{ description: "", quantity: 1, unitPrice: 0 }]);

  const { data: suppliers } = useSuppliers({ isActive: true });
  const { mutate: createBill, isPending } = useCreatePurchaseBill();

  React.useEffect(() => {
    if (open) {
      setSupplierId("");
      setBillDate(TODAY);
      setDueDate(addDays(TODAY, 30));
      setTaxed(true);
      setTaxRate(5);
      setCurrencyCode(defaultCurrency);
      setReference("");
      setNotes("");
      setLines([{ description: "", quantity: 1, unitPrice: 0 }]);
    }
  }, [open]);

  const handleClose = () => onClose();

  const updateLine = (i: number, patch: Partial<BillLine>) =>
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));

  const addLine = () => setLines(prev => [...prev, { description: "", quantity: 1, unitPrice: 0 }]);
  const removeLine = (i: number) => setLines(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);

  const effectiveTaxRate = taxed ? taxRate : 0;
  const subTotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const taxAmount = subTotal * effectiveTaxRate / 100;
  const total = subTotal + taxAmount;

  const isValid = !!supplierId && billDate && dueDate &&
    lines.some(l => l.description.trim() && l.quantity > 0 && l.unitPrice >= 0);

  function handleSubmit() {
    const validLines = lines.filter(l => l.description.trim() && l.quantity > 0);
    createBill(
      {
        supplierId,
        billDate,
        dueDate,
        taxRate: effectiveTaxRate,
        currencyCode,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
        items: validLines.map(l => ({
          description: l.description.trim(),
          quantity:    l.quantity,
          unitPrice:   l.unitPrice,
        })),
      },
      { onSuccess: handleClose },
    );
  }

  return (
    <AnimatePresence>
      {open && (
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
                <h2 className="text-base font-bold text-foreground">{t("bills.form.title")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{t("bills.form.description")}</p>
              </div>
              <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("bills.form.supplier")}</label>
                  <select value={supplierId} onChange={e => setSupplierId(e.target.value)}
                    className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="">{t("bills.form.selectSupplier")}</option>
                    {(suppliers ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("bills.form.billDate")}</label>
                  <Input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("bills.form.dueDate")}</label>
                  <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("bills.form.invoiceType")}</label>
                  <div className="flex h-9 rounded-lg border border-border overflow-hidden text-sm">
                    <button type="button" onClick={() => setTaxed(true)}
                      className={taxed ? "flex-1 bg-primary text-primary-foreground font-medium" : "flex-1 bg-card text-muted-foreground hover:text-foreground"}>
                      {t("bills.form.taxed")}
                    </button>
                    <button type="button" onClick={() => setTaxed(false)}
                      className={!taxed ? "flex-1 bg-primary text-primary-foreground font-medium" : "flex-1 bg-card text-muted-foreground hover:text-foreground"}>
                      {t("bills.form.nonTaxed")}
                    </button>
                  </div>
                </div>
                {taxed && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("bills.form.taxRate")}</label>
                    <Input type="number" min={0} max={100} step={0.5} value={taxRate}
                      onChange={e => setTaxRate(+e.target.value)} className="h-9 text-sm" />
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("bills.form.currency")}</label>
                  <select value={currencyCode} onChange={e => setCurrencyCode(e.target.value)}
                    className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("bills.form.reference")}</label>
                  <Input value={reference} onChange={e => setReference(e.target.value)} placeholder={t("bills.form.referencePh")} className="h-9 text-sm" />
                </div>
              </div>

              {currencyCode !== defaultCurrency && (
                <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                  Import invoice — amounts recorded in <span className="font-semibold">{currencyCode}</span>.
                </p>
              )}

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("bills.form.items")}</p>
                  <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addLine}>
                    <Plus className="h-3 w-3" />{t("bills.form.addLine")}
                  </Button>
                </div>
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30 border-b border-border">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">{t("bills.form.colDescription")}</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-20">{t("bills.form.colQty")}</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-28">{t("bills.form.colUnitPrice")}</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-28">{t("bills.form.colLineTotal")}</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {lines.map((line, i) => (
                        <tr key={i} className="hover:bg-muted/10">
                          <td className="px-2 py-1.5">
                            <Input value={line.description} onChange={e => updateLine(i, { description: e.target.value })}
                              placeholder={t("bills.form.itemPh")} className="h-8 text-xs" />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input type="number" min={0} step={1} value={line.quantity}
                              onChange={e => updateLine(i, { quantity: +e.target.value })} className="h-8 text-xs text-right" />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input type="number" min={0} step={0.01} value={line.unitPrice}
                              onChange={e => updateLine(i, { unitPrice: +e.target.value })} className="h-8 text-xs text-right" />
                          </td>
                          <td className="px-3 py-2 text-right text-xs font-semibold text-foreground">
                            {formatCurrency(line.quantity * line.unitPrice, currencyCode)}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <button type="button" onClick={() => removeLine(i)} disabled={lines.length === 1}
                              className="text-muted-foreground hover:text-destructive disabled:opacity-30">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/10 border-t border-border text-xs">
                      <tr>
                        <td colSpan={3} className="px-3 py-2 text-right text-muted-foreground">{t("bills.form.subtotal")}</td>
                        <td className="px-3 py-2 text-right font-semibold">{formatCurrency(subTotal, currencyCode)}</td>
                        <td />
                      </tr>
                      {taxed && (
                        <tr>
                          <td colSpan={3} className="px-3 py-2 text-right text-muted-foreground">{t("bills.form.tax", { rate: taxRate })}</td>
                          <td className="px-3 py-2 text-right font-semibold">{formatCurrency(taxAmount, currencyCode)}</td>
                          <td />
                        </tr>
                      )}
                      <tr>
                        <td colSpan={3} className="px-3 py-2 text-right font-bold text-foreground">{t("bills.form.total")}</td>
                        <td className="px-3 py-2 text-right font-bold text-primary text-sm">{formatCurrency(total, currencyCode)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("bills.form.notes")}</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder={t("bills.form.notesPh")} rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={handleClose} disabled={isPending}>{t("bills.form.cancel")}</Button>
              <Button onClick={handleSubmit} disabled={!isValid || isPending}>
                {isPending ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />{t("bills.form.saving")}</> : t("bills.form.submit")}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
