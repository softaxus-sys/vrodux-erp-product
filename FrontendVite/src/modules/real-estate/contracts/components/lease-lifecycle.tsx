import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ArrowRight, Check, Clock, Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Can } from "@/components/auth/can";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  TERMINATION_REASONS,
  type ContractDto, type LeaseHistoryItemDto, type LeaseTerminationDto,
  type PaymentFrequency, type RentInstallmentDto,
} from "@/lib/real-estate/re.api";
import {
  useRenewContract, useSettleTermination, useTerminateContract,
  useTerminationPreview, useWithdrawTermination,
} from "@/hooks/real-estate/use-re";

// Calendar dates are handled as plain yyyy-MM-dd strings in UTC, so a lease date never shifts a
// day because of the viewer's time zone.
const TODAY = () => new Date().toISOString().split("T")[0];

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

function addYears(iso: string, years: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().split("T")[0];
}

const REASON_LABEL: Record<string, string> =
  Object.fromEntries(TERMINATION_REASONS.map(r => [r.value, r.label]));

const selectCls = "w-full h-9 text-sm rounded-md border border-input bg-card px-3";

// ── Shared dialog shell (sits inside the lease drawer) ──────────────────────

function Dialog({
  title, subtitle, onClose, children, footer,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50 z-[60]" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
        className="absolute inset-x-4 top-6 bottom-6 z-[61] bg-background border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-start justify-between px-5 py-4 border-b border-border">
          <div>
            <p className="font-semibold text-sm">{title}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">{children}</div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">{footer}</div>
      </motion.div>
    </>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function Line({ label, value, strong, tone }: {
  label: string; value: string; strong?: boolean; tone?: "good" | "bad";
}) {
  return (
    <div className={cn("flex justify-between gap-4 text-sm", strong && "font-semibold")}>
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      <span className={cn(tone === "good" && "text-success", tone === "bad" && "text-destructive")}>{value}</span>
    </div>
  );
}

// ── Renew ───────────────────────────────────────────────────────────────────

export function RenewLeaseModal({
  contract, installments, currency, onClose, onRenewed,
}: {
  contract: ContractDto;
  installments: RentInstallmentDto[];
  currency: string;
  onClose: () => void;
  /** Called with the new lease's id, so the drawer can move on to it. */
  onRenewed: (id: string) => void;
}) {
  // Starts the day after the current lease ends, for the same length of time as a year's lease.
  const defaultStart = addDays(contract.endDate, 1);

  const [startDate, setStartDate] = React.useState(defaultStart);
  const [endDate, setEndDate]     = React.useState(addDays(addYears(defaultStart, 1), -1));
  const [rent, setRent]           = React.useState(String(contract.annualRent));
  const [deposit, setDeposit]     = React.useState(String(contract.securityDeposit));
  const [frequency, setFrequency] = React.useState<PaymentFrequency>(contract.paymentFrequency);
  const [ejari, setEjari]         = React.useState("");
  const [notes, setNotes]         = React.useState("");
  const [advance, setAdvance]     = React.useState("");

  const renew = useRenewContract();

  const rentValue    = parseFloat(rent) || 0;
  const depositValue = parseFloat(deposit) || 0;
  const advanceValue = parseFloat(advance) || 0;

  const change = contract.annualRent > 0
    ? ((rentValue - contract.annualRent) / contract.annualRent) * 100
    : 0;

  const outstanding = installments
    .filter(i => !["paid", "waived", "cancelled"].includes(i.status))
    .reduce((s, i) => s + i.balance, 0);

  // Mirrors the server rules so the impossible cases cannot be submitted.
  const overlaps = startDate <= contract.endDate;
  const badTerm  = !!startDate && !!endDate && endDate <= startDate;
  const valid    = !!startDate && !!endDate && !overlaps && !badTerm && rentValue > 0 && depositValue >= 0;

  const applyIncrease = (pct: number) =>
    setRent(String(Math.round(contract.annualRent * (1 + pct / 100) * 100) / 100));

  const submit = async () => {
    try {
      const created = await renew.mutateAsync({
        id: contract.id,
        data: {
          startDate, endDate, annualRent: rentValue, securityDeposit: depositValue,
          paymentFrequency: frequency,
          ejariNumber: ejari.trim() || null,
          notes: notes.trim() || null,
          advanceRentAmount: advanceValue > 0 ? advanceValue : 0,
          advancePaidDate: advanceValue > 0 ? TODAY() : undefined,
        },
      });
      onRenewed(created.id);
    } catch {
      // The hook already showed the error; the dialog stays open so nothing typed is lost.
    }
  };

  return (
    <Dialog title="Renew lease"
      subtitle={`${contract.propertyName} · Unit ${contract.unitNumber} · ${contract.tenantName}`}
      onClose={onClose}
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={!valid || renew.isPending}>
          {renew.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
          Renew lease
        </Button>
      </>}>

      <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        The current lease ({formatDate(contract.startDate)} → {formatDate(contract.endDate)}) is kept as it is
        and marked renewed. A new lease is created for the next term with its own rent schedule.
      </div>

      {outstanding > 0.005 && (
        <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-xs">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <p>
            {formatCurrency(outstanding, currency)} is still unpaid on the current lease. It stays owed
            and keeps being chased after the renewal.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="New term starts">
          <Input type="date" value={startDate} min={addDays(contract.endDate, 1)}
            onChange={e => setStartDate(e.target.value)}
            className={cn("h-9 text-sm", overlaps && "border-destructive")} />
        </Field>
        <Field label="New term ends">
          <Input type="date" value={endDate} min={startDate}
            onChange={e => setEndDate(e.target.value)}
            className={cn("h-9 text-sm", badTerm && "border-destructive")} />
        </Field>
      </div>
      {overlaps && (
        <p className="text-xs text-destructive">
          The renewal must start after the current lease ends ({formatDate(contract.endDate)}).
        </p>
      )}
      {badTerm && <p className="text-xs text-destructive">The end date must be after the start date.</p>}

      <Field label="Annual rent"
        hint={Math.abs(change) < 0.005
          ? `Same as now (${formatCurrency(contract.annualRent, currency)}).`
          : `${change > 0 ? "+" : ""}${change.toFixed(2)}% on the current ${formatCurrency(contract.annualRent, currency)}.`}>
        <div className="flex gap-2">
          <Input type="number" min={0} step="0.01" value={rent} onChange={e => setRent(e.target.value)}
            className="h-9 text-sm text-right flex-1" />
          {[0, 5, 10].map(p => (
            <Button key={p} type="button" size="sm" variant="outline" className="h-9 px-2 text-xs"
              onClick={() => applyIncrease(p)}>
              {p === 0 ? "Same" : `+${p}%`}
            </Button>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Payment frequency">
          <select value={frequency} onChange={e => setFrequency(e.target.value as PaymentFrequency)} className={selectCls}>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="semi_annual">Half-yearly</option>
            <option value="annual">Annual</option>
          </select>
        </Field>
        <Field label="Security deposit"
          hint={Math.abs(depositValue - contract.securityDeposit) < 0.005
            ? "Carried over from the current lease."
            : depositValue > contract.securityDeposit
              ? `${formatCurrency(depositValue - contract.securityDeposit, currency)} more to collect.`
              : `${formatCurrency(contract.securityDeposit - depositValue, currency)} to give back.`}>
          <Input type="number" min={0} step="0.01" value={deposit} onChange={e => setDeposit(e.target.value)}
            className="h-9 text-sm text-right" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Ejari / registration no.">
          <Input value={ejari} onChange={e => setEjari(e.target.value)} className="h-9 text-sm"
            placeholder="For the new term" />
        </Field>
        <Field label="Rent received now (optional)" hint="Settles the first payments of the new term.">
          <Input type="number" min={0} step="0.01" value={advance} onChange={e => setAdvance(e.target.value)}
            className="h-9 text-sm text-right" />
        </Field>
      </div>

      <Field label="Notes">
        <Input value={notes} onChange={e => setNotes(e.target.value)} className="h-9 text-sm" />
      </Field>
    </Dialog>
  );
}

// ── Terminate ───────────────────────────────────────────────────────────────

export function TerminateLeaseModal({
  contract, currency, onClose,
}: {
  contract: ContractDto;
  currency: string;
  onClose: () => void;
}) {
  const today = TODAY();
  // Today, kept inside the lease's own term.
  const initial = today < contract.startDate ? contract.startDate
    : today > contract.endDate ? contract.endDate : today;

  const [date, setDate]             = React.useState(initial);
  const [noticeDate, setNoticeDate] = React.useState("");
  const [reason, setReason]         = React.useState("tenant_request");
  const [reasonNotes, setReasonNotes] = React.useState("");
  const [penalty, setPenalty]       = React.useState("");
  const [deductions, setDeductions] = React.useState("");
  const [deductionNotes, setDeductionNotes] = React.useState("");

  const penaltyValue    = Math.max(0, parseFloat(penalty) || 0);
  const deductionsValue = Math.max(0, parseFloat(deductions) || 0);

  const outOfTerm = !!date && (date < contract.startDate || date > contract.endDate);
  const badNotice = !!noticeDate && noticeDate > date;

  const { data: statement, isFetching } =
    useTerminationPreview(outOfTerm ? null : contract.id, date, penaltyValue, deductionsValue);

  const terminate = useTerminateContract();
  const valid = !!date && !outOfTerm && !badNotice && !!statement;

  const submit = async () => {
    try {
      await terminate.mutateAsync({
        id: contract.id,
        data: {
          terminationDate: date,
          noticeDate: noticeDate || null,
          reason,
          reasonNotes: reasonNotes.trim() || null,
          penaltyAmount: penaltyValue,
          deductionsAmount: deductionsValue,
          deductionNotes: deductionNotes.trim() || null,
        },
      });
      onClose();
    } catch {
      // The hook already showed the error.
    }
  };

  const net = statement?.netSettlement ?? 0;

  return (
    <Dialog title="Terminate lease"
      subtitle={`${contract.contractNumber} · ${contract.tenantName}`}
      onClose={onClose}
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant="destructive" onClick={submit} disabled={!valid || terminate.isPending}>
          {terminate.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
          {statement && !statement.takesEffectNow ? "Record notice" : "Terminate lease"}
        </Button>
      </>}>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Last day in the unit">
          <Input type="date" value={date} min={contract.startDate} max={contract.endDate}
            onChange={e => setDate(e.target.value)}
            className={cn("h-9 text-sm", outOfTerm && "border-destructive")} />
        </Field>
        <Field label="Notice received on (optional)">
          <Input type="date" value={noticeDate} max={date}
            onChange={e => setNoticeDate(e.target.value)}
            className={cn("h-9 text-sm", badNotice && "border-destructive")} />
        </Field>
      </div>
      {outOfTerm && (
        <p className="text-xs text-destructive">
          The date must fall inside the lease term ({formatDate(contract.startDate)} → {formatDate(contract.endDate)}).
        </p>
      )}
      {badNotice && <p className="text-xs text-destructive">Notice cannot be dated after the last day.</p>}

      <Field label="Reason">
        <select value={reason} onChange={e => setReason(e.target.value)} className={selectCls}>
          {TERMINATION_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </Field>
      <Field label="Details">
        <Input value={reasonNotes} onChange={e => setReasonNotes(e.target.value)} className="h-9 text-sm" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Early termination penalty">
          <Input type="number" min={0} step="0.01" value={penalty} onChange={e => setPenalty(e.target.value)}
            className="h-9 text-sm text-right" placeholder="0.00" />
        </Field>
        <Field label="Damages / other deductions">
          <Input type="number" min={0} step="0.01" value={deductions} onChange={e => setDeductions(e.target.value)}
            className="h-9 text-sm text-right" placeholder="0.00" />
        </Field>
      </div>
      {deductionsValue > 0 && (
        <Field label="What the deductions are for">
          <Input value={deductionNotes} onChange={e => setDeductionNotes(e.target.value)} className="h-9 text-sm"
            placeholder="Repainting, missing keys…" />
        </Field>
      )}

      {statement && !outOfTerm && (
        <div className={cn("rounded-lg border border-border p-3 space-y-1.5", isFetching && "opacity-60")}>
          <p className="text-xs font-semibold mb-1">Final account as at {formatDate(statement.terminationDate)}</p>
          <Line label="Rent owed to that day" value={formatCurrency(statement.rentOwed, currency)} />
          <Line label="Rent paid" value={formatCurrency(statement.rentPaid, currency)} />
          {statement.rentArrears > 0 &&
            <Line label="Rent still owed" value={`− ${formatCurrency(statement.rentArrears, currency)}`} tone="bad" />}
          {statement.rentRefund > 0 &&
            <Line label="Rent paid ahead" value={`+ ${formatCurrency(statement.rentRefund, currency)}`} tone="good" />}
          <Line label="Security deposit held" value={`+ ${formatCurrency(statement.depositHeld, currency)}`} />
          {statement.penaltyAmount > 0 &&
            <Line label="Penalty" value={`− ${formatCurrency(statement.penaltyAmount, currency)}`} />}
          {statement.deductionsAmount > 0 &&
            <Line label="Deductions" value={`− ${formatCurrency(statement.deductionsAmount, currency)}`} />}
          <div className="border-t border-border pt-1.5">
            <Line strong
              label={net >= 0 ? "Refund due to tenant" : "Tenant still owes"}
              value={formatCurrency(Math.abs(net), currency)}
              tone={net >= 0 ? "good" : "bad"} />
          </div>
          {statement.installmentsCancelled > 0 && (
            <p className="text-[11px] text-muted-foreground pt-1">
              {statement.installmentsCancelled} later payment{statement.installmentsCancelled === 1 ? "" : "s"} worth{" "}
              {formatCurrency(statement.cancelledAmount, currency)} will be cancelled.
            </p>
          )}
        </div>
      )}

      {statement && !statement.takesEffectNow && !outOfTerm && (
        <div className="flex gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Clock className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            That date is still ahead, so this is recorded as notice. The lease stays active and rent up
            to that day is still collected; the lease ends and the unit is freed on {formatDate(date)}.
            The figures above are worked out again on the day.
          </p>
        </div>
      )}
      {statement?.takesEffectNow && !outOfTerm && (
        <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <p>The lease ends now and the unit is marked vacant. This cannot be undone.</p>
        </div>
      )}
    </Dialog>
  );
}

// ── Termination on record: the card shown on the lease ──────────────────────

const TERMINATION_LABEL: Record<string, { label: string; cls: string }> = {
  scheduled:          { label: "Notice given",       cls: "bg-warning/10 text-warning" },
  pending_settlement: { label: "Settlement pending", cls: "bg-destructive/10 text-destructive" },
  settled:            { label: "Settled",            cls: "bg-success/10 text-success" },
};

export function TerminationCard({
  termination, currency,
}: {
  termination: LeaseTerminationDto;
  currency: string;
}) {
  const [settling, setSettling] = React.useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = React.useState(false);
  const withdraw = useWithdrawTermination();

  const net   = termination.netSettlement;
  const badge = TERMINATION_LABEL[termination.status] ?? TERMINATION_LABEL.settled;

  return (
    <div className="rounded-lg border border-border p-3 mb-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-sm font-semibold">
          {termination.status === "scheduled" ? "Ends" : "Ended"} {formatDate(termination.terminationDate)}
        </p>
        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", badge.cls)}>{badge.label}</span>
      </div>

      <p className="text-xs text-muted-foreground mb-2">
        {REASON_LABEL[termination.reason] ?? termination.reason}
        {termination.reasonNotes ? ` — ${termination.reasonNotes}` : ""}
        {termination.noticeDate ? ` · notice ${formatDate(termination.noticeDate)}` : ""}
        {termination.recordedByName ? ` · recorded by ${termination.recordedByName}` : ""}
      </p>

      <div className="space-y-1">
        <Line label="Rent owed to that day" value={formatCurrency(termination.rentOwed, currency)} />
        <Line label="Rent paid" value={formatCurrency(termination.rentPaid, currency)} />
        <Line label="Security deposit held" value={formatCurrency(termination.depositHeld, currency)} />
        {termination.penaltyAmount > 0 &&
          <Line label="Penalty" value={`− ${formatCurrency(termination.penaltyAmount, currency)}`} />}
        {termination.deductionsAmount > 0 &&
          <Line label={termination.deductionNotes ? `Deductions (${termination.deductionNotes})` : "Deductions"}
            value={`− ${formatCurrency(termination.deductionsAmount, currency)}`} />}
        <div className="border-t border-border pt-1">
          <Line strong
            label={Math.abs(net) < 0.01 ? "Nothing owed either way"
              : net > 0 ? "Refund due to tenant" : "Tenant still owes"}
            value={formatCurrency(Math.abs(net), currency)}
            tone={Math.abs(net) < 0.01 ? undefined : net > 0 ? "good" : "bad"} />
        </div>
      </div>

      {termination.status === "scheduled" && (
        <p className="text-[11px] text-muted-foreground mt-2">
          Estimate. The account is worked out again on the day the lease ends.
        </p>
      )}

      {termination.status === "settled" && termination.settledOn && (
        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5 text-success" />
          Settled {formatDate(termination.settledOn)}
          {termination.settlementMethod ? ` · ${termination.settlementMethod.replace("_", " ")}` : ""}
          {termination.settlementReference ? ` · ${termination.settlementReference}` : ""}
        </p>
      )}

      <div className="flex justify-end gap-2 mt-3">
        {termination.status === "scheduled" && (
          <Can permission="real-estate.contracts.edit">
            {confirmWithdraw ? (
              <>
                <span className="text-xs text-muted-foreground self-center me-auto">Keep the lease running?</span>
                <Button size="sm" variant="outline" onClick={() => setConfirmWithdraw(false)}>No</Button>
                <Button size="sm" disabled={withdraw.isPending}
                  onClick={async () => {
                    try { await withdraw.mutateAsync(termination.contractId); } catch { /* hook toasts */ }
                    setConfirmWithdraw(false);
                  }}>
                  {withdraw.isPending && <Loader2 className="w-3.5 h-3.5 me-1.5 animate-spin" />}
                  Yes, withdraw notice
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setConfirmWithdraw(true)}>Withdraw notice</Button>
            )}
          </Can>
        )}
        {termination.status === "pending_settlement" && (
          <Can permission="real-estate.rent.record">
            <Button size="sm" onClick={() => setSettling(true)}>
              {net > 0 ? "Record refund paid" : "Record amount collected"}
            </Button>
          </Can>
        )}
      </div>

      <AnimatePresence>
        {settling && (
          <SettleModal termination={termination} currency={currency} onClose={() => setSettling(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function SettleModal({
  termination, currency, onClose,
}: {
  termination: LeaseTerminationDto;
  currency: string;
  onClose: () => void;
}) {
  const [settledOn, setSettledOn] = React.useState(TODAY());
  const [method, setMethod]       = React.useState("bank_transfer");
  const [reference, setReference] = React.useState("");
  const [notes, setNotes]         = React.useState("");
  const settle = useSettleTermination();

  const net = termination.netSettlement;

  const submit = async () => {
    try {
      await settle.mutateAsync({
        id: termination.contractId,
        data: { settledOn, method, reference: reference.trim() || null, notes: notes.trim() || null },
      });
      onClose();
    } catch {
      // The hook already showed the error.
    }
  };

  return (
    <Dialog title="Settle final account"
      subtitle={net > 0
        ? `Refund ${formatCurrency(net, currency)} to the tenant`
        : `Collect ${formatCurrency(Math.abs(net), currency)} from the tenant`}
      onClose={onClose}
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={!settledOn || settle.isPending}>
          {settle.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
          Mark settled
        </Button>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label={net > 0 ? "Refunded on" : "Collected on"}>
          <Input type="date" value={settledOn} onChange={e => setSettledOn(e.target.value)} className="h-9 text-sm" />
        </Field>
        <Field label="Method">
          <select value={method} onChange={e => setMethod(e.target.value)} className={selectCls}>
            <option value="bank_transfer">Bank transfer</option>
            <option value="cheque">Cheque</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="other">Other</option>
          </select>
        </Field>
      </div>
      <Field label="Reference">
        <Input value={reference} onChange={e => setReference(e.target.value)} className="h-9 text-sm"
          placeholder="Cheque no. / txn id" />
      </Field>
      <Field label="Notes">
        <Input value={notes} onChange={e => setNotes(e.target.value)} className="h-9 text-sm" />
      </Field>
    </Dialog>
  );
}

// ── Renewal history ─────────────────────────────────────────────────────────

export function LeaseHistory({
  history, currentId, currency, onOpen,
}: {
  history: LeaseHistoryItemDto[];
  currentId: string;
  currency: string;
  onOpen: (id: string) => void;
}) {
  if (history.length < 2) return null;

  return (
    <div className="pt-3">
      <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
        <RefreshCw className="w-3 h-3" /> Tenancy history
      </p>
      <div className="space-y-1.5">
        {history.map((h, index) => {
          const previous = index > 0 ? history[index - 1] : null;
          const change = previous && previous.annualRent > 0
            ? ((h.annualRent - previous.annualRent) / previous.annualRent) * 100
            : null;
          const isCurrent = h.id === currentId;

          return (
            <button key={h.id} disabled={isCurrent} onClick={() => onOpen(h.id)}
              className={cn("w-full flex items-center gap-3 rounded-lg border px-3 py-2 text-start",
                isCurrent ? "border-primary/40 bg-primary/5" : "border-border hover:bg-muted/30")}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {h.renewalNumber === 0 ? "Original lease" : `Renewal ${h.renewalNumber}`}
                  <span className="font-mono text-[11px] text-muted-foreground ms-2">{h.contractNumber}</span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {formatDate(h.startDate)} → {formatDate(h.endDate)} · {h.status}
                </p>
              </div>
              <div className="text-end shrink-0">
                <p className="text-sm font-semibold">{formatCurrency(h.annualRent, currency)}</p>
                {change !== null && Math.abs(change) >= 0.005 && (
                  <p className={cn("text-[11px]", change > 0 ? "text-success" : "text-destructive")}>
                    {change > 0 ? "+" : ""}{change.toFixed(1)}%
                  </p>
                )}
              </div>
              {!isCurrent && <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 rtl:rotate-180" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
