import * as React from "react";
import { AnimatePresence } from "framer-motion";
import { Check, Plus, Syringe, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Can } from "@/components/auth/can";
import { formatDate } from "@/lib/utils";
import { useAct, useHealth, useMortality } from "@/hooks/farming/use-farming";
import { farmingApi, localToday } from "@/lib/farming/farming.api";
import { ConfirmDialog, FormModal, PageHeader, Pill, TableState, Tabs, TH, num, orUndef } from "../../shared/ui";
import { monthAgo, useFarmOptions } from "../../shared/options";

const KINDS = ["vaccination", "treatment", "deworming", "checkup", "other"].map(k => ({ value: k, label: k[0].toUpperCase() + k.slice(1) }));

export function HealthView() {
  const today = localToday();
  const [tab, setTab] = React.useState<"due" | "history" | "deaths">("due");
  const due = useHealth({ dueOnly: true });
  const hist = useHealth({ from: monthAgo(today), to: today });
  const deaths = useMortality({ from: monthAgo(today), to: today });
  const o = useFarmOptions();
  const [form, setForm] = React.useState<"health" | "death" | null>(null);
  const [del, setDel] = React.useState<{ kind: "health" | "death"; id: string } | null>(null);
  const saveH = useAct((b: Record<string, unknown>) => farmingApi.saveHealth(undefined, b), "Recorded.");
  const saveD = useAct((b: Record<string, unknown>) => farmingApi.addMortality(b), "Recorded.");
  const done = useAct((id: string) => farmingApi.healthDone(id), "Marked done.");
  const remove = useAct((d: { kind: string; id: string }) => d.kind === "health" ? farmingApi.deleteHealth(d.id) : farmingApi.deleteMortality(d.id), "Removed.");
  const subject = (animalId?: string, batchId?: string) => animalId ? { animalId } : { batchId };
  const rows = tab === "due" ? due : hist;

  return (
    <div className="space-y-4">
      <PageHeader title="Health" description="Vaccinations, treatments and follow-ups, and deaths.">
        <Can permission="farming.health.create"><Button size="sm" variant="outline" className="gap-1.5" onClick={() => setForm("death")}><Plus className="h-4 w-4" />Record death</Button></Can>
        <Can permission="farming.health.create"><Button size="sm" className="gap-1.5" onClick={() => setForm("health")}><Plus className="h-4 w-4" />Record vaccination / treatment</Button></Can>
      </PageHeader>
      <Tabs value={tab} onChange={v => setTab(v as typeof tab)} items={[{ value: "due", label: "Follow-ups due" }, { value: "history", label: "Last 30 days" }, { value: "deaths", label: "Deaths" }]} />
      <Card className="overflow-hidden">
        {tab !== "deaths" ? (<>
          <TableState loading={rows.isLoading} error={rows.error as Error | null} empty={(rows.data ?? []).length === 0} emptyText={tab === "due" ? "No follow-ups scheduled." : "Nothing recorded in the last 30 days."} icon={Syringe} />
          {(rows.data ?? []).length > 0 && <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/40 text-xs"><tr><th className={TH}>Date</th><th className={TH}>What</th><th className={TH}>For</th><th className={TH}>Next due</th><th className={TH}>Vet / cost</th><th /></tr></thead>
            <tbody>{rows.data!.map(h => (<tr key={h.id} className="border-t border-border"><td className="px-4 py-2">{formatDate(h.date)}</td>
              <td className="px-4"><span className="font-medium">{h.title}</span><span className="text-xs text-muted-foreground"> · {h.kind}{h.medicine ? ` · ${h.medicine}` : ""}{h.dose ? ` ${h.dose}` : ""}</span>
                {h.withdrawalUntil && string_after(h.withdrawalUntil, today) && <span className="block text-xs text-amber-600">No milk/meat sales until {formatDate(h.withdrawalUntil)}</span>}</td>
              <td className="px-4">{h.animalTag ?? h.batchCode ?? "—"}</td><td className="px-4">{h.nextDueOn ? <>{formatDate(h.nextDueOn)} {h.overdue && <Pill state="overdue" />}</> : "—"}</td>
              <td className="px-4 text-muted-foreground">{[h.vetName, h.cost ? h.cost.toLocaleString() : ""].filter(Boolean).join(" · ") || "—"}</td>
              <td className="px-4 text-end whitespace-nowrap"><Can permission="farming.health.edit">{h.nextDueOn && <Button size="sm" variant="outline" className="gap-1" onClick={() => done.mutate(h.id)}><Check className="h-3.5 w-3.5" />Done</Button>}</Can>
                <Can permission="farming.health.delete"><Button size="icon" variant="ghost" aria-label="Delete" onClick={() => setDel({ kind: "health", id: h.id })}><Trash2 className="h-4 w-4" /></Button></Can></td></tr>))}</tbody></table></div>}
        </>) : (<>
          <TableState loading={deaths.isLoading} error={deaths.error as Error | null} empty={(deaths.data ?? []).length === 0} emptyText="No deaths in the last 30 days." icon={Syringe} />
          {(deaths.data ?? []).length > 0 && <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/40 text-xs"><tr><th className={TH}>Date</th><th className={TH}>Animal / batch</th><th className={TH}>Count</th><th className={TH}>Cause</th><th /></tr></thead>
            <tbody>{deaths.data!.map(d => (<tr key={d.id} className="border-t border-border"><td className="px-4 py-2">{formatDate(d.date)}</td><td className="px-4">{d.animalTag ?? d.batchCode}</td><td className="px-4">{d.count}</td><td className="px-4 text-muted-foreground">{d.cause ?? "—"}</td>
              <td className="px-4 text-end"><Can permission="farming.health.delete"><Button size="icon" variant="ghost" aria-label="Delete" onClick={() => setDel({ kind: "death", id: d.id })}><Trash2 className="h-4 w-4" /></Button></Can></td></tr>))}</tbody></table></div>}
        </>)}
      </Card>
      <AnimatePresence>
        {form === "health" && <FormModal title="Record vaccination / treatment" size="lg" pending={saveH.isPending} onClose={() => setForm(null)}
          initial={{ date: today, kind: "vaccination", title: "", medicine: "", dose: "", vetName: "", cost: "0", nextDueOn: "", withdrawalDays: "0", animalId: "", batchId: "", notes: "" }}
          fields={[{ key: "date", label: "Date", type: "date", required: true }, { key: "kind", label: "Kind", type: "select", required: true, options: KINDS }, { key: "title", label: "What was given / done", required: true },
            { key: "animalId", label: "Animal", type: "select", options: o.animals, hint: "Choose an animal or a batch." }, { key: "batchId", label: "Batch", type: "select", options: o.batches },
            { key: "medicine", label: "Medicine / vaccine" }, { key: "dose", label: "Dose" }, { key: "vetName", label: "Vet" }, { key: "cost", label: "Cost", type: "number" },
            { key: "nextDueOn", label: "Next due", type: "date", hint: "Puts it on the follow-ups list." }, { key: "withdrawalDays", label: "Withdrawal days", type: "number", hint: "Days milk or meat cannot be sold." }, { key: "notes", label: "Notes", type: "textarea" }]}
          onSubmit={v => saveH.mutate({ date: v.date, kind: v.kind, title: String(v.title).trim(), medicine: orUndef(v.medicine), dose: orUndef(v.dose), vetName: orUndef(v.vetName), cost: num(v.cost), nextDueOn: orUndef(v.nextDueOn),
            withdrawalDays: Math.round(num(v.withdrawalDays)), ...subject(orUndef(v.animalId), orUndef(v.batchId)), notes: orUndef(v.notes) }, { onSuccess: () => setForm(null) })} />}
        {form === "death" && <FormModal title="Record death" size="sm" pending={saveD.isPending} onClose={() => setForm(null)}
          initial={{ date: today, animalId: "", batchId: "", count: "1", cause: "", notes: "" }}
          fields={[{ key: "date", label: "Date", type: "date", required: true }, { key: "animalId", label: "Animal", type: "select", options: o.animals, hint: "An animal, or a batch with a count." }, { key: "batchId", label: "Batch", type: "select", options: o.batches },
            { key: "count", label: "How many (batch)", type: "number" }, { key: "cause", label: "Cause" }, { key: "notes", label: "Notes", type: "textarea" }]}
          onSubmit={v => saveD.mutate({ date: v.date, ...subject(orUndef(v.animalId), orUndef(v.batchId)), count: Math.round(num(v.count)) || 1, cause: orUndef(v.cause), notes: orUndef(v.notes) }, { onSuccess: () => setForm(null) })} />}
        {del && <ConfirmDialog title="Delete this record?" body={del.kind === "death" ? "An animal marked dead by this record will be set back to active." : "It will no longer appear in the history."} confirmLabel="Delete" pending={remove.isPending} onClose={() => setDel(null)} onConfirm={() => remove.mutate(del, { onSuccess: () => setDel(null) })} />}
      </AnimatePresence>
    </div>
  );
}

const string_after = (a: string, b: string) => a > b;
