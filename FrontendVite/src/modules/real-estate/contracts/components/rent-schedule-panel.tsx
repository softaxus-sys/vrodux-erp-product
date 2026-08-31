import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Bell, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Can, useCan } from "@/components/auth/can";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import type { ContractDto, RentInstallmentDto } from "@/lib/real-estate/re.api";
import {
  useGenerateSchedule, useRecordRentPayment, useSendRentReminder, useWaiveInstallment,
} from "@/hooks/real-estate/use-re";

const TODAY = () => new Date().toISOString().split("T")[0];

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-muted text-muted-foreground" },
  partial: { label: "Partial", cls: "bg-warning/10 text-warning" },
  paid:    { label: "Paid",    cls: "bg-success/10 text-success" },
  waived:  { label: "Waived",  cls: "bg-slate-100 dark:bg-slate-800/50 text-muted-foreground" },
  overdue: { label: "Overdue", cls: "bg-destructive/10 text-destructive" },
};

// ── Record payment ──────────────────────────────────────────────────────────

function PaymentModal({
  contractId, installment, currency, onClose,
}: {
  contractId: string;
  installment: RentInstallmentDto;
  currency: string;
  onClose: () => void;
}) {
  // Defaults to the full outstanding balance, which is what is being collected almost every time.
  const [amount, setAmount]       = React.useState(String(installment.balance));
  const [paidDate, setPaidDate]   = React.useState(TODAY());
  const [method, setMethod]       = React.useState("cheque");
  const [reference, setReference] = React.useState("");
  const [notes, setNotes]         = React.useState("");

  const record = useRecordRentPayment();
  const value  = parseFloat(amount) || 0;

  // Mirrors the server rule, so the impossible case is unclickable rather than a round-trip error.
  const tooMuch = value > installment.balance + 0.01;
  const valid   = value > 0 && !tooMuch && !!paidDate;

  const submit = async () => {
    try {
      await record.mutateAsync({
        id: contractId, installmentId: installment.id,
        amount: value, paidDate, method, reference: reference.trim() || null, notes: notes.trim() || null,
      });
      onClose();
    } catch {
      // The hook already surfaced the error; keep the dialog open so the entry is not lost.
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm z-[60]" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="absolute inset-x-4 top-16 z-[61] bg-background border border-border rounded-xl shadow-2xl p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="font-semibold text-sm">Record payment</p>
            <p className="text-xs text-muted-foreground">
              Installment {installment.installmentNumber} &middot; due {formatDate(installment.dueDate)}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Amount</label>
              <Input type="number" min={0} step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
                className={cn("h-9 text-sm text-right", tooMuch && "border-destructive")} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Date received</label>
              <Input type="date" value={paidDate} onChange={e => setPaidDate(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>

          {tooMuch && (
            <p className="text-xs text-destructive">
              That is more than the {formatCurrency(installment.balance, currency)} outstanding. Record it against
              the installment it actually pays.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Method</label>
              <select value={method} onChange={e => setMethod(e.target.value)}
                className="w-full h-9 text-sm rounded-md border border-input bg-card px-3">
                <option value="cheque">Cheque</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Reference</label>
              <Input value={reference} onChange={e => setReference(e.target.value)}
                placeholder="Cheque no. / txn id" className="h-9 text-sm" />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Notes</label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} className="h-9 text-sm" />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!valid || record.isPending}>
            {record.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
            Record {formatCurrency(value, currency)}
          </Button>
        </div>
      </motion.div>
    </>
  );
}

// ── Schedule ────────────────────────────────────────────────────────────────

export function RentSchedulePanel({
  contract, installments,
}: {
  contract: ContractDto;
  installments: RentInstallmentDto[];
}) {
  const currency = useCurrency();
  const [paying, setPaying]   = React.useState<RentInstallmentDto | null>(null);
  const [waiving, setWaiving] = React.useState<RentInstallmentDto | null>(null);
  const [reason, setReason]   = React.useState("");

  const generate = useGenerateSchedule();
  const waive    = useWaiveInstallment();
  const remind   = useSendRentReminder();

  const canRecord = useCan("real-estate.rent.record");

  const collected  = installments.reduce((s, i) => s + i.amountPaid, 0);
  const outstanding = installments.filter(i => i.status !== "waived").reduce((s, i) => s + i.balance, 0);

  if (installments.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-sm text-muted-foreground mb-1">No rent schedule on this lease.</p>
        <p className="text-xs text-muted-foreground mb-4">
          Without one nothing knows when rent falls due, so no reminders can be sent.
        </p>
        <Can permission="real-estate.contracts.edit">
          <Button size="sm" onClick={() => generate.mutate({ id: contract.id })} disabled={generate.isPending}>
            {generate.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
            Generate schedule
          </Button>
        </Can>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-lg border border-border p-3">
          <p className="text-[11px] text-muted-foreground">Collected</p>
          <p className="text-sm font-semibold text-success">{formatCurrency(collected, currency)}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-[11px] text-muted-foreground">Outstanding</p>
          <p className="text-sm font-semibold">{formatCurrency(outstanding, currency)}</p>
        </div>
        <div className={cn("rounded-lg border p-3", contract.overdueCount > 0 ? "border-destructive/40 bg-destructive/5" : "border-border")}>
          <p className="text-[11px] text-muted-foreground">Overdue</p>
          <p className={cn("text-sm font-semibold", contract.overdueCount > 0 && "text-destructive")}>
            {contract.overdueCount > 0 ? formatCurrency(contract.overdueAmount, currency) : "None"}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        {installments.map(i => {
          const s = STATUS[i.status] ?? STATUS.pending;
          return (
            <div key={i.id}
              className={cn("flex items-center gap-3 rounded-lg border px-3 py-2.5",
                i.status === "overdue" ? "border-destructive/40 bg-destructive/5" : "border-border")}>
              <span className="w-7 h-7 shrink-0 rounded-full bg-muted grid place-items-center text-[11px] font-semibold">
                {i.installmentNumber}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{formatDate(i.dueDate)}</p>
                  <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", s.cls)}>{s.label}</span>
                  {i.status === "overdue" && (
                    <span className="text-[10px] text-destructive font-medium">
                      {i.daysOverdue} day{i.daysOverdue === 1 ? "" : "s"} late
                    </span>
                  )}
                </div>
                {i.paidDate && (
                  <p className="text-[11px] text-muted-foreground">
                    Paid {formatDate(i.paidDate)}{i.reference ? ` · ${i.reference}` : ""}
                  </p>
                )}
              </div>

              <div className="text-end shrink-0">
                <p className="text-sm font-semibold">{formatCurrency(i.amount, currency)}</p>
                {i.balance > 0 && i.amountPaid > 0 && (
                  <p className="text-[11px] text-muted-foreground">{formatCurrency(i.balance, currency)} left</p>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {i.status !== "paid" && i.status !== "waived" && canRecord && (
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                    onClick={() => setPaying(i)}>
                    <Check className="w-3.5 h-3.5 me-1" /> Pay
                  </Button>
                )}
                {i.status !== "paid" && i.status !== "waived" && (
                  <Can permission="real-estate.rent.remind">
                    <Button size="sm" variant="ghost" className="h-7 px-2"
                      title="Send this tenant the reminder now"
                      disabled={remind.isPending}
                      onClick={() => remind.mutate({ id: contract.id, installmentId: i.id })}>
                      <Bell className="w-3.5 h-3.5" />
                    </Button>
                  </Can>
                )}
                {i.status !== "paid" && i.status !== "waived" && canRecord && (
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground"
                    title="Waive this installment" onClick={() => { setWaiving(i); setReason(""); }}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {paying && (
          <PaymentModal contractId={contract.id} installment={paying} currency={currency}
            onClose={() => setPaying(null)} />
        )}

        {waiving && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm z-[60]" onClick={() => setWaiving(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
              className="absolute inset-x-4 top-24 z-[61] bg-background border border-border rounded-xl shadow-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                <p className="font-semibold text-sm">Waive installment {waiving.installmentNumber}?</p>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                It stops counting as owed and stops generating reminders. It is not deleted, and the
                reason is kept on the record.
              </p>
              <Input value={reason} onChange={e => setReason(e.target.value)}
                placeholder="Reason (recommended)" className="h-9 text-sm" />
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setWaiving(null)}>Cancel</Button>
                <Button variant="destructive" disabled={waive.isPending}
                  onClick={async () => {
                    try {
                      await waive.mutateAsync({ id: contract.id, installmentId: waiving.id, reason: reason.trim() || null });
                      setWaiving(null);
                    } catch { /* hook toasts */ }
                  }}>
                  {waive.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                  Waive
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
