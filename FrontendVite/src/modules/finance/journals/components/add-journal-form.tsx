import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useAccounts, useCreateJournal } from "@/hooks/finance/use-finance";
import { toast } from "sonner";

interface JournalLine {
  id: string;
  accountId: string;
  accountName: string;
  description: string;
  debit: number;
  credit: number;
}

function newLine(): JournalLine {
  return { id: String(Date.now() + Math.random()), accountId: "", accountName: "", description: "", debit: 0, credit: 0 };
}

interface AddJournalFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddJournalForm({ open, onClose }: AddJournalFormProps) {
  const currency = useCurrency();
  const { data: accounts = [] } = useAccounts({ isActive: true });
  const createJournal = useCreateJournal();

  const [lines, setLines] = React.useState<JournalLine[]>([newLine(), newLine()]);
  const [date, setDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [reference, setReference] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const totalDebit  = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  const isBalanced  = Math.abs(totalDebit - totalCredit) < 0.01;
  const hasLines    = lines.some(l => l.accountId && (l.debit > 0 || l.credit > 0));
  const isValid     = description.trim() && hasLines && isBalanced;

  const updateLine = (id: string, key: keyof JournalLine, value: string | number) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, [key]: value } : l));
  };

  const selectAccount = (lineId: string, accountId: string) => {
    const acc = accounts.find(a => a.id === accountId);
    if (!acc) { updateLine(lineId, "accountId", ""); updateLine(lineId, "accountName", ""); return; }
    setLines(prev => prev.map(l => l.id === lineId
      ? { ...l, accountId: acc.id, accountName: acc.name }
      : l));
  };

  const addLine    = () => setLines(prev => [...prev, newLine()]);
  const removeLine = (id: string) => setLines(prev => prev.filter(l => l.id !== id));

  const reset = () => {
    setLines([newLine(), newLine()]);
    setDate(new Date().toISOString().split("T")[0]);
    setReference(""); setDescription(""); setNotes("");
  };

  React.useEffect(() => { if (!open) reset(); }, [open]);

  const handleSubmit = async () => {
    if (!isValid) return;
    const payload = {
      date,
      description: description.trim(),
      reference:   reference.trim() || undefined,
      notes:       notes.trim() || undefined,
      lines: lines
        .filter(l => l.accountId && (l.debit > 0 || l.credit > 0))
        .map(l => ({
          accountId:   l.accountId,
          accountName: l.accountName,
          debitAmount:  l.debit,
          creditAmount: l.credit,
          description: l.description.trim() || undefined,
        })),
    };

    try {
      await createJournal.mutateAsync(payload);
      toast.success("Journal entry created successfully.");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create journal entry.");
    }
  };

  const isPending = createJournal.isPending;

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
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reference</label>
                  <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="Invoice #, PO #..." className="h-9 text-sm" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description *</label>
                  <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Record May rent expense" className="h-9 text-sm" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes <span className="text-muted-foreground/60 normal-case font-normal">(optional)</span></label>
                  <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Supporting document references..." className="h-9 text-sm" />
                </div>
              </div>

              {/* Balance indicator */}
              <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border ${
                isBalanced && totalDebit > 0
                  ? "bg-success/10 border-success/20 text-success"
                  : !isBalanced && (totalDebit > 0 || totalCredit > 0)
                    ? "bg-destructive/10 border-destructive/20 text-destructive"
                    : "bg-muted/30 border-border text-muted-foreground"
              }`}>
                <AlertCircle className="w-3.5 h-3.5" />
                {isBalanced && totalDebit > 0
                  ? `Balanced — ${formatCurrency(totalDebit, currency)}`
                  : `Out of balance — Dr: ${formatCurrency(totalDebit, currency)} / Cr: ${formatCurrency(totalCredit, currency)} (diff: ${formatCurrency(Math.abs(totalDebit - totalCredit), currency)})`
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
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground w-52">Account</th>
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
                              value={line.accountId}
                              onChange={e => selectAccount(line.id, e.target.value)}
                              className="w-full h-8 px-2 rounded border border-transparent bg-card text-xs text-foreground focus:outline-none focus:border-primary/40 hover:border-border"
                            >
                              <option value="">Select account…</option>
                              {accounts.map(a => (
                                <option key={a.id} value={a.id}>
                                  {a.accountNumber} — {a.name}
                                </option>
                              ))}
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
                        <td className="px-3 py-2 text-right text-xs font-bold text-foreground">{formatCurrency(totalDebit, currency)}</td>
                        <td className="px-3 py-2 text-right text-xs font-bold text-foreground">{formatCurrency(totalCredit, currency)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!isValid || isPending}>
                {isPending ? "Saving…" : "Post Journal"}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
