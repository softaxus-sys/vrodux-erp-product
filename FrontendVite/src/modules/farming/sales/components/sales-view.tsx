import * as React from "react";
import { AnimatePresence } from "framer-motion";
import { Plus, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Can } from "@/components/auth/can";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useAct, useExpenses, useSales } from "@/hooks/farming/use-farming";
import { defaultUom, farmingApi, farmTypeLabel, localToday, productLabel } from "@/lib/farming/farming.api";
import { ConfirmDialog, FormModal, PageHeader, Pill, Stat, TableState, Tabs, TH, num, orUndef } from "../../shared/ui";
import { monthAgo, useFarmOptions } from "../../shared/options";

const CATEGORIES = ["Labour", "Power & water", "Rent", "Equipment", "Transport", "Stock purchase", "Repairs", "Other"].map(c => ({ value: c, label: c }));

export function SalesView() {
  const cur = useCurrency();
  const today = localToday();
  const [tab, setTab] = React.useState<"sales" | "expenses">("sales");
  const [from, setFrom] = React.useState(monthAgo(today)), [to, setTo] = React.useState(today);
  const sales = useSales({ from, to });
  const expenses = useExpenses({ from, to });
  const o = useFarmOptions();
  const [form, setForm] = React.useState<"sale" | "expense" | null>(null);
  const [del, setDel] = React.useState<{ kind: "sale" | "expense"; id: string } | null>(null);
  const saveS = useAct((b: Record<string, unknown>) => farmingApi.saveSale(undefined, b), "Sale recorded.");
  const saveE = useAct((b: Record<string, unknown>) => farmingApi.saveExpense(undefined, b), "Expense recorded.");
  const remove = useAct((d: { kind: string; id: string }) => d.kind === "sale" ? farmingApi.deleteSale(d.id) : farmingApi.deleteExpense(d.id), "Removed.");
  const totalSales = (sales.data ?? []).reduce((s, x) => s + x.total, 0), owed = (sales.data ?? []).reduce((s, x) => s + x.balance, 0);
  const totalExp = (expenses.data ?? []).reduce((s, x) => s + x.amount, 0);

  return (
    <div className="space-y-4">
      <PageHeader title="Sales & expenses" description="What you sold, who still owes you, and what else the farm cost.">
        <Can permission="farming.sales.create"><Button size="sm" variant="outline" className="gap-1.5" onClick={() => setForm("expense")}><Plus className="h-4 w-4" />Expense</Button></Can>
        <Can permission="farming.sales.create"><Button size="sm" className="gap-1.5" onClick={() => setForm("sale")}><Plus className="h-4 w-4" />Sale</Button></Can>
      </PageHeader>
      <div className="grid grid-cols-3 gap-3"><Stat label="Sales in range" value={formatCurrency(totalSales, cur)} /><Stat label="Still owed" value={formatCurrency(owed, cur)} tone={owed > 0 ? "warn" : undefined} /><Stat label="Other expenses" value={formatCurrency(totalExp, cur)} /></div>
      <div className="flex flex-wrap gap-2 items-center"><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9 w-40" /><span className="text-sm text-muted-foreground">to</span><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9 w-40" /></div>
      <Tabs value={tab} onChange={v => setTab(v as typeof tab)} items={[{ value: "sales", label: "Sales" }, { value: "expenses", label: "Expenses" }]} />
      <Card className="overflow-hidden">
        {tab === "sales" ? (<>
          <TableState loading={sales.isLoading} error={sales.error as Error | null} empty={(sales.data ?? []).length === 0} emptyText="No sales in this range." icon={Wallet} />
          {(sales.data ?? []).length > 0 && <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/40 text-xs"><tr><th className={TH}>Date</th><th className={TH}>Product</th><th className={TH}>Buyer</th><th className={TH}>Quantity</th><th className={TH}>Total</th><th className={TH}>Balance</th><th /></tr></thead>
            <tbody>{sales.data!.map(s => (<tr key={s.id} className="border-t border-border"><td className="px-4 py-2">{formatDate(s.date)}</td><td className="px-4">{productLabel(s.product)} <span className="text-xs text-muted-foreground">{farmTypeLabel(s.type)}{s.animalTag ? ` · ${s.animalTag}` : s.batchCode ? ` · ${s.batchCode}` : ""}</span></td>
              <td className="px-4">{s.buyer ?? "—"}</td><td className="px-4 tabular-nums">{s.quantity.toLocaleString()} {s.uom}</td><td className="px-4 tabular-nums">{formatCurrency(s.total, cur)}</td>
              <td className="px-4">{s.balance > 0 ? <span className="tabular-nums text-amber-600">{formatCurrency(s.balance, cur)}</span> : <Pill state="paid" />}</td>
              <td className="px-4 text-end"><Can permission="farming.sales.delete"><Button size="icon" variant="ghost" aria-label="Delete" onClick={() => setDel({ kind: "sale", id: s.id })}><Trash2 className="h-4 w-4" /></Button></Can></td></tr>))}</tbody></table></div>}
        </>) : (<>
          <TableState loading={expenses.isLoading} error={expenses.error as Error | null} empty={(expenses.data ?? []).length === 0} emptyText="No expenses in this range." icon={Wallet} />
          {(expenses.data ?? []).length > 0 && <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/40 text-xs"><tr><th className={TH}>Date</th><th className={TH}>Category</th><th className={TH}>Description</th><th className={TH}>Amount</th><th className={TH}>Paid to</th><th /></tr></thead>
            <tbody>{expenses.data!.map(e => (<tr key={e.id} className="border-t border-border"><td className="px-4 py-2">{formatDate(e.date)}</td><td className="px-4">{e.category}</td><td className="px-4">{e.description}</td><td className="px-4 tabular-nums">{formatCurrency(e.amount, cur)}</td><td className="px-4">{e.paidTo ?? "—"}</td>
              <td className="px-4 text-end"><Can permission="farming.sales.delete"><Button size="icon" variant="ghost" aria-label="Delete" onClick={() => setDel({ kind: "expense", id: e.id })}><Trash2 className="h-4 w-4" /></Button></Can></td></tr>))}</tbody></table></div>}
        </>)}
      </Card>
      <AnimatePresence>
        {form === "sale" && <FormModal title="Record sale" size="lg" pending={saveS.isPending} onClose={() => setForm(null)}
          initial={{ date: today, type: o.types[0]?.value ?? "dairy", product: "milk", buyer: "", buyerPhone: "", quantity: "", uom: "L", unitPrice: "", amountPaid: "0", animalId: "", batchId: "", headCount: "0", notes: "" }}
          fields={[{ key: "date", label: "Date", type: "date", required: true }, { key: "type", label: "Type of farming", type: "select", required: true, options: o.types }, { key: "product", label: "Product", type: "select", required: true, options: o.products },
            { key: "buyer", label: "Buyer" }, { key: "buyerPhone", label: "Buyer phone" }, { key: "quantity", label: "Quantity", type: "number", required: true }, { key: "uom", label: "Unit", required: true, hint: `Usually ${defaultUom("milk")} for milk, kg for fish and meat.` },
            { key: "unitPrice", label: "Price per unit", type: "number", required: true }, { key: "amountPaid", label: "Paid so far", type: "number" },
            { key: "animalId", label: "Animal sold", type: "select", options: o.animals, hint: "For live animals or meat." }, { key: "batchId", label: "From batch", type: "select", options: o.batches }, { key: "headCount", label: "Head taken from batch", type: "number", hint: "Live birds or fish sold." }, { key: "notes", label: "Notes", type: "textarea" }]}
          onSubmit={v => saveS.mutate({ date: v.date, type: v.type, product: v.product, buyer: orUndef(v.buyer), buyerPhone: orUndef(v.buyerPhone), quantity: num(v.quantity), uom: String(v.uom).trim(), unitPrice: num(v.unitPrice), amountPaid: num(v.amountPaid),
            animalId: orUndef(v.animalId), batchId: orUndef(v.batchId), headCount: Math.round(num(v.headCount)), notes: orUndef(v.notes) }, { onSuccess: () => setForm(null) })} />}
        {form === "expense" && <FormModal title="Record expense" size="sm" pending={saveE.isPending} onClose={() => setForm(null)}
          initial={{ date: today, category: "Labour", description: "", amount: "", type: "", unitId: "", batchId: "", paidTo: "" }}
          fields={[{ key: "date", label: "Date", type: "date", required: true }, { key: "category", label: "Category", type: "select", required: true, options: CATEGORIES }, { key: "description", label: "Description", required: true }, { key: "amount", label: "Amount", type: "number", required: true },
            { key: "type", label: "Type of farming", type: "select", options: o.types }, { key: "batchId", label: "Batch", type: "select", options: o.batches }, { key: "unitId", label: "Shed / pond / field", type: "select", options: o.units }, { key: "paidTo", label: "Paid to" }]}
          onSubmit={v => saveE.mutate({ date: v.date, category: v.category, description: String(v.description).trim(), amount: num(v.amount), type: orUndef(v.type), unitId: orUndef(v.unitId), batchId: orUndef(v.batchId), paidTo: orUndef(v.paidTo) }, { onSuccess: () => setForm(null) })} />}
        {del && <ConfirmDialog title="Delete this record?" body={del.kind === "sale" ? "A sold animal returns to active." : "It will no longer count in totals."} confirmLabel="Delete" pending={remove.isPending} onClose={() => setDel(null)} onConfirm={() => remove.mutate(del, { onSuccess: () => setDel(null) })} />}
      </AnimatePresence>
    </div>
  );
}
