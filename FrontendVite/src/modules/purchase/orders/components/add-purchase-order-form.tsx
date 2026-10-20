import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useCreatePurchaseOrder } from "@/hooks/purchase/use-purchase-orders";
import { useAllPurchaseVendors } from "@/hooks/purchase/use-vendors";
import { ProductPicker } from "./product-picker";
import { useAuthStore } from "@/store/auth.store";
import { taxForCountry } from "@/lib/onboarding/geo-data";

interface POLine {
  id: string;
  productId: string | null;
  description: string;
  qty: number;
  unitCost: number;
  taxRate: number;
}

function newLine(defaultTax: number): POLine {
  return { id: String(Date.now() + Math.random()), productId: null, description: "", qty: 1, unitCost: 0, taxRate: defaultTax };
}

interface AddPurchaseOrderFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddPurchaseOrderForm({ open, onClose }: AddPurchaseOrderFormProps) {
  const { t } = useTranslation("purchase");
  const currency = useCurrency();

  // Rates come from the workspace's country (same table the POS/Inventory product forms use),
  // so a UAE tenant sees VAT 5%, a Pakistani one GST 17%, and an unknown country only 0%.
  const country = useAuthStore(st => st.tenant?.country);
  const tax = React.useMemo(() => taxForCountry(country), [country]);
  const defaultRate = Number(tax.standard) || 0;
  // Keyed by option, not rate: zero-rated and exempt are both 0% but are different choices.
  const TAX_OPTIONS = React.useMemo(() => [
    ...tax.rates.filter(r => Number(r) > 0).sort((a, b) => Number(b) - Number(a))
      .map(r => ({ key: `r${r}`, label: `${tax.label} (${r}%)`, rate: Number(r) })),
    { key: "zero",   label: t("orders.form.zeroRated", { defaultValue: "Zero rated (0%)" }), rate: 0 },
    { key: "exempt", label: t("orders.form.exempt",    { defaultValue: "Exempt" }),          rate: 0 },
  ], [tax, t]);
  const defaultKey = TAX_OPTIONS.find(o => o.rate === defaultRate)?.key ?? "zero";
  const [vendorId, setVendorId]         = React.useState("");
  const [expectedDate, setExpectedDate] = React.useState("");
  const [taxKey, setTaxKey]             = React.useState(defaultKey);
  const taxRate = TAX_OPTIONS.find(o => o.key === taxKey)?.rate ?? 0;
  const [lines, setLines]               = React.useState<POLine[]>([newLine(defaultRate), newLine(defaultRate)]);
  const [notes, setNotes]               = React.useState("");

  const { mutate: createOrder, isPending } = useCreatePurchaseOrder();
  const { data: vendorData, isLoading: vendorsLoading } = useAllPurchaseVendors();
  const vendors = vendorData?.items ?? [];

  const lineTotal = (l: POLine) => l.qty * l.unitCost * (1 + l.taxRate / 100);
  const subtotal  = lines.reduce((s, l) => s + l.qty * l.unitCost, 0);
  const taxAmount = lines.reduce((s, l) => s + l.qty * l.unitCost * (l.taxRate / 100), 0);
  const total     = subtotal + taxAmount;

  const updateLine = (id: string, key: keyof POLine, value: string | number) =>
    setLines(prev => prev.map(l => l.id === id ? { ...l, [key]: value } : l));

  const isValid = vendorId && lines.some(l => l.description.trim() && l.qty > 0 && l.unitCost > 0);

  const reset = () => {
    setVendorId(""); setExpectedDate(""); setTaxKey(defaultKey);
    setLines([newLine(defaultRate), newLine(defaultRate)]); setNotes("");
  };

  const handleClose = () => { reset(); onClose(); };

  React.useEffect(() => { if (!open) reset(); }, [open]);

  // Keep line tax rates in sync when global tax rate changes
  React.useEffect(() => {
    setLines(prev => prev.map(l => ({ ...l, taxRate })));
  }, [taxRate]);

  function handleSubmit() {
    const validLines = lines.filter(l => l.description.trim() && l.qty > 0 && l.unitCost > 0);
    createOrder(
      {
        vendorId,
        notes:        notes.trim() || null,
        expectedDate: expectedDate || null,
        items: validLines.map(l => ({
          productId:   l.productId,
          description: l.description,
          quantity:    l.qty,
          unitCost:    l.unitCost,
          taxRate:     l.taxRate,
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
            className="fixed right-0 top-0 h-full w-full max-w-3xl bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">{t("orders.form.title")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{t("orders.form.subtitle")}</p>
              </div>
              <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Header fields */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("orders.form.vendor")}</label>
                  <select
                    value={vendorId}
                    onChange={e => setVendorId(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">{vendorsLoading ? t("common:message.loading") : t("common:action.select")}</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.name}{v.code ? ` (${v.code})` : ""}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("orders.form.expectedDelivery")}</label>
                  <Input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("orders.form.tax")}</label>
                  <select value={taxKey} onChange={e => setTaxKey(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {TAX_OPTIONS.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Purchase Lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("orders.form.lineItems")}</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => setLines(p => [...p, newLine(taxRate)])} className="h-7 text-xs gap-1">
                    <Plus className="w-3 h-3" /> {t("common:action.add")}
                  </Button>
                </div>
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30 border-b border-border">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">{t("orders.form.description")}</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-16">{t("orders.form.qty")}</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-28">{t("orders.form.unitPrice")}</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-28">{t("orders.form.lineTotal")}</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {lines.map(line => (
                        <tr key={line.id} className="hover:bg-muted/10">
                          <td className="px-2 py-1.5">
                            <ProductPicker
                              value={line.description}
                              onTextChange={text => setLines(prev => prev.map(l => l.id === line.id ? { ...l, description: text, productId: null } : l))}
                              onSelect={product => setLines(prev => prev.map(l => l.id === line.id ? {
                                ...l,
                                productId: product.id,
                                description: product.name,
                                unitCost: l.unitCost || product.costPrice,
                              } : l))}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input type="number" min={1} step={1} value={line.qty || ""} onChange={e => updateLine(line.id, "qty", +e.target.value)}
                              placeholder="1" className="h-8 text-xs text-right border-transparent bg-transparent focus-visible:border-primary/40 px-2" />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input type="number" min={0} step={0.01} value={line.unitCost || ""} onChange={e => updateLine(line.id, "unitCost", +e.target.value)}
                              placeholder="0.00" className="h-8 text-xs text-right border-transparent bg-transparent focus-visible:border-primary/40 px-2" />
                          </td>
                          <td className="px-3 py-1.5 text-right text-xs font-semibold text-foreground">
                            {formatCurrency(lineTotal(line), currency)}
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
                        <td colSpan={3} className="px-3 py-2 text-right text-muted-foreground font-medium">{t("orders.form.subtotal")}</td>
                        <td className="px-3 py-2 text-right font-semibold text-foreground">{formatCurrency(subtotal, currency)}</td>
                        <td />
                      </tr>
                      <tr>
                        <td colSpan={3} className="px-3 py-2 text-right text-muted-foreground font-medium">{tax.label} ({taxRate}%)</td>
                        <td className="px-3 py-2 text-right font-semibold text-foreground">{formatCurrency(taxAmount, currency)}</td>
                        <td />
                      </tr>
                      <tr className="border-t border-border">
                        <td colSpan={3} className="px-3 py-2 text-right font-bold text-foreground">{t("orders.form.total")}</td>
                        <td className="px-3 py-2 text-right font-bold text-primary text-sm">{formatCurrency(total, currency)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("orders.form.notes")}</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder={t("common:placeholder.notes")} rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={handleClose} disabled={isPending}>{t("common:action.cancel")}</Button>
              <Button onClick={handleSubmit} disabled={!isValid || isPending}>
                {isPending ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />{t("common:action.saving")}</> : t("orders.form.button.confirm")}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
