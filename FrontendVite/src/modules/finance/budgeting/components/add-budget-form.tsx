import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useCreateBudget } from "@/hooks/finance/use-finance";
import { toast } from "sonner";

const DEPARTMENTS = ["IT", "Finance", "HR", "Sales", "Operations", "Marketing", "Management", "Procurement"];

// Category keys → i18n (budgeting.form.categories.<key>). The translated label is
// stored as the line's category value.
const CATEGORY_KEYS = [
  "salaries", "rent", "software", "marketing", "travel", "professional",
  "equipment", "training", "utilities", "contingency", "capital", "otherOperating",
];

interface BudgetLine {
  id: string;
  category: string;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
}

function newLine(): BudgetLine {
  return { id: String(Date.now() + Math.random()), category: "", q1: 0, q2: 0, q3: 0, q4: 0 };
}

interface AddBudgetFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddBudgetForm({ open, onClose }: AddBudgetFormProps) {
  const { t } = useTranslation("finance");
  const currency = useCurrency();
  const createBudget = useCreateBudget();

  const [department, setDepartment] = React.useState("");
  const [fiscalYear, setFiscalYear] = React.useState("2026");
  const [owner, setOwner] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [lines, setLines] = React.useState<BudgetLine[]>([newLine(), newLine(), newLine()]);

  const updateLine = (id: string, key: keyof BudgetLine, value: string | number) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, [key]: value } : l));
  };
  const addLine    = () => setLines(prev => [...prev, newLine()]);
  const removeLine = (id: string) => setLines(prev => prev.filter(l => l.id !== id));

  const totalByQ = (q: "q1" | "q2" | "q3" | "q4") => lines.reduce((s, l) => s + l[q], 0);
  const lineTotal = (l: BudgetLine) => l.q1 + l.q2 + l.q3 + l.q4;
  const grandTotal = lines.reduce((s, l) => s + lineTotal(l), 0);

  const reset = () => {
    setDepartment(""); setFiscalYear("2026"); setOwner(""); setNotes("");
    setLines([newLine(), newLine(), newLine()]);
  };

  React.useEffect(() => { if (!open) reset(); }, [open]);

  const handleSubmit = async () => {
    if (!department || grandTotal === 0) return;

    const activeLines = lines.filter(l => l.category && lineTotal(l) > 0);
    if (activeLines.length === 0) { toast.error(t("budgeting.form.atLeastOne")); return; }

    const notesText = [
      notes,
      owner ? t("budgeting.form.ownerNote", { owner }) : "",
    ].filter(Boolean).join(" | ");

    try {
      await createBudget.mutateAsync({
        name:   t("budgeting.form.budgetName", { department, year: fiscalYear }),
        period: fiscalYear,
        notes:  notesText || undefined,
        lines:  activeLines.map(l => ({
          category:       l.category,
          budgetedAmount: lineTotal(l),
        })),
      });
      toast.success(t("budgeting.form.created"));
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("budgeting.form.createFailed"));
    }
  };

  const isPending = createBudget.isPending;

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
            className="fixed right-0 top-0 h-full w-full max-w-3xl bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">{t("budgeting.form.title")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{t("budgeting.form.subtitle")}</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Header fields */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("budgeting.form.department")}</label>
                  <select value={department} onChange={e => setDepartment(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="">{t("budgeting.form.select")}</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("budgeting.form.fiscalYear")}</label>
                  <select value={fiscalYear} onChange={e => setFiscalYear(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {["2024", "2025", "2026", "2027"].map(y => <option key={y}>{y}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("budgeting.form.budgetOwner")}</label>
                  <Input value={owner} onChange={e => setOwner(e.target.value)} placeholder={t("budgeting.form.ownerPh")} className="h-9 text-sm" />
                </div>
              </div>

              {/* Grand total banner */}
              <div className="flex items-center justify-between px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl">
                <span className="text-sm font-semibold text-foreground">{t("budgeting.form.totalAnnual")}</span>
                <span className="text-xl font-bold text-primary">{formatCurrency(grandTotal, currency)}</span>
              </div>

              {/* Budget Lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("budgeting.form.budgetLines")}</p>
                  <Button type="button" variant="outline" size="sm" onClick={addLine} className="h-7 text-xs gap-1">
                    <Plus className="w-3 h-3" /> {t("budgeting.form.addCategory")}
                  </Button>
                </div>
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30 border-b border-border">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground min-w-[180px]">{t("budgeting.form.category")}</th>
                        {["Q1", "Q2", "Q3", "Q4"].map(q => (
                          <th key={q} className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-28">{t("budgeting.form.qCol", { q, currency })}</th>
                        ))}
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-28">{t("budgeting.form.annual")}</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {lines.map(line => (
                        <tr key={line.id} className="hover:bg-muted/10">
                          <td className="px-2 py-1.5">
                            <select value={line.category} onChange={e => updateLine(line.id, "category", e.target.value)}
                              className="w-full h-8 px-2 rounded border border-transparent bg-card text-xs text-foreground focus:outline-none focus:border-primary/40 hover:border-border">
                              <option value="">{t("budgeting.form.selectCategory")}</option>
                              {CATEGORY_KEYS.map(key => {
                                const label = t(`budgeting.form.categories.${key}`);
                                return <option key={key} value={label}>{label}</option>;
                              })}
                            </select>
                          </td>
                          {(["q1", "q2", "q3", "q4"] as const).map(q => (
                            <td key={q} className="px-2 py-1.5">
                              <Input
                                type="number" min={0} step={100}
                                value={line[q] || ""}
                                onChange={e => updateLine(line.id, q, +e.target.value)}
                                placeholder="0"
                                className="h-8 text-xs text-right border-transparent bg-transparent focus-visible:border-primary/40 px-2"
                              />
                            </td>
                          ))}
                          <td className="px-3 py-1.5 text-right text-xs font-semibold text-foreground">
                            {formatCurrency(lineTotal(line), currency)}
                          </td>
                          <td className="px-2 py-1.5">
                            <button onClick={() => removeLine(line.id)} disabled={lines.length <= 1}
                              className="p-1 rounded text-muted-foreground hover:text-destructive disabled:opacity-30">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/20 border-t border-border font-semibold">
                      <tr>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{t("budgeting.form.totals")}</td>
                        {(["q1", "q2", "q3", "q4"] as const).map(q => (
                          <td key={q} className="px-3 py-2 text-right text-xs text-foreground">
                            {formatCurrency(totalByQ(q), currency)}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right text-xs text-primary">{formatCurrency(grandTotal, currency)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("budgeting.form.notes")}</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder={t("budgeting.form.notesPh")}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose} disabled={isPending}>{t("common:action.cancel")}</Button>
              <Button onClick={handleSubmit} disabled={isPending || !department || grandTotal === 0}>
                {isPending ? t("common:action.saving") : t("budgeting.form.createBudget")}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
