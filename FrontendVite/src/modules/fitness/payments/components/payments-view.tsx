import * as React from "react";
import { Wallet } from "lucide-react";
import { PostToFinanceButton } from "@/components/finance/post-to-finance";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { addDays, localToday, PAYMENT_METHODS } from "@/lib/fitness/fitness.api";
import { usePayments } from "@/hooks/fitness/use-fitness";
import { Field, PageHeader, SELECT, Stat, TableState, TH } from "../../shared/ui";

export function PaymentsView() {
  const [from, setFrom] = React.useState(addDays(localToday(), -29));
  const [to, setTo] = React.useState(localToday());
  const [method, setMethod] = React.useState("");
  const [voided, setVoided] = React.useState(false);
  const cur = useCurrency();
  const { data, isLoading, error } = usePayments({ from, to, method: method || undefined, includeVoided: voided, pageSize: 200 });
  return (
    <div className="space-y-5">
      <PageHeader title="Payments" description="Every receipt taken for memberships and training packages."><PostToFinanceButton module="fitness" /></PageHeader>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="From"><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9" /></Field>
        <Field label="To"><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9" /></Field>
        <Field label="Method"><select className={cn(SELECT, "w-auto")} value={method} onChange={e => setMethod(e.target.value)}><option value="">All</option>{PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select></Field>
        <label className="flex items-center gap-2 text-sm pb-2"><input type="checkbox" checked={voided} onChange={e => setVoided(e.target.checked)} />Show voided</label>
      </div>
      {data && <div className="grid grid-cols-2 sm:grid-cols-3 gap-3"><Stat label="Collected" value={formatCurrency(data.totalAmount, cur)} /><Stat label="Receipts" value={data.total} /></div>}
      <Card className="overflow-hidden"><TableState loading={isLoading} error={error as Error | null} empty={!!data && data.items.length === 0} emptyText="No payments in this range." icon={Wallet} />
        {data && data.items.length > 0 && <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/30 text-xs text-muted-foreground"><tr><th className={TH}>Date</th><th className={TH}>Receipt</th><th className={TH}>Member</th><th className={TH}>Method</th><th className={TH}>By</th><th className={cn(TH, "text-end")}>Amount</th></tr></thead>
          <tbody className="divide-y divide-border">{data.items.map(p => (
            <tr key={p.id} className={cn(p.isVoided && "opacity-50 line-through")}><td className="px-4 py-2.5">{formatDate(p.paidOn)}</td><td className="px-4 py-2.5">{p.receiptNumber}</td>
              <td className="px-4 py-2.5">{p.memberName}<p className="text-xs text-muted-foreground">{p.memberNumber}</p></td><td className="px-4 py-2.5">{p.method.replace("_", " ")}</td>
              <td className="px-4 py-2.5">{p.receivedByName ?? "—"}</td><td className="px-4 py-2.5 text-end tabular-nums font-medium">{formatCurrency(p.amount, cur)}</td></tr>))}</tbody></table></div>}
      </Card>
    </div>
  );
}
