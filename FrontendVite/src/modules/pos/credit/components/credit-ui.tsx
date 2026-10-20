import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, Phone, MessageCircle, Mail, Printer, HandCoins, ShieldAlert, ShieldCheck, Loader2, CalendarClock, Banknote, CreditCard, Landmark, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Can } from "@/components/auth/can";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { exportPdf } from "@/lib/pdf";
import { useCurrency } from "@/hooks/use-currency";
import { useAuthStore } from "@/store/auth.store";
import { useRecordHouseAccountPayment, useSetCreditLimit } from "@/hooks/pos/use-customers";
import { useCustomerCredit, useRemindCustomer, useSetCreditHold, useSetCreditTerms } from "@/hooks/pos/use-credit";
import type { CreditAgeingDto, CustomerCreditDto } from "@/lib/pos/credit.api";

// ── Small pieces ─────────────────────────────────────────────────────────────

const BANDS: { key: keyof CreditAgeingDto; label: string; color: string }[] = [
  { key: "current", label: "Not due", color: "bg-success" },
  { key: "days1To30", label: "1–30 days late", color: "bg-warning" },
  { key: "days31To60", label: "31–60", color: "bg-orange-500" },
  { key: "days61To90", label: "61–90", color: "bg-destructive/80" },
  { key: "over90", label: "90+", color: "bg-destructive" },
];

/** One bar for what is owed, split by how late it is — the shape of the problem at a glance. */
export function AgeingBar({ ageing, compact }: { ageing: CreditAgeingDto; compact?: boolean }) {
  const currency = useCurrency();
  const total = ageing.total;
  return (
    <div className="space-y-2">
      <div className={cn("flex w-full overflow-hidden rounded-full bg-muted", compact ? "h-2" : "h-3")} role="img"
        aria-label={`Owed ${formatCurrency(total, currency)}; ${formatCurrency(ageing.overdue, currency)} overdue`}>
        {total > 0 && BANDS.map(b => {
          const v = ageing[b.key] as number;
          return v > 0 ? <div key={b.key} className={b.color} style={{ width: `${(v / total) * 100}%` }} title={`${b.label}: ${formatCurrency(v, currency)}`} /> : null;
        })}
      </div>
      {!compact && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {BANDS.map(b => (
            <span key={b.key} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("h-2 w-2 rounded-full", b.color)} />
              {b.label} <strong className="text-foreground tabular-nums">{formatCurrency(ageing[b.key] as number, currency)}</strong>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function CreditStatusChip({ onHold, overdue, oldestOverdueDays, balance, limit }: {
  onHold: boolean; overdue: number; oldestOverdueDays: number; balance: number; limit: number;
}) {
  if (onHold) return <Chip tone="destructive" icon={<ShieldAlert className="h-3 w-3" />}>On hold</Chip>;
  if (overdue > 0) return <Chip tone="destructive">{oldestOverdueDays} day{oldestOverdueDays === 1 ? "" : "s"} overdue</Chip>;
  if (limit > 0 && balance >= limit) return <Chip tone="warning">At limit</Chip>;
  if (limit > 0 && balance >= limit * 0.8) return <Chip tone="warning">Near limit</Chip>;
  if (balance > 0) return <Chip tone="success">Current</Chip>;
  return <Chip tone="muted">No balance</Chip>;
}

function Chip({ tone, icon, children }: { tone: "success" | "warning" | "destructive" | "muted"; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
      tone === "success" && "bg-success/10 text-success", tone === "warning" && "bg-warning/10 text-warning",
      tone === "destructive" && "bg-destructive/10 text-destructive", tone === "muted" && "bg-muted text-muted-foreground")}>
      {icon}{children}
    </span>
  );
}

function Stat({ label, value, tone, sub }: { label: string; value: string; tone?: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5 min-w-0">
      <p className="text-[11px] text-muted-foreground truncate">{label}</p>
      <p className={cn("text-base font-bold tabular-nums truncate", tone)} title={value}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground truncate">{sub}</p>}
    </div>
  );
}

// ── Collect a payment ────────────────────────────────────────────────────────

const METHODS = [
  { id: "cash", label: "Cash", icon: Banknote },
  { id: "card", label: "Card", icon: CreditCard },
  { id: "bank_transfer", label: "Bank transfer", icon: Landmark },
  { id: "cheque", label: "Cheque", icon: FileText },
];

/** Takes a payment against what the customer owes. Settles their oldest invoices first. */
export function CollectPaymentDialog({ credit, onClose }: { credit: CustomerCreditDto; onClose: () => void }) {
  const currency = useCurrency();
  const pay = useRecordHouseAccountPayment(credit.customerId);
  const [amount, setAmount] = React.useState(String(credit.creditBalance));
  const [method, setMethod] = React.useState("cash");
  const [note, setNote] = React.useState("");
  const value = Number(amount);
  const valid = amount.trim() !== "" && value > 0 && value <= credit.creditBalance + 0.005;
  const after = Math.max(0, credit.creditBalance - (valid ? value : 0));

  // Which invoices this payment would clear, oldest first — shown so the cashier sees what it does.
  const settles = React.useMemo(() => {
    let left = valid ? value : 0;
    return credit.openItems.map(i => {
      const take = Math.min(left, i.outstanding); left -= take;
      return { ...i, take };
    }).filter(i => i.take > 0.004);
  }, [credit.openItems, value, valid]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2"><HandCoins className="h-4 w-4 text-primary" />Collect payment · {credit.name}</h3>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-lg hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="They owe" value={formatCurrency(credit.creditBalance, currency)} />
            <Stat label="Overdue" value={formatCurrency(credit.overdue, currency)} tone={credit.overdue > 0 ? "text-destructive" : undefined} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amount received</label>
            <Input type="number" min={0} step="0.01" autoFocus value={amount} onChange={e => setAmount(e.target.value)} className="h-11 text-lg font-bold text-right" aria-label="Amount received" />
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setAmount(String(credit.creditBalance))} className="text-xs rounded-full border border-border px-2.5 py-1 hover:border-primary">Everything · {formatCurrency(credit.creditBalance, currency)}</button>
              {credit.overdue > 0 && credit.overdue < credit.creditBalance && (
                <button onClick={() => setAmount(String(credit.overdue))} className="text-xs rounded-full border border-border px-2.5 py-1 hover:border-primary">Overdue only · {formatCurrency(credit.overdue, currency)}</button>
              )}
            </div>
            {value > credit.creditBalance + 0.005 && <p className="text-xs text-destructive">More than they owe.</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Paid by</label>
            <div className="grid grid-cols-4 gap-2">
              {METHODS.map(m => (
                <button key={m.id} onClick={() => setMethod(m.id)} aria-pressed={method === m.id}
                  className={cn("rounded-xl border-2 py-2 flex flex-col items-center gap-1 text-[11px] font-semibold transition-colors",
                    method === m.id ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40")}>
                  <m.icon className="h-4 w-4" />{m.label}
                </button>
              ))}
            </div>
          </div>
          <Input value={note} onChange={e => setNote(e.target.value)} maxLength={200} placeholder="Note or cheque number (optional)" className="h-9 text-sm" aria-label="Note" />
          {settles.length > 0 && (
            <div className="rounded-xl bg-muted/40 p-3 space-y-1">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase">This settles</p>
              {settles.slice(0, 4).map(s => (
                <div key={s.id} className="flex justify-between text-xs">
                  <span className="truncate">{s.reference || formatDate(s.date)}</span>
                  <span className="tabular-nums">{formatCurrency(s.take, currency)}{s.take < s.outstanding - 0.004 ? " (part)" : ""}</span>
                </div>
              ))}
              {settles.length > 4 && <p className="text-[11px] text-muted-foreground">+ {settles.length - 4} more</p>}
              <p className="text-xs font-semibold pt-1">They will still owe {formatCurrency(after, currency)}</p>
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={pay.isPending}>Cancel</Button>
          <Button disabled={!valid || pay.isPending}
            onClick={() => pay.mutate({ amount: value, paymentMethod: method, notes: note.trim() || null }, { onSuccess: onClose })}>
            {pay.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `Record ${valid ? formatCurrency(value, currency) : "payment"}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Statement ────────────────────────────────────────────────────────────────

const KIND_LABEL = { charge: "Bought on credit", payment: "Payment received", returned: "Credit returned" } as const;

export function printStatement(c: CustomerCreditDto, currency: string, company: string) {
  const oldestFirst = [...c.entries].reverse();
  exportPdf({
    title: `Account statement — ${c.name}`,
    subtitle: `${company} · ${formatDate(new Date().toISOString())} · Balance owed ${formatCurrency(c.creditBalance, currency)}`
      + (c.overdue > 0 ? ` · Overdue ${formatCurrency(c.overdue, currency)}` : ""),
    columns: ["Date", "Description", "Reference", "Charges", "Payments", "Balance"],
    rows: oldestFirst.map(e => [
      formatDate(e.at), KIND_LABEL[e.kind] + (e.method ? ` (${e.method.replace("_", " ")})` : ""), e.reference,
      e.kind === "charge" ? formatCurrency(e.amount, currency) : "",
      e.kind !== "charge" ? formatCurrency(e.amount, currency) : "",
      formatCurrency(e.balanceAfter, currency),
    ]),
  });
}

function reminderText(c: CustomerCreditDto, currency: string, company: string) {
  const owed = c.overdue > 0 ? c.overdue : c.creditBalance;
  const what = c.overdue > 0 ? "overdue" : "outstanding";
  return `Dear ${c.name}, this is a friendly reminder from ${company}: you have ${formatCurrency(owed, currency)} ${what} on your account. `
    + `Please arrange payment at your earliest convenience. Thank you.`;
}

// ── The customer's credit file ───────────────────────────────────────────────

/**
 * Everything about one customer's credit: what they owe and how late it is, the invoices still open,
 * the full account history, and the controls a manager needs (limit, terms, stop credit). Used from the
 * shop's Credit Control page and from the customer record.
 */
export function CustomerCreditPanel({ customerId, open, onClose }: { customerId: string | null; open: boolean; onClose: () => void }) {
  const currency = useCurrency();
  const company = useAuthStore(s => s.tenant?.branding?.companyName ?? s.tenant?.name ?? "Our shop");
  const { data: c, isLoading, isError, error } = useCustomerCredit(customerId, open);
  const [tab, setTab] = React.useState<"open" | "statement">("open");
  const [collecting, setCollecting] = React.useState(false);
  const remind = useRemindCustomer(customerId ?? "");

  React.useEffect(() => { if (!open) { setCollecting(false); setTab("open"); } }, [open]);

  const phoneDigits = (c?.phone ?? "").replace(/[^\d]/g, "");

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 end-0 z-50 w-full max-w-2xl bg-background border-s border-border flex flex-col">
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
              <div className="min-w-0">
                <h2 className="text-lg font-bold truncate">{c?.name ?? "Credit account"}</h2>
                {c && <div className="mt-1 flex flex-wrap items-center gap-2">
                  <CreditStatusChip onHold={c.onHold} overdue={c.overdue} oldestOverdueDays={c.oldestOverdueDays} balance={c.creditBalance} limit={c.creditLimit} />
                  {c.phone && <span className="text-xs text-muted-foreground">{c.phone}</span>}
                </div>}
              </div>
              <button onClick={onClose} aria-label="Close" className="p-2 rounded-lg hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
              {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {isError && <p className="text-sm text-destructive">{(error as Error)?.message}</p>}
              {c && (
                <>
                  {c.onHold && (
                    <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm">
                      <p className="font-semibold text-destructive flex items-center gap-1.5"><ShieldAlert className="h-4 w-4" />Credit is stopped</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{c.holdReason}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <Stat label="They owe" value={formatCurrency(c.creditBalance, currency)} />
                    <Stat label="Overdue" value={formatCurrency(c.overdue, currency)} tone={c.overdue > 0 ? "text-destructive" : undefined}
                      sub={c.overdue > 0 ? `oldest ${c.oldestOverdueDays} days` : undefined} />
                    <Stat label="Available credit" value={formatCurrency(c.availableCredit, currency)} sub={`limit ${formatCurrency(c.creditLimit, currency)}`} />
                    <Stat label="Next payment due" value={c.nextDueOn ? formatDate(c.nextDueOn) : "—"} sub={c.nextDueOn ? formatCurrency(c.nextDueAmount, currency) : undefined} />
                  </div>

                  <section className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <p className="text-sm font-semibold">How late is it?</p>
                    <AgeingBar ageing={c.ageing} />
                    <p className="text-xs text-muted-foreground">
                      Bought {formatCurrency(c.totalCharged, currency)} on credit · paid {formatCurrency(c.totalPaid, currency)}
                      {c.lastPaymentOn ? ` · last payment ${formatCurrency(c.lastPaymentAmount, currency)} on ${formatDate(c.lastPaymentOn)}` : " · no payment yet"}
                    </p>
                  </section>

                  <div className="flex flex-wrap gap-2">
                    <Can permission="pos.customers.edit">
                      <Button size="sm" className="gap-2" disabled={c.creditBalance <= 0} onClick={() => setCollecting(true)}><HandCoins className="h-4 w-4" />Collect payment</Button>
                    </Can>
                    <Button size="sm" variant="outline" className="gap-2" onClick={() => printStatement(c, currency, company)}><Printer className="h-4 w-4" />Statement</Button>
                    <Can permission="pos.customers.edit">
                      <Button size="sm" variant="outline" className="gap-2" disabled={!c.email || c.creditBalance <= 0 || remind.isPending}
                        title={c.email ? `Email a reminder to ${c.email}` : "This customer has no email address"} onClick={() => remind.mutate()}>
                        {remind.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}Email reminder
                      </Button>
                    </Can>
                    {c.phone && c.creditBalance > 0 && (
                      <>
                        <a href={`https://wa.me/${phoneDigits}?text=${encodeURIComponent(reminderText(c, currency, company))}`} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 h-8 px-3 rounded-lg border border-border text-sm font-medium hover:bg-muted"><MessageCircle className="h-4 w-4" />Remind on WhatsApp</a>
                        <a href={`tel:${c.phone}`} className="inline-flex items-center gap-2 h-8 px-3 rounded-lg border border-border text-sm font-medium hover:bg-muted"><Phone className="h-4 w-4" />Call</a>
                      </>
                    )}
                  </div>

                  <Can permission="pos.customers.edit">
                    <CreditControls credit={c} />
                  </Can>

                  <div>
                    <div className="flex gap-1 border-b border-border mb-3" role="tablist">
                      {([["open", `Open invoices (${c.openItems.length})`], ["statement", "Account history"]] as const).map(([k, label]) => (
                        <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                          className={cn("px-3 py-2 text-sm font-medium border-b-2 -mb-px", tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{label}</button>
                      ))}
                    </div>
                    {tab === "open" ? (
                      c.openItems.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">Nothing is owed.</p> : (
                        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                          {c.openItems.map(i => (
                            <li key={i.id} className="px-4 py-2.5 flex items-center gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{i.reference || "Sale"}</p>
                                <p className="text-[11px] text-muted-foreground flex items-center gap-1"><CalendarClock className="h-3 w-3" />Bought {formatDate(i.date)} · due {formatDate(i.dueOn)}</p>
                              </div>
                              {i.daysOverdue > 0 ? <Chip tone="destructive">{i.daysOverdue}d late</Chip> : <Chip tone="success">Not due</Chip>}
                              <div className="text-end">
                                <p className="text-sm font-bold tabular-nums">{formatCurrency(i.outstanding, currency)}</p>
                                {i.outstanding < i.amount - 0.004 && <p className="text-[10px] text-muted-foreground">of {formatCurrency(i.amount, currency)}</p>}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )
                    ) : (
                      c.entries.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">No activity yet.</p> : (
                        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                          {c.entries.map(e => (
                            <li key={e.id} className="px-4 py-2.5 flex items-center gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm truncate">{KIND_LABEL[e.kind]}{e.method ? ` · ${e.method.replace("_", " ")}` : ""}</p>
                                <p className="text-[11px] text-muted-foreground truncate">{formatDate(e.at)}{e.reference ? ` · ${e.reference}` : ""}</p>
                              </div>
                              <p className={cn("text-sm font-semibold tabular-nums", e.kind === "charge" ? "text-foreground" : "text-success")}>
                                {e.kind === "charge" ? "+" : "−"}{formatCurrency(e.amount, currency)}
                              </p>
                              <p className="w-24 text-end text-xs text-muted-foreground tabular-nums">{formatCurrency(e.balanceAfter, currency)}</p>
                            </li>
                          ))}
                        </ul>
                      )
                    )}
                  </div>
                </>
              )}
            </div>
            {collecting && c && <CollectPaymentDialog credit={c} onClose={() => setCollecting(false)} />}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/** Limit, payment terms and the stop-credit switch. Each saves on its own so nothing is changed by accident. */
function CreditControls({ credit }: { credit: CustomerCreditDto }) {
  const currency = useCurrency();
  const setLimit = useSetCreditLimit(credit.customerId);
  const setTerms = useSetCreditTerms(credit.customerId);
  const setHold = useSetCreditHold(credit.customerId);
  const [limit, setLimitText] = React.useState(String(credit.creditLimit));
  const [days, setDays] = React.useState(String(credit.termsDays));
  const [reason, setReason] = React.useState("");
  const [asking, setAsking] = React.useState(false);
  React.useEffect(() => { setLimitText(String(credit.creditLimit)); setDays(String(credit.termsDays)); }, [credit.creditLimit, credit.termsDays]);

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <p className="text-sm font-semibold">Credit terms</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Credit limit ({currency})</label>
          <div className="flex gap-2">
            <Input type="number" min={0} value={limit} onChange={e => setLimitText(e.target.value)} className="h-9 text-sm" aria-label="Credit limit" />
            <Button size="sm" variant="outline" disabled={setLimit.isPending || Number(limit) === credit.creditLimit || limit === "" || Number(limit) < 0}
              onClick={() => setLimit.mutate(Number(limit))}>Save</Button>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Days to pay</label>
          <div className="flex gap-2">
            <Input type="number" min={0} max={365} value={days} onChange={e => setDays(e.target.value)} className="h-9 text-sm" aria-label="Days to pay" />
            <Button size="sm" variant="outline" disabled={setTerms.isPending || Number(days) === credit.termsDays || days === "" || Number(days) < 0 || Number(days) > 365}
              onClick={() => setTerms.mutate(Number(days))}>Save</Button>
          </div>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">A limit of 0 means no credit. New credit sales fall due this many days after the sale; earlier ones keep their date.</p>

      {credit.onHold ? (
        <Button size="sm" variant="outline" className="gap-2" disabled={setHold.isPending} onClick={() => setHold.mutate({ hold: false, reason: null })}>
          <ShieldCheck className="h-4 w-4" />Resume credit
        </Button>
      ) : asking ? (
        <div className="flex gap-2">
          <Input autoFocus value={reason} onChange={e => setReason(e.target.value)} maxLength={300} placeholder="Why? e.g. Cheque bounced" className="h-9 text-sm" aria-label="Reason" />
          <Button size="sm" variant="destructive" disabled={!reason.trim() || setHold.isPending}
            onClick={() => setHold.mutate({ hold: true, reason: reason.trim() }, { onSuccess: () => { setAsking(false); setReason(""); } })}>Stop credit</Button>
          <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>Cancel</Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="gap-2 text-destructive" onClick={() => setAsking(true)}><ShieldAlert className="h-4 w-4" />Stop further credit…</Button>
      )}
    </section>
  );
}
