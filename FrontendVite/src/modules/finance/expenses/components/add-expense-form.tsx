import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, Upload, Receipt, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { useCreateExpense, useUploadExpenseReceipt } from "@/hooks/finance/use-finance";
import { toast } from "sonner";
import { useCurrency, useCurrencyOptions } from "@/hooks/use-currency";

const CATEGORY_VALUES = ["travel", "accommodation", "meals", "fuel", "software", "office", "training", "medical", "other"] as const;
const PAYMENT_METHOD_VALUES = ["cash", "personal_card", "company_card", "bank_transfer"] as const;
const DEPARTMENTS = ["IT", "Finance", "HR", "Sales", "Operations", "Marketing", "Management"];

interface ExpenseLine {
  id: string;
  category: string;
  description: string;
  amount: number;
  receiptNo: string;
  receiptFile: File | null;
}

function newLine(): ExpenseLine {
  return { id: String(Date.now() + Math.random()), category: "travel", description: "", amount: 0, receiptNo: "", receiptFile: null };
}

/** Accepted receipt file types and max size (browser-side validation). */
const ACCEPTED_RECEIPT = "image/png,image/jpeg,image/webp,application/pdf";
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024; // 5 MB

interface AddExpenseFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddExpenseForm({ open, onClose }: AddExpenseFormProps) {
  const { t } = useTranslation("finance");
  const createExpense = useCreateExpense();
  const uploadReceipt = useUploadExpenseReceipt();

  const [lines, setLines] = React.useState<ExpenseLine[]>([newLine()]);
  const [date, setDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [department, setDepartment] = React.useState("");
  const [project, setProject] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState("personal_card");
  const tenantCurrency = useCurrency();
  const currencyOptions = useCurrencyOptions();
  const [currency, setCurrency] = React.useState(tenantCurrency);
  const [notes, setNotes] = React.useState("");

  const totalAmount = lines.reduce((s, l) => s + l.amount, 0);

  const updateLine = (id: string, key: keyof ExpenseLine, value: string | number) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, [key]: value } : l));
  };
  const addLine    = () => setLines(prev => [...prev, newLine()]);
  const removeLine = (id: string) => setLines(prev => prev.filter(l => l.id !== id));

  const attachReceipt = (id: string, file: File | null) => {
    if (file && file.size > MAX_RECEIPT_BYTES) {
      toast.error(t("expenses.form.toast.receiptTooLarge"));
      return;
    }
    setLines(prev => prev.map(l => l.id === id ? { ...l, receiptFile: file } : l));
  };

  const reset = () => {
    setLines([newLine()]);
    setDate(new Date().toISOString().split("T")[0]);
    setDepartment(""); setProject(""); setPaymentMethod("personal_card");
    setCurrency(tenantCurrency); setNotes("");
  };

  React.useEffect(() => { if (!open) reset(); }, [open]);

  /** One expense per line item — each sent to backend independently. */
  const handleSubmit = async (asDraft = false) => {
    const activeLines = lines.filter(l => l.amount > 0);
    if (activeLines.length === 0) { toast.error(t("expenses.form.toast.atLeastOne")); return; }

    try {
      for (const line of activeLines) {
        const refParts = [line.receiptNo, project].filter(Boolean);
        const created = await createExpense.mutateAsync({
          title:         line.description.trim() || `${t(`expenses.category.${line.category}`, { defaultValue: line.category })} ${t("expenses.form.expenseSuffix")}`,
          category:      line.category,
          amount:        line.amount,
          expenseDate:   date,
          paidBy:        department || undefined,
          paymentMethod: paymentMethod,
          reference:     refParts.join(" · ") || undefined,
          notes:         notes || undefined,
        });
        // Upload the receipt file (if any) against the newly created expense.
        if (line.receiptFile && created?.id) {
          await uploadReceipt.mutateAsync({ id: created.id, file: line.receiptFile });
        }
      }
      toast.success(asDraft
        ? t("expenses.form.toast.savedDraft", { count: activeLines.length })
        : t("expenses.form.toast.submitted", { count: activeLines.length }));
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("expenses.form.toast.saveFailed"));
    }
  };

  const isPending = createExpense.isPending || uploadReceipt.isPending;

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
            className="fixed right-0 top-0 h-full w-full max-w-xl bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">{t("expenses.form.title")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{t("expenses.form.subtitle")}</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Header fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("expenses.form.expenseDate")}</label>
                  <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("expenses.form.paymentMethod")}</label>
                  <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {PAYMENT_METHOD_VALUES.map(m => <option key={m} value={m}>{t(`expenses.form.paymentOption.${m}`)}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("expenses.form.departmentPaidBy")}</label>
                  <select value={department} onChange={e => setDepartment(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="">{t("expenses.form.selectDepartment")}</option>
                    {DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("expenses.form.currency")}</label>
                  <select value={currency} onChange={e => setCurrency(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {currencyOptions.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("expenses.form.projectCostCentre")} <span className="text-muted-foreground/60 normal-case font-normal">{t("expenses.form.optional")}</span></label>
                  <Input value={project} onChange={e => setProject(e.target.value)} placeholder={t("expenses.form.projectPh")} className="h-9 text-sm" />
                </div>
              </div>

              {/* Expense Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("expenses.form.expenseItems")}</p>
                  <Button type="button" variant="outline" size="sm" onClick={addLine} className="h-7 text-xs gap-1">
                    <Plus className="w-3 h-3" /> {t("expenses.form.addItem")}
                  </Button>
                </div>
                <div className="space-y-2.5">
                  {lines.map((line, idx) => (
                    <div key={line.id} className="bg-muted/20 rounded-xl p-3 border border-border">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-muted-foreground w-4">{idx + 1}</span>
                        <select value={line.category} onChange={e => updateLine(line.id, "category", e.target.value)}
                          className="flex-1 h-8 px-2 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                          {CATEGORY_VALUES.map(c => <option key={c} value={c}>{t(`expenses.form.category.${c}`)}</option>)}
                        </select>
                        <Input
                          type="number" min={0} step={0.01}
                          value={line.amount || ""}
                          onChange={e => updateLine(line.id, "amount", +e.target.value)}
                          placeholder="0.00"
                          className="w-28 h-8 text-xs text-right"
                        />
                        <button onClick={() => removeLine(line.id)} disabled={lines.length <= 1}
                          className="p-1 rounded text-muted-foreground hover:text-destructive disabled:opacity-30">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 ml-6">
                        <Input value={line.description} onChange={e => updateLine(line.id, "description", e.target.value)}
                          placeholder={t("expenses.form.descriptionPh")} className="h-8 text-xs col-span-2" />
                        <Input value={line.receiptNo} onChange={e => updateLine(line.id, "receiptNo", e.target.value)}
                          placeholder={t("expenses.form.receiptRefPh")} className="h-8 text-xs" />
                        {line.receiptFile ? (
                          <div className="h-8 flex items-center gap-1.5 px-2 rounded-lg border border-primary/30 bg-primary/5 text-xs text-primary min-w-0">
                            <FileText className="w-3 h-3 shrink-0" />
                            <span className="truncate flex-1" title={line.receiptFile.name}>{line.receiptFile.name}</span>
                            <button type="button" onClick={() => attachReceipt(line.id, null)}
                              className="shrink-0 text-muted-foreground hover:text-destructive" aria-label={t("expenses.form.removeReceipt")}>
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <label className="h-8 flex items-center gap-1.5 px-2 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors cursor-pointer">
                            <Upload className="w-3 h-3" /> {t("expenses.form.attachReceipt")}
                            <input type="file" accept={ACCEPTED_RECEIPT} className="hidden"
                              onChange={e => { attachReceipt(line.id, e.target.files?.[0] ?? null); e.target.value = ""; }} />
                          </label>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="flex justify-between items-center px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">{t("expenses.form.totalClaim")}</span>
                </div>
                <span className="text-lg font-bold text-primary">{formatCurrency(totalAmount, currency)}</span>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("expenses.form.notesForApprover")}</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder={t("expenses.form.notesPh")}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose} disabled={isPending}>{t("common:action.cancel")}</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleSubmit(true)}
                  disabled={isPending || !date || totalAmount === 0}>
                  {isPending ? t("common:action.saving") : t("expenses.form.saveDraft")}
                </Button>
                <Button onClick={() => handleSubmit(false)}
                  disabled={isPending || !date || !department || totalAmount === 0}>
                  {isPending ? t("expenses.form.submitting") : t("expenses.form.submitApproval")}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
