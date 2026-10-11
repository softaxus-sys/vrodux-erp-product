import * as React from "react";
import { X, Loader2, HandCoins, ShieldAlert, AlertTriangle, CalendarClock } from "lucide-react";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCustomerCredit } from "@/hooks/pos/use-credit";
import type { PaymentRequest } from "@/lib/pos/types";
import type { SelectedCustomer } from "./customer-select";

interface PayMethod { id: string; label: string }

/** What the receipt needs to print about the credit part of a sale. */
export interface CreditReceiptInfo { amount: number; dueOn: string; customerName: string; balanceAfter: number }

interface Props {
  open: boolean;
  total: number;
  currency: string;
  customer: SelectedCustomer | null;
  paymentMethods: PayMethod[];
  pending: boolean;
  onComplete: (payments: PaymentRequest[], credit: CreditReceiptInfo) => void;
  onClose: () => void;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Sell on credit. Shows the customer's standing first (limit, what they owe, anything late), then lets the
 * cashier choose how much goes on their account and how the rest is paid now. The server checks every rule
 * again; this screen only makes the right thing obvious and the wrong thing impossible to submit.
 */
export function CreditSaleDialog({ open, total, currency, customer, paymentMethods, pending, onComplete, onClose }: Props) {
  const { data: c, isLoading, isError, error } = useCustomerCredit(customer?.id, open);
  const [creditText, setCreditText] = React.useState("");
  const [restMethod, setRestMethod] = React.useState("Cash");

  const restMethods = React.useMemo(() => paymentMethods.filter(m => m.id !== "HouseAccount" && m.id !== "StoreCredit"), [paymentMethods]);

  const blockedReason = !c ? null
    : c.onHold ? `Credit is stopped${c.holdReason ? `: ${c.holdReason}` : ""}.`
    : c.creditLimit <= 0 ? "This customer has no credit limit. A manager can set one on their record."
    : c.availableCredit <= 0 ? "This customer has used all of their credit limit."
    : null;

  const maxCredit = c ? round2(Math.min(total, c.availableCredit)) : 0;

  // Start from the most that fits: the usual case is "put it all on the account".
  React.useEffect(() => {
    if (open && c) setCreditText(String(maxCredit));
  }, [open, c?.customerId, maxCredit]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (open) setRestMethod(restMethods.find(m => m.id === "Cash")?.id ?? restMethods[0]?.id ?? "Cash");
  }, [open, restMethods]);

  if (!open) return null;

  const credit = Math.max(0, round2(parseFloat(creditText) || 0));
  const rest = round2(total - credit);
  const valid = !!c && !blockedReason && credit > 0 && credit <= maxCredit + 0.005 && rest >= -0.005;
  const dueOn = c ? new Date(Date.now() + c.termsDays * 86_400_000).toISOString().slice(0, 10) : null;
  const balanceAfter = c ? c.creditBalance + credit : 0;

  const submit = () => {
    if (!valid || !c || !dueOn) return;
    const payments: PaymentRequest[] = [{ method: "HouseAccount", amount: credit, reference: null }];
    if (rest > 0.005) payments.push({ method: restMethod, amount: rest, reference: null });
    onComplete(payments, { amount: credit, dueOn, customerName: c.name, balanceAfter });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()} role="dialog" aria-label="Sell on credit">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-bold flex items-center gap-2"><HandCoins className="h-4 w-4 text-primary" />Sell on credit</h2>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-lg hover:bg-muted/60 text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          {!customer ? (
            <p className="text-sm text-muted-foreground">Choose a customer first. Credit is only for customers on file, so there is someone to collect from.</p>
          ) : isLoading ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Checking {customer.name}'s account…</p>
          ) : isError || !c ? (
            <p className="text-sm text-destructive">Could not load this customer's credit account. {(error as Error)?.message}</p>
          ) : (
            <>
              {/* Standing */}
              <div className="rounded-xl border border-border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-sm truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground shrink-0">{c.termsDays} days to pay</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Mini label="Limit" value={formatCurrency(c.creditLimit, currency)} />
                  <Mini label="Owes now" value={formatCurrency(c.creditBalance, currency)} />
                  <Mini label="Available" value={formatCurrency(c.availableCredit, currency)} tone={c.availableCredit > 0 ? "text-success" : "text-destructive"} />
                </div>
                {c.creditLimit > 0 && (
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={cn("h-full", c.creditBalance >= c.creditLimit ? "bg-destructive" : c.creditBalance >= c.creditLimit * 0.8 ? "bg-warning" : "bg-primary")}
                      style={{ width: `${Math.min(100, (c.creditBalance / c.creditLimit) * 100)}%` }} />
                  </div>
                )}
              </div>

              {c.overdue > 0 && (
                <div className="rounded-xl border border-warning/40 bg-warning/5 p-3 text-xs flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <p><strong>{formatCurrency(c.overdue, currency)}</strong> is already overdue (oldest {c.oldestOverdueDays} days). Consider asking for payment before selling more on credit.</p>
                </div>
              )}

              {blockedReason ? (
                <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm flex gap-2">
                  <ShieldAlert className="h-4 w-4 text-destructive shrink-0 mt-0.5" /><p>{blockedReason}</p>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Put on {c.name.split(" ")[0]}'s account</label>
                    <Input type="number" min={0} step="0.01" value={creditText} autoFocus onChange={e => setCreditText(e.target.value)}
                      className="h-11 text-lg font-bold text-right" aria-label="Amount on credit" />
                    <div className="flex flex-wrap gap-2">
                      {maxCredit >= total - 0.005
                        ? <Chip onClick={() => setCreditText(String(total))}>All · {formatCurrency(total, currency)}</Chip>
                        : <Chip onClick={() => setCreditText(String(maxCredit))}>As much as fits · {formatCurrency(maxCredit, currency)}</Chip>}
                      {maxCredit > 1 && <Chip onClick={() => setCreditText(String(round2(maxCredit / 2)))}>Half</Chip>}
                    </div>
                    {credit > maxCredit + 0.005 && <p className="text-xs text-destructive">More than the {formatCurrency(maxCredit, currency)} this sale can take on credit.</p>}
                    {maxCredit < total - 0.005 && <p className="text-xs text-muted-foreground">Only {formatCurrency(c.availableCredit, currency)} of credit is left, so the rest is paid now.</p>}
                  </div>

                  {rest > 0.005 && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pay the other {formatCurrency(rest, currency)} now with</label>
                      <select value={restMethod} onChange={e => setRestMethod(e.target.value)} aria-label="Pay the rest with"
                        className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                        {restMethods.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                      </select>
                    </div>
                  )}

                  <div className="rounded-xl bg-muted/40 p-3 text-xs space-y-1">
                    <p className="flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />Due <strong>{dueOn ? formatDate(dueOn) : ""}</strong> ({c.termsDays} days)</p>
                    <p>After this sale {c.name} will owe <strong>{formatCurrency(balanceAfter, currency)}</strong>{c.creditLimit > 0 ? ` of ${formatCurrency(c.creditLimit, currency)}` : ""}.</p>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button onClick={submit} disabled={!valid || pending} className="font-bold">
            {pending ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Processing…</> : `Sell · ${formatCurrency(credit, currency)} on credit`}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-muted/40 py-1.5 px-1 min-w-0">
      <p className="text-[10px] text-muted-foreground uppercase font-semibold">{label}</p>
      <p className={cn("text-xs font-bold tabular-nums truncate", tone)} title={value}>{value}</p>
    </div>
  );
}

function Chip({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className="text-xs rounded-full border border-border px-2.5 py-1 hover:border-primary">{children}</button>;
}
