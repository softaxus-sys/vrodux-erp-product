import * as React from "react";
import { Plus, X, Trash2, Loader2, SplitSquareHorizontal } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PaymentRequest } from "@/lib/pos/types";

interface PayMethod { id: string; label: string; icon: React.ElementType; color?: string; bg?: string }

interface SplitPaymentDialogProps {
  open:           boolean;
  total:          number;
  currency:       string;
  paymentMethods: PayMethod[];
  pending:        boolean;
  onComplete:     (payments: PaymentRequest[]) => void;
  onClose:        () => void;
}

interface Line { method: string; amount: string }

/**
 * Split-tender dialog — compose a sale total from multiple payment methods
 * (e.g. part cash + part card). Sends a payments[] array to the backend.
 */
export function SplitPaymentDialog({ open, total, currency, paymentMethods, pending, onComplete, onClose }: SplitPaymentDialogProps) {
  const [lines, setLines] = React.useState<Line[]>([]);

  React.useEffect(() => {
    if (open) {
      const first = paymentMethods[0]?.id ?? "Cash";
      setLines([{ method: first, amount: total.toFixed(2) }]);
    }
  }, [open, total, paymentMethods]);

  if (!open) return null;

  const paid      = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const remaining = Math.max(0, total - paid);
  const change    = Math.max(0, paid - total);
  const canComplete = paid >= total - 0.001 && !pending;

  const addLine = () => {
    const used = new Set(lines.map(l => l.method));
    const next = paymentMethods.find(m => !used.has(m.id))?.id ?? paymentMethods[0]?.id ?? "Cash";
    setLines(prev => [...prev, { method: next, amount: remaining > 0 ? remaining.toFixed(2) : "" }]);
  };
  const updateLine = (i: number, patch: Partial<Line>) =>
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  const removeLine = (i: number) => setLines(prev => prev.filter((_, idx) => idx !== i));

  const handleComplete = () => {
    if (!canComplete) return;
    const payments: PaymentRequest[] = lines
      .filter(l => (parseFloat(l.amount) || 0) > 0)
      .map(l => ({ method: l.method, amount: parseFloat(l.amount) || 0, reference: null }));
    onComplete(payments);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-bold flex items-center gap-2"><SplitSquareHorizontal className="h-4 w-4 text-primary" />Split Payment</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted/60 text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-5 space-y-3">
          {/* Total + status */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-muted/40 py-2">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total</p>
              <p className="text-sm font-bold tabular-nums">{formatCurrency(total, currency)}</p>
            </div>
            <div className="rounded-xl bg-primary/10 py-2">
              <p className="text-[10px] text-primary uppercase font-semibold">Paid</p>
              <p className="text-sm font-bold tabular-nums text-primary">{formatCurrency(paid, currency)}</p>
            </div>
            <div className={cn("rounded-xl py-2", remaining > 0 ? "bg-destructive/10" : "bg-success/10")}>
              <p className={cn("text-[10px] uppercase font-semibold", remaining > 0 ? "text-destructive" : "text-success")}>
                {remaining > 0 ? "Remaining" : "Change"}
              </p>
              <p className={cn("text-sm font-bold tabular-nums", remaining > 0 ? "text-destructive" : "text-success")}>
                {formatCurrency(remaining > 0 ? remaining : change, currency)}
              </p>
            </div>
          </div>

          {/* Payment lines */}
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={l.method}
                  onChange={e => updateLine(i, { method: e.target.value })}
                  className="h-9 rounded-lg border border-border bg-background px-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
                <Input type="number" min={0} step="0.01" value={l.amount}
                  onChange={e => updateLine(i, { amount: e.target.value })}
                  className="h-9 w-28 text-right text-sm" placeholder="0.00" />
                <button onClick={() => removeLine(i)} disabled={lines.length === 1}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-30">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <button onClick={addLine}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
            <Plus className="h-3.5 w-3.5" /> Add payment method
          </button>
          {remaining > 0 && lines.length > 0 && (
            <button onClick={() => updateLine(lines.length - 1, { amount: ((parseFloat(lines[lines.length - 1].amount) || 0) + remaining).toFixed(2) })}
              className="ml-3 text-xs text-muted-foreground hover:text-primary">
              fill remaining ({formatCurrency(remaining, currency)})
            </button>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button onClick={handleComplete} disabled={!canComplete} className="font-bold">
            {pending ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Processing…</> : `Complete — ${formatCurrency(total, currency)}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
