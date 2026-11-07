import * as React from "react";
import { ft, useFt } from "@/lib/farming/ft";
import { AnimatePresence } from "framer-motion";
import { Milk, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Can } from "@/components/auth/can";
import { formatDate } from "@/lib/utils";
import { useAct, useAnimals, useFeed, useProduction } from "@/hooks/farming/use-farming";
import { defaultUom, farmingApi, farmTypeLabel, localToday, PRODUCTS, productLabel } from "@/lib/farming/farming.api";
import { ConfirmDialog, Field, FormModal, Modal, PageHeader, Pill, SELECT, TableState, Tabs, TH, num, orUndef } from "../../shared/ui";
import { monthAgo, useFarmOptions } from "../../shared/options";

/** The daily dairy sheet: one milking, every animal on one screen. */
function MilkingSheet({ onClose }: { onClose: () => void }) {
  const { data: animals = [] } = useAnimals({ status: "active" });
  const females = animals.filter(a => a.sex === "female" && (a.type === "dairy" || a.type === "goat_sheep"));
  const [date, setDate] = React.useState(localToday()), [session, setSession] = React.useState("morning"), [product] = React.useState("milk");
  const [qty, setQty] = React.useState<Record<string, string>>({});
  const save = useAct((b: Parameters<typeof farmingApi.bulkProduction>[0]) => farmingApi.bulkProduction(b), "Milking saved.");
  const entries = females.map(a => ({ animalId: a.id, quantity: num(qty[a.id]) })).filter(e => e.quantity > 0);
  const total = entries.reduce((s, e) => s + e.quantity, 0);
  return (
    <Modal size="lg" title="Milking sheet" subtitle="Enter litres for each animal. Saving the same date and session again replaces it."
      onClose={onClose} footer={<><Button variant="outline" size="sm" onClick={onClose}>{ft("Cancel")}</Button>
        <Button size="sm" disabled={entries.length === 0 || save.isPending} onClick={() => save.mutate({ date, product, uom: "L", session, entries }, { onSuccess: onClose })}>{ft("Save {{n}} animals · {{total}} L", { n: entries.length, total: total.toLocaleString() })}</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date"><Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9" /></Field>
        <Field label="Session"><select className={SELECT} value={session} onChange={e => setSession(e.target.value)}><option value="morning">{ft("Morning")}</option><option value="midday">{ft("Midday")}</option><option value="evening">{ft("Evening")}</option></select></Field>
      </div>
      {females.length === 0 ? <p className="text-sm text-muted-foreground">{ft("No active dairy or goat/sheep females on file yet.")}</p> : (
        <div className="grid sm:grid-cols-2 gap-2">{females.map(a => (
          <label key={a.id} className="flex items-center gap-2 text-sm rounded-md border border-border px-3 py-1.5"><span className="flex-1 truncate">{a.tagNumber}{a.name ? ` — ${a.name}` : ""}</span>
            <Input type="number" min={0} step="any" className="h-8 w-24 text-end" value={qty[a.id] ?? ""} onChange={e => setQty(p => ({ ...p, [a.id]: e.target.value }))} placeholder={ft("0")} /><span className="text-xs text-muted-foreground">L</span></label>))}</div>)}
    </Modal>
  );
}

function ProductionForm({ onClose }: { onClose: () => void }) {
  const o = useFarmOptions();
  const [product, setProduct] = React.useState("milk");
  const save = useAct((b: Record<string, unknown>) => farmingApi.saveProduction(undefined, b), "Recorded.");
  return (
    <FormModal title="Record production" size="lg" pending={save.isPending} onClose={onClose}
      initial={{ date: localToday(), type: o.types[0]?.value ?? "dairy", product, quantity: "", uom: defaultUom(product), session: "", grade: "", rejected: "0", animalId: "", batchId: "", unitId: "", notes: "" }}
      fields={[
        { key: "date", label: "Date", type: "date", required: true }, { key: "type", label: "Type of farming", type: "select", required: true, options: o.types },
        { key: "product", label: "Product", type: "select", required: true, options: o.products }, { key: "quantity", label: "Quantity", type: "number", required: true },
        { key: "uom", label: "Unit", required: true, hint: "L, kg, pcs, trays, crates…" }, { key: "session", label: "Session", type: "select", options: [{ value: "morning", label: "Morning" }, { value: "midday", label: "Midday" }, { value: "evening", label: "Evening" }] },
        { key: "rejected", label: "Rejected / spoiled", type: "number", hint: "Not included in the quantity." }, { key: "grade", label: "Grade / note" },
        { key: "animalId", label: "From animal", type: "select", options: o.animals }, { key: "batchId", label: "From batch", type: "select", options: o.batches }, { key: "unitId", label: "Shed / pond / field", type: "select", options: o.units },
        { key: "notes", label: "Notes", type: "textarea" },
      ]}
      onSubmit={v => { setProduct(String(v.product)); save.mutate({ date: v.date, type: v.type, product: v.product, quantity: num(v.quantity), uom: String(v.uom).trim() || defaultUom(String(v.product)), session: orUndef(v.session), grade: orUndef(v.grade),
        rejected: num(v.rejected), animalId: orUndef(v.animalId), batchId: orUndef(v.batchId), unitId: orUndef(v.unitId), notes: orUndef(v.notes) }, { onSuccess: onClose }); }} />
  );
}

function FeedForm({ onClose }: { onClose: () => void }) {
  const o = useFarmOptions();
  const save = useAct((b: Record<string, unknown>) => farmingApi.saveFeed(undefined, b), "Feed recorded.");
  return (
    <FormModal title="Record feed" pending={save.isPending} onClose={onClose}
      initial={{ date: localToday(), feedName: "", quantity: "", uom: "kg", cost: "0", animalId: "", batchId: "", unitId: "", notes: "" }}
      fields={[{ key: "date", label: "Date", type: "date", required: true }, { key: "feedName", label: "Feed / fertiliser", required: true }, { key: "quantity", label: "Quantity", type: "number", required: true }, { key: "uom", label: "Unit", required: true },
        { key: "cost", label: "Cost", type: "number" }, { key: "batchId", label: "For batch", type: "select", options: o.batches }, { key: "animalId", label: "For animal", type: "select", options: o.animals }, { key: "unitId", label: "For shed / pond / field", type: "select", options: o.units }, { key: "notes", label: "Notes", type: "textarea" }]}
      onSubmit={v => save.mutate({ date: v.date, feedName: String(v.feedName).trim(), quantity: num(v.quantity), uom: String(v.uom).trim(), cost: num(v.cost), animalId: orUndef(v.animalId), batchId: orUndef(v.batchId), unitId: orUndef(v.unitId), notes: orUndef(v.notes) }, { onSuccess: onClose })} />
  );
}

export function ProductionView() {
  useFt();
  const today = localToday();
  const [tab, setTab] = React.useState<"production" | "feed">("production");
  const [from, setFrom] = React.useState(monthAgo(today)), [to, setTo] = React.useState(today), [product, setProduct] = React.useState("");
  const prod = useProduction({ from, to, product });
  const feed = useFeed({ from, to });
  const [form, setForm] = React.useState<"prod" | "feed" | "milk" | null>(null);
  const [del, setDel] = React.useState<{ kind: "prod" | "feed"; id: string } | null>(null);
  const remove = useAct((d: { kind: string; id: string }) => d.kind === "prod" ? farmingApi.deleteProduction(d.id) : farmingApi.deleteFeed(d.id), "Removed.");
  const totals = React.useMemo(() => {
    const m = new Map<string, number>();
    (prod.data ?? []).forEach(p => m.set(`${p.product}|${p.uom}`, (m.get(`${p.product}|${p.uom}`) ?? 0) + p.quantity));
    return [...m.entries()].map(([k, v]) => { const [p, u] = k.split("|"); return `${v.toLocaleString()} ${u} ${productLabel(p).toLowerCase()}`; }).join(" · ");
  }, [prod.data]);
  return (
    <div className="space-y-4">
      <PageHeader title="Production & feed" description="Milk, eggs, fish, honey and harvest, and what the animals were fed.">
        <Can permission="farming.production.create"><Button size="sm" variant="outline" className="gap-1.5" onClick={() => setForm("milk")}><Milk className="h-4 w-4" />{ft("Milking sheet")}</Button></Can>
        <Can permission="farming.production.create"><Button size="sm" variant="outline" className="gap-1.5" onClick={() => setForm("feed")}><Plus className="h-4 w-4" />{ft("Feed")}</Button></Can>
        <Can permission="farming.production.create"><Button size="sm" className="gap-1.5" onClick={() => setForm("prod")}><Plus className="h-4 w-4" />{ft("Production")}</Button></Can>
      </PageHeader>
      <Tabs value={tab} onChange={v => setTab(v as typeof tab)} items={[{ value: "production", label: "Production" }, { value: "feed", label: "Feed" }]} />
      <div className="flex flex-wrap gap-2 items-center">
        <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9 w-40" /><span className="text-sm text-muted-foreground">{ft("to")}</span><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9 w-40" />
        {tab === "production" && <select className="h-9 rounded-md border border-input bg-card px-3 text-sm" value={product} onChange={e => setProduct(e.target.value)}><option value="">{ft("All products")}</option>{PRODUCTS.map(p => <option key={p.value} value={p.value}>{ft(p.label)}</option>)}</select>}
        {tab === "production" && totals && <span className="text-sm text-muted-foreground ms-auto">{totals}</span>}
      </div>
      <Card className="overflow-hidden">
        {tab === "production" ? (<>
          <TableState loading={prod.isLoading} error={prod.error as Error | null} empty={(prod.data ?? []).length === 0} emptyText="No production recorded in this range." icon={Milk} />
          {(prod.data ?? []).length > 0 && <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/40 text-xs"><tr><th className={TH}>{ft("Date")}</th><th className={TH}>{ft("Product")}</th><th className={TH}>{ft("Quantity")}</th><th className={TH}>{ft("From")}</th><th className={TH}>{ft("Type")}</th><th className={TH}>{ft("Note")}</th><th /></tr></thead>
            <tbody>{prod.data!.map(p => (<tr key={p.id} className="border-t border-border"><td className="px-4 py-2">{formatDate(p.date)}</td><td className="px-4">{productLabel(p.product)}{p.session ? ` · ${p.session}` : ""}</td>
              <td className="px-4 tabular-nums">{p.quantity.toLocaleString()} {p.uom}{p.rejected > 0 && <span className="text-xs text-amber-600"> {ft("(+{{n}} rejected)", { n: p.rejected })}</span>}</td><td className="px-4">{p.animalTag ?? p.batchCode ?? p.unitName ?? "—"}</td><td className="px-4">{farmTypeLabel(p.type)}</td><td className="px-4 text-muted-foreground">{p.grade ?? p.notes ?? ""}</td>
              <td className="px-4 text-end"><Can permission="farming.production.delete"><Button size="icon" variant="ghost" aria-label={ft("Delete")} onClick={() => setDel({ kind: "prod", id: p.id })}><Trash2 className="h-4 w-4" /></Button></Can></td></tr>))}</tbody></table></div>}
        </>) : (<>
          <TableState loading={feed.isLoading} error={feed.error as Error | null} empty={(feed.data ?? []).length === 0} emptyText="No feed recorded in this range." icon={Milk} />
          {(feed.data ?? []).length > 0 && <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/40 text-xs"><tr><th className={TH}>{ft("Date")}</th><th className={TH}>{ft("Feed")}</th><th className={TH}>{ft("Quantity")}</th><th className={TH}>{ft("Cost")}</th><th className={TH}>{ft("For")}</th><th /></tr></thead>
            <tbody>{feed.data!.map(f => (<tr key={f.id} className="border-t border-border"><td className="px-4 py-2">{formatDate(f.date)}</td><td className="px-4">{f.feedName}</td><td className="px-4 tabular-nums">{f.quantity.toLocaleString()} {f.uom}</td><td className="px-4 tabular-nums">{f.cost.toLocaleString()}</td><td className="px-4">{f.batchCode ?? f.animalTag ?? f.unitName ?? "—"}</td>
              <td className="px-4 text-end"><Can permission="farming.production.delete"><Button size="icon" variant="ghost" aria-label={ft("Delete")} onClick={() => setDel({ kind: "feed", id: f.id })}><Trash2 className="h-4 w-4" /></Button></Can></td></tr>))}</tbody></table></div>}
        </>)}
      </Card>
      <AnimatePresence>
        {form === "milk" && <MilkingSheet onClose={() => setForm(null)} />}{form === "prod" && <ProductionForm onClose={() => setForm(null)} />}{form === "feed" && <FeedForm onClose={() => setForm(null)} />}
        {del && <ConfirmDialog title="Delete this record?" body="It will no longer count in totals." confirmLabel="Delete" pending={remove.isPending} onClose={() => setDel(null)} onConfirm={() => remove.mutate(del, { onSuccess: () => setDel(null) })} />}
      </AnimatePresence>
    </div>
  );
}
