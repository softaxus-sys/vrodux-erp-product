import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { useCreateBudget } from "@/hooks/finance/use-finance";
import { toast } from "sonner";

const DEPARTMENTS = ["IT", "Finance", "HR", "Sales", "Operations", "Marketing", "Management", "Procurement"];

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
    if (activeLines.length === 0) { toast.error("Add at least one budget line with a category and amount."); return; }

    const notesText = [
      notes,
      owner ? `Budget owner: ${owner}` : "",
    ].filter(Boolean).join(" | ");

    try {
      await createBudget.mutateAsync({
        name:   `${department} — FY${fiscalYear} Budget`,
        period: fiscalYear,
        notes:  notesText || undefined,
        lines:  activeLines.map(l => ({
          category:       l.category,
          budgetedAmount: lineTotal(l),
        })),
      });
      toast.success("Budget created successfully.");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create budget.");
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
                <h2 className="text-base font-bold text-foreground">New Budget</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Set departmental budget allocations by quarter</p>
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
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Department *</label>
                  <select value={department} onChange={e => setDepartment(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="">Select…</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fiscal Year *</label>
                  <select value={fiscalYear} onChange={e => setFiscalYear(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {["2024", "2025", "2026", "2027"].map(y => <option key={y}>{y}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Budget Owner</label>
                  <Input value={owner} onChange={e => setOwner(e.target.value)} placeholder="Department head…" className="h-9 text-sm" />
                </div>
              </div>

              {/* Grand total banner */}
              <div className="flex items-center justify-between px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl">
                <span className="text-sm font-semibold text-foreground">Total Annual Budget</span>
                <span className="text-xl font-bold text-primary">{formatCurrency(grandTotal, "AED")}</span>
              </div>

              {/* Budget Lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Budget Lines (Quarterly)</p>
                  <Button type="button" variant="outline" size="sm" onClick={addLine} className="h-7 text-xs gap-1">
                    <Plus className="w-3 h-3" /> Add Category
                  </Button>
                </div>
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30 border-b border-border">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground min-w-[180px]">Category</th>
                        {["Q1", "Q2", "Q3", "Q4"].map(q => (
                          <th key={q} className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-28">{q} (AED)</th>
                        ))}
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-28">Annual</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {lines.map(line => (
                        <tr key={line.id} className="hover:bg-muted/10">
                          <td className="px-2 py-1.5">
                            <select value={line.category} onChange={e => updateLine(line.id, "category", e.target.value)}
                              className="w-full h-8 px-2 rounded border border-transparent bg-card text-xs text-foreground focus:outline-none focus:border-primary/40 hover:border-border">
                              <option value="">Select category…</option>
                              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
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
                            {formatCurrency(lineTotal(line), "AED")}
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
                        <td className="px-3 py-2 text-xs text-muted-foreground">Totals</td>
                        {(["q1", "q2", "q3", "q4"] as const).map(q => (
                          <td key={q} className="px-3 py-2 text-right text-xs text-foreground">
                            {formatCurrency(totalByQ(q), "AED")}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right text-xs text-primary">{formatCurrency(grandTotal, "AED")}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes & Assumptions</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Key assumptions, headcount basis, planned initiatives…"
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={isPending || !department || grandTotal === 0}>
                {isPending ? "Saving…" : "Create Budget"}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
