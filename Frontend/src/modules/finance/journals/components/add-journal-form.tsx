"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";

interface JournalLine {
  id: string;
  account: string;
  description: string;
  debit: number;
  credit: number;
}

const ACCOUNTS = [
  "1001 - Cash",
  "1100 - Accounts Receivable",
  "1200 - Inventory",
  "1500 - Prepaid Expenses",
  "2001 - Accounts Payable",
  "2100 - Accrued Liabilities",
  "2500 - VAT Payable",
  "3001 - Share Capital",
  "4001 - Revenue",
  "4500 - Other Income",
  "5001 - Cost of Goods Sold",
  "6001 - Salaries Expense",
  "6100 - Rent Expense",
  "6200 - Utilities Expense",
  "6300 - Marketing Expense",
  "6400 - Depreciation Expense",
  "6500 - Professional Fees",
];

function newLine(): JournalLine {
  return { id: String(Date.now() + Math.random()), account: "", description: "", debit: 0, credit: 0 };
}

interface AddJournalFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddJournalForm({ open, onClose }: AddJournalFormProps) {
  const [lines, setLines] = React.useState<JournalLine[]>([newLine(), newLine()]);
  const [date, setDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [reference, setReference] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [type, setType] = React.useState("manual");

  const totalDebit  = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  const isBalanced  = Math.abs(totalDebit - totalCredit) < 0.01;
  const isValid     = description.trim() && lines.some(l => l.account) && isBalanced;

  const updateLine = (id: string, key: keyof JournalLine, value: string | number) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, [key]: value } : l));
  };

  const addLine  = () => setLines(prev => [...prev, newLine()]);
  const removeLine = (id: string) => setLines(prev => prev.filter(l => l.id !== id));

  const handleSaveDraft = () => onClose();
  const handlePost      = () => onClose();

  const reset = () => {
    setLines([newLine(), newLine()]);
    setDate(new Date().toISOString().split("T")[0]);
    setReference(""); setDescription(""); setType("manual");
  };

  React.useEffect(() => { if (!open) reset(); }, [open]);

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
                <h2 className="text-base font-bold text-foreground">New Journal Entry</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Record a manual double-entry transaction</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Meta fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date *</label>
                  <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</label>
                  <select
                    value={type}
                    onChange={e => setType(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {["manual", "accrual", "depreciation", "reversal", "opening_balance", "closing"].map(t => (
                      <option key={t} value={t}>{t.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description *</label>
                  <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Record May rent expense" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reference</label>
                  <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="Invoice #, PO #..." className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Period</label>
                  <select className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {["May 2026", "April 2026", "March 2026"].map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              {/* Balance indicator */}
              <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border ${
                isBalanced && (totalDebit > 0)
                  ? "bg-success/10 border-success/20 text-success"
                  : !isBalanced && (totalDebit > 0 || totalCredit > 0)
                    ? "bg-destructive/10 border-destructive/20 text-destructive"
                    : "bg-muted/30 border-border text-muted-foreground"
              }`}>
                <AlertCircle className="w-3.5 h-3.5" />
                {isBalanced && totalDebit > 0
                  ? `Balanced — ${formatCurrency(totalDebit, "AED")}`
                  : `Out of balance — Debit: ${formatCurrency(totalDebit, "AED")} / Credit: ${formatCurrency(totalCredit, "AED")} (diff: ${formatCurrency(Math.abs(totalDebit - totalCredit), "AED")})`
                }
              </div>

              {/* Journal Lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Journal Lines</p>
                  <Button type="button" variant="outline" size="sm" onClick={addLine} className="h-7 text-xs gap-1">
                    <Plus className="w-3 h-3" /> Add Line
                  </Button>
                </div>
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30 border-b border-border">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground w-48">Account</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Description</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-28">Debit (AED)</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-28">Credit (AED)</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {lines.map(line => (
                        <tr key={line.id} className="hover:bg-muted/10">
                          <td className="px-2 py-1.5">
                            <select
                              value={line.account}
                              onChange={e => updateLine(line.id, "account", e.target.value)}
                              className="w-full h-8 px-2 rounded border border-transparent bg-transparent text-xs text-foreground focus:outline-none focus:border-primary/40 hover:border-border"
                            >
                              <option value="">Select account…</option>
                              {ACCOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              value={line.description}
                              onChange={e => updateLine(line.id, "description", e.target.value)}
                              placeholder="Line description"
                              className="h-8 text-xs border-transparent bg-transparent focus-visible:border-primary/40 px-2"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              type="number" min={0} step={0.01}
                              value={line.debit || ""}
                              onChange={e => updateLine(line.id, "debit", +e.target.value)}
                              placeholder="0.00"
                              className="h-8 text-xs text-right border-transparent bg-transparent focus-visible:border-primary/40 px-2"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              type="number" min={0} step={0.01}
                              value={line.credit || ""}
                              onChange={e => updateLine(line.id, "credit", +e.target.value)}
                              placeholder="0.00"
                              className="h-8 text-xs text-right border-transparent bg-transparent focus-visible:border-primary/40 px-2"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <button
                              onClick={() => removeLine(line.id)}
                              disabled={lines.length <= 2}
                              className="p-1 rounded text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/20 border-t border-border">
                      <tr>
                        <td colSpan={2} className="px-3 py-2 text-xs font-semibold text-muted-foreground">Totals</td>
                        <td className="px-3 py-2 text-right text-xs font-bold text-foreground">{formatCurrency(totalDebit, "AED")}</td>
                        <td className="px-3 py-2 text-right text-xs font-bold text-foreground">{formatCurrency(totalCredit, "AED")}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Internal Notes</label>
                <textarea
                  placeholder="Reason for this journal entry, supporting documents reference..."
                  rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleSaveDraft} disabled={!description.trim()}>
                  Save as Draft
                </Button>
                <Button onClick={handlePost} disabled={!isValid}>
                  Post Journal
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
