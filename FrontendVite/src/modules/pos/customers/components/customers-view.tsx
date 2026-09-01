import * as React from "react";
import { Users, Search, Wallet, CreditCard, Star, X, Loader2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, parseApiDate, fitTextClass } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import {
  useCustomers, useCustomer, useTopUpWallet, useSetCreditLimit, useRecordHouseAccountPayment, useWalletTransactions,
} from "@/hooks/pos/use-customers";
import type { CustomerSummaryDto, WalletTransactionType } from "@/lib/pos/types";

const TXN_LABELS: Record<WalletTransactionType, string> = {
  topup: "Wallet Top-Up",
  redeem: "Wallet Redeemed",
  house_charge: "Charged to House Account",
  house_payment: "House Account Payment",
};

export function CustomersView() {
  const [search, setSearch] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const { data, isLoading } = useCustomers({ search: search || undefined, pageSize: 50 });
  const customers = data?.items ?? [];
  const currency = useCurrency();

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" /> Customers
        </h1>
        <p className="text-sm text-muted-foreground">Wallet (store credit) and house-account balances.</p>
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
  const { data: transactions = [] } = useWalletTransactions(customerId);
  const currency = useCurrency();

  const topUp = useTopUpWallet(customerId);
  const setCreditLimit = useSetCreditLimit(customerId);
  const recordPayment = useRecordHouseAccountPayment(customerId);

  const [showTopUp, setShowTopUp] = React.useState(false);
  const [showCreditLimit, setShowCreditLimit] = React.useState(false);
  const [showPayment, setShowPayment] = React.useState(false);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border-l border-border w-full max-w-md h-full overflow-y-auto p-5 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">{c?.name ?? "Customer"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>

        {isLoading || !c ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground"><Loader2 className="animate-spin mr-2 h-5 w-5" /> Loading…</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-muted/30 rounded-lg p-3"><p className="text-xs text-muted-foreground">Phone</p><p className="font-medium">{c.phone ?? "—"}</p></div>
              <div className="bg-muted/30 rounded-lg p-3"><p className="text-xs text-muted-foreground">Email</p><p className="font-medium truncate">{c.email ?? "—"}</p></div>
              <div className="bg-muted/30 rounded-lg p-3"><p className="text-xs text-muted-foreground">Loyalty Points</p><p className="font-medium">{c.loyaltyPoints}</p></div>
              <div className="bg-muted/30 rounded-lg p-3"><p className="text-xs text-muted-foreground">Total Purchases</p><p className="font-medium">{formatCurrency(c.totalPurchases, currency)}</p></div>
            </div>

            {/* Wallet */}
            <div className="border border-border rounded-xl p-4 space-y-3 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold flex items-center gap-1.5"><Wallet className="w-4 h-4 text-primary" /> Wallet</p>
                <Button size="sm" variant="outline" onClick={() => setShowTopUp(true)}><Plus className="w-3.5 h-3.5 mr-1" /> Top Up</Button>
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
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => setShowCreditLimit(true)}>Set Limit</Button>
                  <Button size="sm" variant="outline" onClick={() => setShowPayment(true)} disabled={c.creditBalance <= 0}>Record Payment</Button>
                </div>
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
            </div>
          </>
        )}
      </div>

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
