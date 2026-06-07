import * as React from "react";
import { ArrowDownToLine, ArrowUpFromLine, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRecordCashMovement } from "@/hooks/pos/use-sessions";
import { useHardware } from "@/contexts/hardware-context";

interface CashMovementDialogProps {
  open:      boolean;
  sessionId: string;
  currency:  string;
  onClose:   () => void;
}

/**
 * Pay-in / Pay-out dialog. Records a manual cash drawer movement against the
 * open session and kicks the drawer open so the cashier can add/remove cash.
 */
export function CashMovementDialog({ open, sessionId, currency, onClose }: CashMovementDialogProps) {
  const [type, setType]     = React.useState<"payin" | "payout">("payin");
  const [amount, setAmount] = React.useState("");
  const [reason, setReason] = React.useState("");

  const record = useRecordCashMovement();
  const { openDrawer } = useHardware();

  React.useEffect(() => {
    if (open) { setType("payin"); setAmount(""); setReason(""); }
  }, [open]);

  if (!open) return null;

  const amt = parseFloat(amount) || 0;
  const canSubmit = amt > 0 && reason.trim().length > 0 && !record.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      await record.mutateAsync({ sessionId, type, amount: amt, reason: reason.trim() });
      await openDrawer().catch(() => {});
      onClose();
    } catch { /* toast in hook */ }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-bold">Cash In / Out</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted/60 text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Type toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setType("payin")}
              className={cn("flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all",
                type === "payin" ? "border-success bg-success/10 text-success" : "border-border text-muted-foreground hover:border-success/40")}>
              <ArrowDownToLine className="h-4 w-4" /> Cash In
            </button>
            <button type="button" onClick={() => setType("payout")}
              className={cn("flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all",
                type === "payout" ? "border-destructive bg-destructive/10 text-destructive" : "border-border text-muted-foreground hover:border-destructive/40")}>
              <ArrowUpFromLine className="h-4 w-4" /> Cash Out
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amount ({currency})</label>
            <Input autoFocus type="number" min={0} step="0.01" value={amount}
              onChange={e => setAmount(e.target.value)} placeholder="0.00" className="h-10 text-right text-base font-bold" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reason</label>
            <Input value={reason} onChange={e => setReason(e.target.value)}
              placeholder={type === "payin" ? "e.g. Float top-up" : "e.g. Petty cash, supplier paid"} className="h-9 text-sm" />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={record.isPending}>Cancel</Button>
            <Button type="submit" disabled={!canSubmit}
              className={type === "payout" ? "bg-destructive hover:bg-destructive/90" : "bg-success hover:bg-success/90"}>
              {record.isPending ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Recording…</>
                : type === "payin" ? "Record Cash In" : "Record Cash Out"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
