import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, Upload, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { useCreateExpense } from "@/hooks/finance/use-finance";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "travel",        label: "✈️ Travel" },
  { value: "accommodation", label: "🏨 Accommodation" },
  { value: "meals",         label: "🍽️ Meals & Entertainment" },
  { value: "fuel",          label: "⛽ Fuel & Transport" },
  { value: "software",      label: "💻 Software & Subscriptions" },
  { value: "office",        label: "🏢 Office Supplies" },
  { value: "training",      label: "📚 Training & Education" },
  { value: "medical",       label: "🏥 Medical" },
  { value: "other",         label: "📎 Other" },
];

const PAYMENT_METHODS = [
  { value: "cash",          label: "Cash" },
  { value: "personal_card", label: "Personal Card" },
  { value: "company_card",  label: "Company Card" },
  { value: "bank_transfer", label: "Bank Transfer" },
];

interface ExpenseLine {
  id: string;
  category: string;
  description: string;
  amount: number;
  receiptNo: string;
}

function newLine(): ExpenseLine {
  return { id: String(Date.now() + Math.random()), category: "travel", description: "", amount: 0, receiptNo: "" };
}

interface AddExpenseFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddExpenseForm({ open, onClose }: AddExpenseFormProps) {
  const createExpense = useCreateExpense();

  const [lines, setLines] = React.useState<ExpenseLine[]>([newLine()]);
  const [date, setDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [department, setDepartment] = React.useState("");
  const [project, setProject] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState("personal_card");
  const [currency, setCurrency] = React.useState("AED");
  const [notes, setNotes] = React.useState("");

  const totalAmount = lines.reduce((s, l) => s + l.amount, 0);

  const updateLine = (id: string, key: keyof ExpenseLine, value: string | number) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, [key]: value } : l));
  };
  const addLine    = () => setLines(prev => [...prev, newLine()]);
  const removeLine = (id: string) => setLines(prev => prev.filter(l => l.id !== id));

  const reset = () => {
    setLines([newLine()]);
    setDate(new Date().toISOString().split("T")[0]);
    setDepartment(""); setProject(""); setPaymentMethod("personal_card");
    setCurrency("AED"); setNotes("");
  };

  React.useEffect(() => { if (!open) reset(); }, [open]);

  /** One expense per line item — each sent to backend independently. */
  const handleSubmit = async (asDraft = false) => {
    const activeLines = lines.filter(l => l.amount > 0);
    if (activeLines.length === 0) { toast.error("Add at least one expense item with an amount."); return; }

    try {
      for (const line of activeLines) {
        await createExpense.mutateAsync({
          title:         line.description.trim() || `${CATEGORIES.find(c => c.value === line.category)?.label ?? line.category} expense`,
          category:      line.category,
          amount:        line.amount,
          expenseDate:   date,
          paidBy:        department || undefined,
          paymentMethod: paymentMethod,
          reference:     line.receiptNo || project || undefined,
          notes:         notes || undefined,
        });
      }
      toast.success(asDraft
        ? `${activeLines.length} expense(s) saved as draft.`
        : `${activeLines.length} expense(s) submitted for approval.`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save expense.");
    }
  };

  const isPending = createExpense.isPending;

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
                <h2 className="text-base font-bold text-foreground">New Expense Claim</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Submit expenses for reimbursement</p>
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
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Expense Date *</label>
                  <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment Method</label>
                  <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Department / Paid By</label>
                  <select value={department} onChange={e => setDepartment(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="">Select department…</option>
                    {["IT", "Finance", "HR", "Sales", "Operations", "Marketing", "Management"].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Currency</label>
                  <select value={currency} onChange={e => setCurrency(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {["AED", "USD", "EUR", "GBP", "SAR"].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Project / Cost Centre <span className="text-muted-foreground/60 normal-case font-normal">(optional)</span></label>
                  <Input value={project} onChange={e => setProject(e.target.value)} placeholder="e.g. Dubai Marina Project" className="h-9 text-sm" />
                </div>
              </div>

              {/* Expense Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Expense Items</p>
                  <Button type="button" variant="outline" size="sm" onClick={addLine} className="h-7 text-xs gap-1">
                    <Plus className="w-3 h-3" /> Add Item
                  </Button>
                </div>
                <div className="space-y-2.5">
                  {lines.map((line, idx) => (
                    <div key={line.id} className="bg-muted/20 rounded-xl p-3 border border-border">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-muted-foreground w-4">{idx + 1}</span>
                        <select value={line.category} onChange={e => updateLine(line.id, "category", e.target.value)}
                          className="flex-1 h-8 px-2 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
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
                          placeholder="Description…" className="h-8 text-xs col-span-2" />
                        <Input value={line.receiptNo} onChange={e => updateLine(line.id, "receiptNo", e.target.value)}
                          placeholder="Receipt / Ref #" className="h-8 text-xs" />
                        <button className="h-8 flex items-center gap-1.5 px-2 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors">
                          <Upload className="w-3 h-3" /> Attach Receipt
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="flex justify-between items-center px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Total Claim</span>
                </div>
                <span className="text-lg font-bold text-primary">{formatCurrency(totalAmount, currency)}</span>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes for Approver</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Trip purpose, client name, justification…"
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleSubmit(true)}
                  disabled={isPending || !date || totalAmount === 0}>
                  {isPending ? "Saving…" : "Save as Draft"}
                </Button>
                <Button onClick={() => handleSubmit(false)}
                  disabled={isPending || !date || !department || totalAmount === 0}>
                  {isPending ? "Submitting…" : "Submit for Approval"}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
