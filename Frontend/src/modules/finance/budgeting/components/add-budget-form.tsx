"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency } from "@/lib/utils";
import { useCreateBudget } from "@/hooks/finance/use-budgets";

const CATEGORIES = [
  "Salaries & Benefits",
  "Rent & Facilities",
  "Software & Licenses",
  "Marketing & Advertising",
  "Travel & Entertainment",
  "Professional Services",
  "Equipment & Hardware",
  "Training & Development",
  "Utilities",
  "Contingency",
  "Capital Expenditure",
  "Other Operating Costs",
];

const PERIODS = ["2025-Q1", "2025-Q2", "2025-Q3", "2025-Q4",
                 "2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4",
                 "2026", "2027"];

interface BudgetLine {
  id: string;
  category: string;
  accountName: string;
  budgetedAmount: number;
}

function newLine(): BudgetLine {
  return { id: String(Date.now() + Math.random()), category: "", accountName: "", budgetedAmount: 0 };
}

interface AddBudgetFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddBudgetForm({ open, onClose }: AddBudgetFormProps) {
  const createBudget = useCreateBudget();

  const [name, setName]   = React.useState("");
  const [period, setPeriod] = React.useState("2026");
  const [notes, setNotes] = React.useState("");
  const [lines, setLines] = React.useState<BudgetLine[]>([newLine(), newLine(), newLine()]);

  const updateLine = (id: string, key: keyof BudgetLine, value: string | number) =>
    setLines(prev => prev.map(l => l.id === id ? { ...l, [key]: value } : l));
  const addLine    = () => setLines(prev => [...prev, newLine()]);
  const removeLine = (id: string) => setLines(prev => prev.filter(l => l.id !== id));

  const grandTotal = lines.reduce((s, l) => s + l.budgetedAmount, 0);
  const isValid    = !!name.trim() && !!period && lines.some(l => l.category && l.budgetedAmount > 0);

  const reset = () => {
    setName(""); setPeriod("2026"); setNotes("");
    setLines([newLine(), newLine(), newLine()]);
  };

  React.useEffect(() => { if (!open) reset(); }, [open]);

  const handleSubmit = async () => {
    if (!isValid) return;
    const validLines = lines.filter(l => l.category && l.budgetedAmount > 0);
    await createBudget.mutateAsync({
      name: name.trim(),
      period,
      notes: notes || null,
      lines: validLines.map(l => ({
        category: l.category,
        accountName: l.accountName || null,
        budgetedAmount: l.budgetedAmount,
      })),
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} />
          <motion.div
            className="fixed right-0 top-0 h-full w-full max-w-2xl bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-bold">New Budget</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Define budget allocations by category</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Budget Name *</label>
                  <Input value={name} onChange={e => setName(e.target.value)}
                    placeholder="e.g. IT Department Budget 2026" className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Period *</label>
                  <select value={period} onChange={e => setPeriod(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              {/* Grand total banner */}
              <div className="flex items-center justify-between px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl">
                <span className="text-sm font-semibold">Total Budget</span>
                <span className="text-xl font-bold text-primary">{formatCurrency(grandTotal, "AED")}</span>
              </div>

              {/* Budget Lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Budget Lines</p>
                  <Button type="button" variant="outline" size="sm" onClick={addLine} className="h-7 text-xs gap-1">
                    <Plus className="w-3 h-3" /> Add Line
                  </Button>
                </div>
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30 border-b border-border">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground min-w-[180px]">Category</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground min-w-[140px]">Account (optional)</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-36">Amount (AED)</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {lines.map(line => (
                        <tr key={line.id} className="hover:bg-muted/10">
                          <td className="px-2 py-1.5">
                            <select value={line.category} onChange={e => updateLine(line.id, "category", e.target.value)}
                              className={cn("w-full h-8 px-2 rounded border bg-transparent text-xs focus:outline-none focus:border-primary/40 hover:border-border",
                                line.category ? "border-transparent" : "border-border")}>
                              <option value="">Select category…</option>
                              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <Input value={line.accountName}
                              onChange={e => updateLine(line.id, "accountName", e.target.value)}
                              placeholder="Account name…"
                              className="h-8 text-xs border-transparent bg-transparent focus-visible:border-primary/40 px-2" />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input type="number" min={0} step={100}
                              value={line.budgetedAmount || ""}
                              onChange={e => updateLine(line.id, "budgetedAmount", +e.target.value)}
                              placeholder="0"
                              className="h-8 text-xs text-right border-transparent bg-transparent focus-visible:border-primary/40 px-2" />
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
                        <td colSpan={2} className="px-3 py-2 text-xs text-muted-foreground">Total</td>
                        <td className="px-3 py-2 text-right text-xs text-primary">{formatCurrency(grandTotal, "AED")}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Key assumptions, planned initiatives…" rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-end shrink-0">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!isValid || createBudget.isPending}>
                {createBudget.isPending ? "Creating…" : "Create Budget"}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
