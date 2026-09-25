import * as React from "react";
import { Users, Search, Wallet, CreditCard, Star, X, Loader2, Plus, Pencil, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, parseApiDate, fitTextClass } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import {
  useCustomers, useCustomer, useTopUpWallet, useCreateCustomer, useUpdateCustomer, useAdjustLoyalty, useSetCreditLimit, useRecordHouseAccountPayment, useWalletTransactions,
} from "@/hooks/pos/use-customers";
import type { CustomerDto, CustomerSummaryDto, WalletTransactionType } from "@/lib/pos/types";
import { Can } from "@/components/auth/can";

const TXN_LABELS: Record<WalletTransactionType, string> = {
  topup: "Wallet Top-Up",
  redeem: "Wallet Redeemed",
  house_charge: "Charged to House Account",
  house_payment: "House Account Payment",
};

export function CustomersView() {
  const [search, setSearch] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [showCreate, setShowCreate] = React.useState(false);
  const { data, isLoading } = useCustomers({ search: search || undefined, pageSize: 50 });
  const customers = data?.items ?? [];
  const currency = useCurrency();

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Customers
          </h1>
          <p className="text-sm text-muted-foreground">Customer details, loyalty points, wallet and house-account balances.</p>
        </div>
        <Can permission="pos.customers.edit">
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <UserPlus className="w-4 h-4 mr-1.5" /> Add Customer
          </Button>
        </Can>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers…" className="pl-9 h-9 text-sm" />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground"><Loader2 className="animate-spin mr-2 h-5 w-5" /> Loading…</div>
        ) : customers.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-10">No customers found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Phone</th>
                  <th className="px-4 py-2.5 font-medium text-right">Loyalty</th>
                  <th className="px-4 py-2.5 font-medium text-right">Wallet</th>
                  <th className="px-4 py-2.5 font-medium text-right">Available Credit</th>
                </tr>
              </thead>
              <tbody>
                {customers.map(c => <CustomerRow key={c.id} c={c} currency={currency} onClick={() => setSelectedId(c.id)} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <CustomerFormModal onClose={() => setShowCreate(false)}
          onSaved={c => { setShowCreate(false); setSelectedId(c.id); }} />
      )}
      {selectedId && <CustomerDetailDrawer customerId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

function CustomerRow({ c, currency, onClick }: { c: CustomerSummaryDto; currency: string; onClick: () => void }) {
  return (
    <tr onClick={onClick} className="border-b border-border/50 last:border-0 hover:bg-muted/20 cursor-pointer">
      <td className="px-4 py-2.5 font-medium text-foreground">{c.name}{!c.isActive && <span className="ml-2 text-xs text-muted-foreground">(inactive)</span>}</td>
      <td className="px-4 py-2.5 text-muted-foreground">{c.phone ?? "—"}</td>
      <td className="px-4 py-2.5 text-right"><span className="inline-flex items-center gap-1 text-warning"><Star className="w-3 h-3 fill-warning" />{c.loyaltyPoints}</span></td>
      <td className="px-4 py-2.5 text-right">{formatCurrency(c.walletBalance, currency)}</td>
      <td className="px-4 py-2.5 text-right">{formatCurrency(c.availableCredit, currency)}</td>
    </tr>
  );
}

function CustomerDetailDrawer({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const { data: c, isLoading } = useCustomer(customerId);
  const [txnPage, setTxnPage] = React.useState(1);
  const { data: txns } = useWalletTransactions(customerId, txnPage);
  const transactions = txns?.items ?? [];
  const currency = useCurrency();

  const topUp = useTopUpWallet(customerId);
  const setCreditLimit = useSetCreditLimit(customerId);
  const recordPayment = useRecordHouseAccountPayment(customerId);

  const [showTopUp, setShowTopUp] = React.useState(false);
  const [showCreditLimit, setShowCreditLimit] = React.useState(false);
  const [showPayment, setShowPayment] = React.useState(false);
  const [showEdit, setShowEdit] = React.useState(false);
  const [showLoyalty, setShowLoyalty] = React.useState(false);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border-l border-border w-full max-w-md h-full overflow-y-auto p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-base font-bold truncate">{c?.name ?? "Customer"}</h2>
            {c && !c.isActive && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Inactive</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {c && (
              <Can permission="pos.customers.edit">
                <Button size="sm" variant="outline" onClick={() => setShowEdit(true)}>
                  <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                </Button>
              </Can>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {isLoading || !c ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground"><Loader2 className="animate-spin mr-2 h-5 w-5" /> Loading…</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-muted/30 rounded-lg p-3"><p className="text-xs text-muted-foreground">Phone</p><p className="font-medium">{c.phone ?? "—"}</p></div>
              <div className="bg-muted/30 rounded-lg p-3"><p className="text-xs text-muted-foreground">Email</p><p className="font-medium truncate">{c.email ?? "—"}</p></div>
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Loyalty Points</p>
                  <Can permission="pos.customers.edit">
                    <button onClick={() => setShowLoyalty(true)} className="text-[11px] font-medium text-primary hover:underline">Adjust</button>
                  </Can>
                </div>
                <p className="font-medium flex items-center gap-1"><Star className="w-3.5 h-3.5 text-amber-500" /> {c.loyaltyPoints}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3"><p className="text-xs text-muted-foreground">Total Purchases</p><p className="font-medium">{formatCurrency(c.totalPurchases, currency)}</p></div>
            </div>

            {/* Wallet */}
            <div className="border border-border rounded-xl p-4 space-y-3 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold flex items-center gap-1.5"><Wallet className="w-4 h-4 text-primary" /> Wallet</p>
                <Can permission="pos.customers.edit">
                  <Button size="sm" variant="outline" onClick={() => setShowTopUp(true)}><Plus className="w-3.5 h-3.5 mr-1" /> Top Up</Button>
                </Can>
              </div>
              <p className={cn("font-bold text-foreground truncate", fitTextClass(formatCurrency(c.walletBalance, currency), "2xl"))}
                 title={formatCurrency(c.walletBalance, currency)}>
                {formatCurrency(c.walletBalance, currency)}
              </p>
            </div>

            {/* House account */}
            <div className="border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold flex items-center gap-1.5"><CreditCard className="w-4 h-4 text-primary" /> House Account</p>
                <Can permission="pos.customers.edit">
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => setShowCreditLimit(true)}>Set Limit</Button>
                    <Button size="sm" variant="outline" onClick={() => setShowPayment(true)} disabled={c.creditBalance <= 0}>Record Payment</Button>
                  </div>
                </Can>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div><p className="text-xs text-muted-foreground">Limit</p><p className="font-medium">{formatCurrency(c.creditLimit, currency)}</p></div>
                <div><p className="text-xs text-muted-foreground">Owing</p><p className="font-medium">{formatCurrency(c.creditBalance, currency)}</p></div>
                <div><p className="text-xs text-muted-foreground">Available</p><p className="font-medium text-success">{formatCurrency(c.availableCredit, currency)}</p></div>
              </div>
            </div>

            {/* History */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Transaction History</p>
              {transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No wallet/house-account activity yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {transactions.map(t => (
                    <div key={t.id} className="flex items-center justify-between text-sm border-b border-border/50 last:border-0 py-1.5">
                      <div>
                        <p className="text-foreground">{TXN_LABELS[t.type]}</p>
                        <p className="text-xs text-muted-foreground">{parseApiDate(t.createdAt).toLocaleString()}</p>
                      </div>
                      <span className={cn("font-medium", t.type === "topup" || t.type === "house_payment" ? "text-success" : "text-destructive")}>
                        {t.type === "topup" || t.type === "house_payment" ? "+" : "-"}{formatCurrency(t.amount, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* A regular's ledger runs to hundreds of rows, so only this page is loaded. */}
              {(txns?.totalPages ?? 1) > 1 && (
                <div className="flex items-center justify-between mt-3 text-xs">
                  <span className="text-muted-foreground">
                    Page {txnPage} of {txns!.totalPages} · {txns!.totalCount} entries
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="h-7" disabled={txnPage <= 1}
                            onClick={() => setTxnPage(p => Math.max(1, p - 1))}>Prev</Button>
                    <Button variant="outline" size="sm" className="h-7" disabled={txnPage >= (txns?.totalPages ?? 1)}
                            onClick={() => setTxnPage(p => p + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {showEdit && c && (
        <CustomerFormModal customer={c} onClose={() => setShowEdit(false)} onSaved={() => setShowEdit(false)} />
      )}
      {showLoyalty && c && (
        <LoyaltyModal customer={c} onClose={() => setShowLoyalty(false)} />
      )}
      {showTopUp && (
        <AmountModal title="Top Up Wallet" confirmLabel="Top Up" busy={topUp.isPending}
          onClose={() => setShowTopUp(false)}
          onConfirm={amount => topUp.mutate({ amount }, { onSuccess: () => setShowTopUp(false) })} />
      )}
      {showCreditLimit && (
        <AmountModal title="Set Credit Limit" confirmLabel="Save" busy={setCreditLimit.isPending} initial={c?.creditLimit}
          onClose={() => setShowCreditLimit(false)}
          onConfirm={amount => setCreditLimit.mutate(amount, { onSuccess: () => setShowCreditLimit(false) })} />
      )}
      {showPayment && (
        <AmountModal title="Record House Account Payment" confirmLabel="Record" busy={recordPayment.isPending}
          onClose={() => setShowPayment(false)}
          onConfirm={amount => recordPayment.mutate({ amount }, { onSuccess: () => setShowPayment(false) })} />
      )}
    </div>
  );
}

function AmountModal({ title, confirmLabel, busy, initial, onClose, onConfirm }: {
  title: string; confirmLabel: string; busy: boolean; initial?: number;
  onClose: () => void; onConfirm: (amount: number) => void;
}) {
  const [amount, setAmount] = React.useState(initial != null ? String(initial) : "");
  const parsed = Number(amount);
  const valid = amount.trim() !== "" && !Number.isNaN(parsed) && parsed >= 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl p-5 w-full max-w-sm mx-4 space-y-3" onClick={e => e.stopPropagation()}>
        <p className="text-sm font-semibold">{title}</p>
        <Input type="number" min={0} autoFocus value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="h-9 text-sm" />
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button size="sm" onClick={() => valid && onConfirm(parsed)} disabled={!valid || busy}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CustomerFormModal({ customer, onClose, onSaved }: {
  customer?: CustomerDto; onClose: () => void; onSaved: (c: CustomerDto) => void;
}) {
  const create = useCreateCustomer();
  const update = useUpdateCustomer(customer?.id ?? "");
  const [form, setForm] = React.useState({
    name:     customer?.name ?? "",
    phone:    customer?.phone ?? "",
    email:    customer?.email ?? "",
    address:  customer?.address ?? "",
    notes:    customer?.notes ?? "",
    isActive: customer?.isActive ?? true,
  });
  const busy = create.isPending || update.isPending;
  const set = (k: "name" | "phone" | "email" | "address" | "notes") =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    const payload = {
      name:    form.name.trim(),
      phone:   form.phone.trim() || null,
      email:   form.email.trim() || null,
      address: form.address.trim() || null,
      notes:   form.notes.trim() || null,
    };
    try {
      const saved = customer
        ? await update.mutateAsync({ ...payload, isActive: form.isActive })
        : await create.mutateAsync(payload);
      onSaved(saved);
    } catch { /* the hook shows the error; keep the form open */ }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl p-5 w-full max-w-md mx-4 space-y-3" onClick={e => e.stopPropagation()}>
        <p className="text-sm font-semibold">{customer ? "Edit Customer" : "Add Customer"}</p>
        <Field label="Name *"><Input autoFocus value={form.name} onChange={set("name")} className="h-9 text-sm" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Phone"><Input value={form.phone} onChange={set("phone")} className="h-9 text-sm" /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={set("email")} className="h-9 text-sm" /></Field>
        </div>
        <Field label="Address"><Input value={form.address} onChange={set("address")} className="h-9 text-sm" /></Field>
        <Field label="Notes">
          <textarea value={form.notes} onChange={set("notes")} rows={2}
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm" />
        </Field>
        {customer && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
            Active
          </label>
        )}
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={!form.name.trim() || busy}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : customer ? "Save" : "Add Customer"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function LoyaltyModal({ customer, onClose }: { customer: CustomerDto; onClose: () => void }) {
  const adjust = useAdjustLoyalty(customer.id);
  const [mode, setMode] = React.useState<"add" | "remove">("add");
  const [points, setPoints] = React.useState("");
  const [reason, setReason] = React.useState("");
  const n = Number(points);
  const tooMany = mode === "remove" && n > customer.loyaltyPoints;
  const valid = points.trim() !== "" && !Number.isNaN(n) && n > 0 && !tooMany;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl p-5 w-full max-w-sm mx-4 space-y-3" onClick={e => e.stopPropagation()}>
        <p className="text-sm font-semibold">Adjust Loyalty Points</p>
        <p className="text-xs text-muted-foreground">Current balance: <span className="font-semibold text-foreground">{customer.loyaltyPoints}</span></p>
        <div className="grid grid-cols-2 gap-1 p-1 bg-muted/40 rounded-lg">
          {(["add", "remove"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={cn("text-xs font-medium py-1.5 rounded-md", mode === m ? "bg-card shadow-sm text-foreground" : "text-muted-foreground")}>
              {m === "add" ? "Add points" : "Remove points"}
            </button>
          ))}
        </div>
        <Input type="number" min={0} autoFocus value={points} onChange={e => setPoints(e.target.value)} placeholder="Points" className="h-9 text-sm" />
        {tooMany && <p className="text-xs text-destructive">Can't remove more than the current balance.</p>}
        <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (optional)" className="h-9 text-sm" />
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="outline" size="sm" onClick={onClose} disabled={adjust.isPending}>Cancel</Button>
          <Button size="sm" disabled={!valid || adjust.isPending}
            onClick={() => adjust.mutate({ points: mode === "add" ? n : -n, reason: reason.trim() || null }, { onSuccess: onClose })}>
            {adjust.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
