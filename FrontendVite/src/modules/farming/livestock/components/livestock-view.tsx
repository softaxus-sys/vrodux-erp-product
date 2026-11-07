import * as React from "react";
import { AnimatePresence } from "framer-motion";
import { Beef, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Can } from "@/components/auth/can";
import { formatDate } from "@/lib/utils";
import { useAct, useAnimal, useAnimals, useBatches, useEnabledTypes } from "@/hooks/farming/use-farming";
import { farmingApi, farmTypeLabel, localToday, type AnimalDto, type BatchDto } from "@/lib/farming/farming.api";
import { ConfirmDialog, FormModal, Modal, PageHeader, Pill, SearchBox, TableState, Tabs, TH, num, orUndef, useDebounced } from "../../shared/ui";
import { useFarmOptions } from "../../shared/options";

function AnimalForm({ item, onClose }: { item?: AnimalDto; onClose: () => void }) {
  const o = useFarmOptions();
  const individual = ["dairy", "goat_sheep", "cattle"];
  const save = useAct((b: Record<string, unknown>) => farmingApi.saveAnimal(item?.id, b), "Animal saved.");
  const parents = (sex: string) => o.rawAnimals.filter(a => a.sex === sex && a.id !== item?.id).map(a => ({ value: a.id, label: `${a.tagNumber}${a.name ? ` — ${a.name}` : ""}` }));
  return (
    <FormModal title={item ? `Edit ${item.tagNumber}` : "Add animal"} size="lg" pending={save.isPending} onClose={onClose}
      initial={{ tagNumber: item?.tagNumber ?? "", name: item?.name ?? "", type: item?.type ?? o.types.find(t => individual.includes(t.value))?.value ?? "dairy", species: item?.species ?? "", breed: item?.breed ?? "",
        sex: item?.sex ?? "female", birthDate: item?.birthDate ?? "", unitId: item?.unitId ?? "", damId: item?.damId ?? "", sireId: item?.sireId ?? "", source: item?.source ?? "purchased",
        acquiredOn: item?.acquiredOn ?? "", purchasePrice: String(item?.purchasePrice ?? 0), notes: item?.notes ?? "" }}
      fields={[
        { key: "tagNumber", label: "Tag / ear number", required: true }, { key: "name", label: "Name" },
        { key: "type", label: "Type of farming", type: "select", required: true, options: o.types.filter(t => individual.includes(t.value)) },
        { key: "species", label: "Species", placeholder: "Cow, buffalo, goat, sheep…" }, { key: "breed", label: "Breed" },
        { key: "sex", label: "Sex", type: "select", required: true, options: [{ value: "female", label: "Female" }, { value: "male", label: "Male" }] },
        { key: "birthDate", label: "Date of birth", type: "date" }, { key: "unitId", label: "Kept in", type: "select", options: o.units },
        { key: "damId", label: "Mother", type: "select", options: parents("female") }, { key: "sireId", label: "Father", type: "select", options: parents("male") },
        { key: "source", label: "Came from", type: "select", required: true, options: [{ value: "purchased", label: "Bought" }, { value: "born", label: "Born on the farm" }] },
        { key: "acquiredOn", label: "Date acquired", type: "date" }, { key: "purchasePrice", label: "Purchase price", type: "number" }, { key: "notes", label: "Notes", type: "textarea" },
      ]}
      onSubmit={v => save.mutate({ tagNumber: String(v.tagNumber).trim(), name: orUndef(v.name), type: v.type, species: orUndef(v.species), breed: orUndef(v.breed), sex: v.sex, birthDate: orUndef(v.birthDate),
        unitId: orUndef(v.unitId), damId: orUndef(v.damId), sireId: orUndef(v.sireId), source: v.source, acquiredOn: orUndef(v.acquiredOn), purchasePrice: num(v.purchasePrice), notes: orUndef(v.notes) }, { onSuccess: onClose })} />
  );
}

function BatchForm({ item, onClose }: { item?: BatchDto; onClose: () => void }) {
  const o = useFarmOptions();
  const save = useAct((b: Record<string, unknown>) => farmingApi.saveBatch(item?.id, b), "Batch saved.");
  return (
    <FormModal title={item ? `Edit ${item.code}` : "Add batch"} size="lg" pending={save.isPending} onClose={onClose}
      initial={{ code: item?.code ?? "", type: item?.type ?? o.types.find(t => !["dairy", "goat_sheep", "cattle"].includes(t.value))?.value ?? "poultry", species: item?.species ?? "", breed: item?.breed ?? "",
        unitId: item?.unitId ?? "", startDate: item?.startDate ?? localToday(), initialCount: String(item?.initialCount ?? ""), area: String(item?.area ?? ""), initialCost: String(item?.initialCost ?? 0),
        expectedEndDate: item?.expectedEndDate ?? "", notes: item?.notes ?? "" }}
      fields={[
        { key: "code", label: "Batch name / code", required: true, placeholder: "Layers Jan-26, Pond 2 tilapia…" },
        { key: "type", label: "Type of farming", type: "select", required: true, options: o.types },
        { key: "species", label: "Species / crop", placeholder: "Layers, broilers, tilapia, wheat…" }, { key: "breed", label: "Breed / variety" },
        { key: "unitId", label: "Kept in", type: "select", options: o.units }, { key: "startDate", label: "Start date", type: "date", required: true },
        { key: "initialCount", label: "Started with", type: "number", hint: "Birds, fish, plants or hives." }, { key: "area", label: "Area (acres)", type: "number", hint: "For crops." },
        { key: "initialCost", label: "Cost of stock", type: "number" }, { key: "expectedEndDate", label: "Expected to finish", type: "date" }, { key: "notes", label: "Notes", type: "textarea" },
      ]}
      onSubmit={v => save.mutate({ code: String(v.code).trim(), type: v.type, species: orUndef(v.species), breed: orUndef(v.breed), unitId: orUndef(v.unitId), startDate: v.startDate,
        initialCount: Math.round(num(v.initialCount)), area: num(v.area), initialCost: num(v.initialCost), expectedEndDate: orUndef(v.expectedEndDate), notes: orUndef(v.notes) }, { onSuccess: onClose })} />
  );
}

function AnimalDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = useAnimal(id);
  const o = useFarmOptions();
  const [form, setForm] = React.useState<"weight" | "breed" | "status" | "outcome" | null>(null);
  const [outcomeId, setOutcomeId] = React.useState("");
  const act = useAct((f: () => Promise<unknown>) => f(), "Saved.");
  if (!data) return null;
  const a = data.animal;
  return (
    <Modal side size="lg" onClose={onClose} title={`${a.tagNumber}${a.name ? ` — ${a.name}` : ""}`}
      subtitle={`${farmTypeLabel(a.type)} · ${a.breed ?? a.species ?? ""} · ${a.sex}${a.birthDate ? ` · born ${formatDate(a.birthDate)}` : ""}`}>
      <div className="flex flex-wrap items-center gap-2"><Pill state={a.status} />
        {a.pregnantDueOn && <Pill state="pending" label={`Due ${formatDate(a.pregnantDueOn)}`} />}
        {a.withdrawalUntil && <Pill state="overdue" label={`Do not sell milk/meat until ${formatDate(a.withdrawalUntil)}`} />}</div>
      <div className="flex flex-wrap gap-2">
        <Can permission="farming.livestock.create"><Button size="sm" variant="outline" onClick={() => setForm("weight")}>Weigh</Button></Can>
        {a.sex === "female" && <Can permission="farming.livestock.create"><Button size="sm" variant="outline" onClick={() => setForm("breed")}>Record service</Button></Can>}
        {a.status === "active" && <Can permission="farming.livestock.edit"><Button size="sm" variant="outline" onClick={() => setForm("status")}>Mark culled</Button></Can>}
        {a.status === "culled" && <Can permission="farming.livestock.edit"><Button size="sm" variant="outline" onClick={() => act.mutate(() => farmingApi.animalStatus(a.id, { status: "active" }))}>Back to active</Button></Can>}
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div><dt className="text-xs text-muted-foreground">Last weight</dt><dd>{a.lastWeightKg ? `${a.lastWeightKg} kg` : "—"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Production, 30 days</dt><dd>{a.production30d.toLocaleString()}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Mother</dt><dd>{a.damTag ?? "—"}</dd></div><div><dt className="text-xs text-muted-foreground">Father</dt><dd>{a.sireTag ?? "—"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Kept in</dt><dd>{a.unitName ?? "—"}</dd></div>
      </dl>
      <Section title="Breeding">{data.breeding.length === 0 ? "None recorded." : data.breeding.map(b => (
        <div key={b.id} className="flex items-center justify-between gap-2 text-sm py-1"><span>{formatDate(b.serviceDate)} · {b.method === "ai" ? "AI" : "natural"}{b.sireTag ? ` · ${b.sireTag}` : b.sireNote ? ` · ${b.sireNote}` : ""}{b.expectedOn ? ` · due ${formatDate(b.expectedOn)}` : ""}</span>
          <span className="flex items-center gap-2"><Pill state={b.outcome} label={b.outcome === "born" ? `Born ${b.offspring}` : undefined} />
            {b.outcome === "pending" && <Can permission="farming.livestock.edit"><Button size="sm" variant="outline" onClick={() => { setOutcomeId(b.id); setForm("outcome"); }}>Outcome</Button></Can>}</span></div>))}</Section>
      <Section title="Recent production">{data.production.length === 0 ? "None recorded." : data.production.slice(0, 10).map(p => (
        <p key={p.id} className="text-sm">{formatDate(p.date)} · {p.quantity} {p.uom} {p.product}{p.session ? ` (${p.session})` : ""}</p>))}</Section>
      <Section title="Health">{data.health.length === 0 ? "None recorded." : data.health.slice(0, 10).map(h => (
        <p key={h.id} className="text-sm">{formatDate(h.date)} · {h.title}{h.nextDueOn ? ` · next ${formatDate(h.nextDueOn)}` : ""}</p>))}</Section>
      <Section title="Weights">{data.weights.length === 0 ? "None recorded." : data.weights.slice(0, 10).map(w => <p key={w.id} className="text-sm">{formatDate(w.date)} · {w.weightKg} kg</p>)}</Section>
      {data.offspring.length > 0 && <Section title="Offspring">{data.offspring.map(k => <p key={k.id} className="text-sm">{k.tagNumber} · {k.sex} · {k.birthDate ? formatDate(k.birthDate) : ""}</p>)}</Section>}
      <AnimatePresence>
        {form === "weight" && <FormModal title="Weigh" size="sm" pending={act.isPending} onClose={() => setForm(null)} initial={{ date: localToday(), weightKg: "", notes: "" }}
          fields={[{ key: "date", label: "Date", type: "date", required: true }, { key: "weightKg", label: "Weight (kg)", type: "number", required: true }, { key: "notes", label: "Notes" }]}
          onSubmit={v => act.mutate(() => farmingApi.addWeight({ date: v.date, animalId: a.id, weightKg: num(v.weightKg), sampleSize: 1, notes: orUndef(v.notes) }), { onSuccess: () => setForm(null) })} />}
        {form === "breed" && <FormModal title="Record service" size="sm" pending={act.isPending} onClose={() => setForm(null)} initial={{ serviceDate: localToday(), method: "natural", sireId: "", sireNote: "", expectedOn: "", notes: "" }}
          fields={[{ key: "serviceDate", label: "Service date", type: "date", required: true }, { key: "method", label: "Method", type: "select", required: true, options: [{ value: "natural", label: "Natural" }, { value: "ai", label: "Artificial insemination" }] },
            { key: "sireId", label: "Sire on the farm", type: "select", options: o.rawAnimals.filter(x => x.sex === "male").map(x => ({ value: x.id, label: x.tagNumber })) },
            { key: "sireNote", label: "Or bull / straw code" }, { key: "expectedOn", label: "Expected birth", type: "date", hint: "Blank = worked out for the species." }, { key: "notes", label: "Notes" }]}
          onSubmit={v => act.mutate(() => farmingApi.saveBreeding(undefined, { animalId: a.id, serviceDate: v.serviceDate, method: v.method, sireId: orUndef(v.sireId), sireNote: orUndef(v.sireNote), expectedOn: orUndef(v.expectedOn), notes: orUndef(v.notes) }), { onSuccess: () => setForm(null) })} />}
        {form === "outcome" && <FormModal title="Service outcome" size="sm" pending={act.isPending} onClose={() => setForm(null)} initial={{ outcome: "born", on: localToday(), offspring: "1" }}
          fields={[{ key: "outcome", label: "Outcome", type: "select", required: true, options: [{ value: "born", label: "Born" }, { value: "failed", label: "Failed" }] }, { key: "on", label: "Date", type: "date" }, { key: "offspring", label: "Number born", type: "number" }]}
          onSubmit={v => act.mutate(() => farmingApi.breedingOutcome(outcomeId, { outcome: String(v.outcome), on: orUndef(v.on), offspring: Math.round(num(v.offspring)) }), { onSuccess: () => setForm(null) })} />}
        {form === "status" && <FormModal title="Mark culled" size="sm" pending={act.isPending} onClose={() => setForm(null)} initial={{ date: localToday(), reason: "" }}
          fields={[{ key: "date", label: "Date", type: "date" }, { key: "reason", label: "Reason", type: "textarea" }]}
          onSubmit={v => act.mutate(() => farmingApi.animalStatus(a.id, { status: "culled", date: orUndef(v.date), reason: orUndef(v.reason) }), { onSuccess: () => setForm(null) })} />}
      </AnimatePresence>
    </Modal>
  );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{title}</p>
    {typeof children === "string" ? <p className="text-sm text-muted-foreground">{children}</p> : children}</div>);

function AnimalsPanel() {
  const types = useEnabledTypes().filter(t => t.individual);
  const [type, setType] = React.useState(""), [status, setStatus] = React.useState("active"), [q, setQ] = React.useState("");
  const search = useDebounced(q);
  const { data = [], isLoading, error } = useAnimals({ type, status, search });
  const [edit, setEdit] = React.useState<AnimalDto | "new" | null>(null);
  const [open, setOpen] = React.useState<string | null>(null);
  const [del, setDel] = React.useState<AnimalDto | null>(null);
  const remove = useAct((id: string) => farmingApi.deleteAnimal(id), "Removed.");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <SearchBox value={q} onChange={setQ} placeholder="Tag, name or breed" className="w-56" />
        <select className="h-9 rounded-md border border-input bg-card px-3 text-sm" value={type} onChange={e => setType(e.target.value)}><option value="">All types</option>{types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
        <select className="h-9 rounded-md border border-input bg-card px-3 text-sm" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Any status</option>{["active", "sold", "dead", "culled"].map(s => <option key={s} value={s}>{s}</option>)}</select>
        <Can permission="farming.livestock.create"><Button size="sm" className="gap-1.5 ms-auto" onClick={() => setEdit("new")}><Plus className="h-4 w-4" />Add animal</Button></Can>
      </div>
      <Card className="overflow-hidden"><TableState loading={isLoading} error={error as Error | null} empty={data.length === 0} emptyText="No animals match." icon={Beef} />
        {data.length > 0 && <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/40 text-xs"><tr><th className={TH}>Tag</th><th className={TH}>Type</th><th className={TH}>Breed</th><th className={TH}>Sex</th><th className={TH}>Kept in</th><th className={TH}>Weight</th><th className={TH}>30-day output</th><th className={TH}>Status</th><th /></tr></thead>
          <tbody>{data.map(a => (
            <tr key={a.id} className="border-t border-border hover:bg-muted/30 cursor-pointer" onClick={() => setOpen(a.id)}>
              <td className="px-4 py-2 font-medium">{a.tagNumber}{a.name ? <span className="text-muted-foreground font-normal"> {a.name}</span> : null}</td><td className="px-4">{farmTypeLabel(a.type)}</td>
              <td className="px-4">{a.breed ?? "—"}</td><td className="px-4 capitalize">{a.sex}</td><td className="px-4">{a.unitName ?? "—"}</td><td className="px-4 tabular-nums">{a.lastWeightKg ? `${a.lastWeightKg} kg` : "—"}</td>
              <td className="px-4 tabular-nums">{a.production30d ? a.production30d.toLocaleString() : "—"}</td><td className="px-4"><Pill state={a.status} /></td>
              <td className="px-4 text-end whitespace-nowrap" onClick={e => e.stopPropagation()}><Can permission="farming.livestock.edit"><Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEdit(a)}><Pencil className="h-4 w-4" /></Button></Can>
                <Can permission="farming.livestock.delete"><Button size="icon" variant="ghost" aria-label="Delete" onClick={() => setDel(a)}><Trash2 className="h-4 w-4" /></Button></Can></td></tr>))}</tbody></table></div>}
      </Card>
      <AnimatePresence>{edit && <AnimalForm item={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} />}
        {open && <AnimalDrawer id={open} onClose={() => setOpen(null)} />}
        {del && <ConfirmDialog title={`Delete ${del.tagNumber}?`} body="Animals with production or sales on record cannot be deleted; mark them culled instead." confirmLabel="Delete" pending={remove.isPending} onClose={() => setDel(null)} onConfirm={() => remove.mutate(del.id, { onSuccess: () => setDel(null) })} />}</AnimatePresence>
    </div>
  );
}

function BatchesPanel() {
  const [status, setStatus] = React.useState("active");
  const { data = [], isLoading, error } = useBatches({ status });
  const [edit, setEdit] = React.useState<BatchDto | "new" | null>(null);
  const [del, setDel] = React.useState<BatchDto | null>(null);
  const remove = useAct((id: string) => farmingApi.deleteBatch(id), "Removed.");
  const close = useAct((v: { id: string; reopen: boolean }) => farmingApi.closeBatch(v.id, v.reopen), "Updated.");
  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <select className="h-9 rounded-md border border-input bg-card px-3 text-sm" value={status} onChange={e => setStatus(e.target.value)}><option value="active">Active</option><option value="closed">Closed</option><option value="">All</option></select>
        <Can permission="farming.livestock.create"><Button size="sm" className="gap-1.5 ms-auto" onClick={() => setEdit("new")}><Plus className="h-4 w-4" />Add batch</Button></Can>
      </div>
      <Card className="overflow-hidden"><TableState loading={isLoading} error={error as Error | null} empty={data.length === 0} emptyText="No batches yet. A batch is a flock, a pond of fish, a crop planting or a set of hives." icon={Beef} />
        {data.length > 0 && <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/40 text-xs"><tr><th className={TH}>Batch</th><th className={TH}>Type</th><th className={TH}>Kept in</th><th className={TH}>Age</th><th className={TH}>Now / started</th><th className={TH}>Deaths</th><th className={TH}>Feed cost</th><th className={TH}>FCR</th><th className={TH}>Status</th><th /></tr></thead>
          <tbody>{data.map(b => (
            <tr key={b.id} className="border-t border-border"><td className="px-4 py-2 font-medium">{b.code}{b.species ? <span className="text-muted-foreground font-normal"> {b.species}</span> : null}</td><td className="px-4">{farmTypeLabel(b.type)}</td><td className="px-4">{b.unitName ?? "—"}</td>
              <td className="px-4">{b.ageDays} d</td><td className="px-4 tabular-nums">{b.currentCount.toLocaleString()} / {b.initialCount.toLocaleString()}</td><td className="px-4 tabular-nums">{b.deaths} ({b.mortalityPct}%)</td>
              <td className="px-4 tabular-nums">{b.feedCost.toLocaleString()}</td><td className="px-4">{b.fcr ?? "—"}</td><td className="px-4"><Pill state={b.status} /></td>
              <td className="px-4 text-end whitespace-nowrap"><Can permission="farming.livestock.edit"><Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEdit(b)}><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="outline" onClick={() => close.mutate({ id: b.id, reopen: b.status === "closed" })}>{b.status === "closed" ? "Reopen" : "Close"}</Button></Can>
                <Can permission="farming.livestock.delete"><Button size="icon" variant="ghost" aria-label="Delete" onClick={() => setDel(b)}><Trash2 className="h-4 w-4" /></Button></Can></td></tr>))}</tbody></table></div>}
      </Card>
      <AnimatePresence>{edit && <BatchForm item={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} />}
        {del && <ConfirmDialog title={`Delete ${del.code}?`} body="Batches with production or sales on record cannot be deleted; close them instead." confirmLabel="Delete" pending={remove.isPending} onClose={() => setDel(null)} onConfirm={() => remove.mutate(del.id, { onSuccess: () => setDel(null) })} />}</AnimatePresence>
    </div>
  );
}

export function LivestockView() {
  const [tab, setTab] = React.useState<"animals" | "batches">("animals");
  return (
    <div className="space-y-4">
      <PageHeader title="Animals & batches" description="Individually tagged animals (dairy, goats, sheep, cattle) and batches (flocks, ponds, plantings, hives)." />
      <Tabs value={tab} onChange={v => setTab(v as typeof tab)} items={[{ value: "animals", label: "Animals" }, { value: "batches", label: "Batches" }]} />
      {tab === "animals" ? <AnimalsPanel /> : <BatchesPanel />}
    </div>
  );
}
