import * as React from "react";
import { AnimatePresence } from "framer-motion";
import { Plus, Wrench, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Can } from "@/components/auth/can";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { EQUIPMENT_STATUSES, fitnessApi, localToday, type EquipmentDto, type LockerDto } from "@/lib/fitness/fitness.api";
import { useAct, useBranches, useEquipment, useLockers, useMaintenance, useMembers, useWorkingBranch } from "@/hooks/fitness/use-fitness";
import { Field, FormModal, Modal, PageHeader, Pill, SELECT, Tabs, TableState, TH, num, orUndef, useDebounced } from "../../shared/ui";

function EquipmentForm({ item, branchId, onClose }: { item?: EquipmentDto; branchId: string; onClose: () => void }) {
  const { data: branches = [] } = useBranches(true);
  const save = useAct((b: Record<string, unknown>) => fitnessApi.saveEquipment(item?.id ?? null, b), "Equipment saved.", ["equipment", "dashboard"]);
  return (
    <FormModal title={item ? `Edit ${item.name}` : "Add equipment"} size="lg" pending={save.isPending} onClose={onClose}
      initial={{ name: item?.name ?? "", category: item?.category ?? "", brand: item?.brand ?? "", model: item?.model ?? "", serialNumber: item?.serialNumber ?? "", branchId: item?.branchId ?? branchId,
        location: item?.location ?? "", purchasedOn: item?.purchasedOn ?? "", purchaseCost: String(item?.purchaseCost ?? 0), warrantyUntil: item?.warrantyUntil ?? "",
        serviceIntervalDays: String(item?.serviceIntervalDays ?? 90), nextServiceOn: item?.nextServiceOn ?? "", status: item?.status ?? "working", notes: item?.notes ?? "" }}
      fields={[
        { key: "name", label: "Name", required: true }, { key: "category", label: "Category", placeholder: "Cardio, Strength, Free weights…" },
        { key: "brand", label: "Brand" }, { key: "model", label: "Model" }, { key: "serialNumber", label: "Serial number" },
        { key: "branchId", label: "Branch", type: "select", required: true, options: branches.map(b => ({ value: b.id, label: b.name })) },
        { key: "location", label: "Where on the floor" }, { key: "status", label: "Status", type: "select", required: true, options: EQUIPMENT_STATUSES },
        { key: "purchasedOn", label: "Purchased", type: "date" }, { key: "purchaseCost", label: "Cost", type: "number" },
        { key: "warrantyUntil", label: "Warranty until", type: "date" }, { key: "serviceIntervalDays", label: "Service every (days)", type: "number" },
        { key: "nextServiceOn", label: "Next service", type: "date", hint: "Blank = worked out from the interval." }, { key: "notes", label: "Notes", type: "textarea" },
      ]}
      onSubmit={v => save.mutate({ name: String(v.name).trim(), category: orUndef(v.category), brand: orUndef(v.brand), model: orUndef(v.model), serialNumber: orUndef(v.serialNumber), branchId: v.branchId,
        location: orUndef(v.location), purchasedOn: orUndef(v.purchasedOn), purchaseCost: num(v.purchaseCost), warrantyUntil: orUndef(v.warrantyUntil), serviceIntervalDays: num(v.serviceIntervalDays),
        nextServiceOn: orUndef(v.nextServiceOn), status: v.status, notes: orUndef(v.notes) }, { onSuccess: onClose })} />
  );
}

function ServiceModal({ item, onClose }: { item: EquipmentDto; onClose: () => void }) {
  const cur = useCurrency();
  const { data: log = [] } = useMaintenance(item.id);
  const rec = useAct((b: Record<string, unknown>) => fitnessApi.recordMaintenance(item.id, b), "Logged.", ["equipment", "maintenance", "dashboard"]);
  const [adding, setAdding] = React.useState(false);
  return (
    <Modal side size="md" onClose={onClose} title={item.name} subtitle={`${item.branchName ?? ""} · maintenance spend ${formatCurrency(item.maintenanceCost, cur)}`}>
      <Can permission="fitness.facility.edit"><Button size="sm" className="gap-1.5" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" />Log service / repair</Button></Can>
      {log.length === 0 ? <p className="text-sm text-muted-foreground">Nothing logged yet.</p> : (
        <div className="divide-y divide-border">{log.map(m => (
          <div key={m.id} className="py-2 text-sm"><p className="font-medium">{formatDate(m.date)} · {m.type}{m.cost > 0 ? ` · ${formatCurrency(m.cost, cur)}` : ""}</p><p className="text-xs text-muted-foreground">{m.description}{m.performedBy ? ` — ${m.performedBy}` : ""}</p></div>))}</div>)}
      <AnimatePresence>{adding && (
        <FormModal title="Log maintenance" size="sm" pending={rec.isPending} onClose={() => setAdding(false)}
          initial={{ date: localToday(), type: "service", description: "", cost: "0", performedBy: "", statusAfter: "working" }}
          fields={[{ key: "date", label: "Date", type: "date", required: true },
            { key: "type", label: "Type", type: "select", required: true, options: ["service", "repair", "inspection"].map(x => ({ value: x, label: x })) },
            { key: "description", label: "What was done", type: "textarea", required: true }, { key: "cost", label: "Cost", type: "number" }, { key: "performedBy", label: "Done by" },
            { key: "statusAfter", label: "Condition afterwards", type: "select", required: true, options: EQUIPMENT_STATUSES }]}
          onSubmit={v => rec.mutate({ date: v.date, type: v.type, description: String(v.description).trim(), cost: num(v.cost), performedBy: orUndef(v.performedBy), statusAfter: v.statusAfter }, { onSuccess: () => setAdding(false) })} />)}</AnimatePresence>
    </Modal>
  );
}

function EquipmentPanel() {
  const { branchId } = useWorkingBranch();
  const [dueOnly, setDueOnly] = React.useState(false);
  const { data = [], isLoading, error } = useEquipment({ serviceDueOnly: dueOnly });
  const [edit, setEdit] = React.useState<EquipmentDto | "new" | null>(null);
  const [log, setLog] = React.useState<EquipmentDto | null>(null);
  const del = useAct((id: string) => fitnessApi.deleteEquipment(id), "Removed.", ["equipment", "dashboard"]);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Can permission="fitness.facility.create"><Button size="sm" className="gap-1.5" onClick={() => setEdit("new")}><Plus className="h-4 w-4" />Add equipment</Button></Can>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={dueOnly} onChange={e => setDueOnly(e.target.checked)} />Service due only</label>
      </div>
      <Card className="overflow-hidden"><TableState loading={isLoading} error={error as Error | null} empty={data.length === 0} emptyText="No equipment recorded." icon={Wrench} />
        {data.length > 0 && <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/30 text-xs text-muted-foreground"><tr><th className={TH}>Equipment</th><th className={TH}>Branch</th><th className={TH}>Next service</th><th className={TH}>Status</th><th /></tr></thead>
          <tbody className="divide-y divide-border">{data.map(e => (
            <tr key={e.id}><td className="px-4 py-2.5">{e.name}<p className="text-xs text-muted-foreground">{[e.category, e.brand, e.model].filter(Boolean).join(" · ")}</p></td><td className="px-4 py-2.5">{e.branchName}</td>
              <td className={cn("px-4 py-2.5", e.serviceDue && "text-amber-600 font-semibold")}>{e.nextServiceOn ? formatDate(e.nextServiceOn) : "—"}</td><td className="px-4 py-2.5"><Pill state={e.status} /></td>
              <td className="px-4 py-2.5 text-end space-x-2 whitespace-nowrap"><button className="text-xs text-primary" onClick={() => setLog(e)}>History</button>
                <Can permission="fitness.facility.edit"><button className="text-xs text-primary" onClick={() => setEdit(e)}>Edit</button></Can>
                <Can permission="fitness.facility.delete"><button className="text-xs text-red-600" onClick={() => del.mutate(e.id)}>Delete</button></Can></td></tr>))}</tbody></table></div>}
      </Card>
      <AnimatePresence>
        {edit && <EquipmentForm item={edit === "new" ? undefined : edit} branchId={branchId} onClose={() => setEdit(null)} />}
        {log && <ServiceModal item={log} onClose={() => setLog(null)} />}
      </AnimatePresence>
    </div>
  );
}

function AssignModal({ locker, onClose }: { locker: LockerDto; onClose: () => void }) {
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search);
  const { data } = useMembers({ search: q, pageSize: 5 });
  const [until, setUntil] = React.useState("");
  const assign = useAct((memberId: string) => fitnessApi.assignLocker(locker.id, memberId, orUndef(until)), "Locker assigned.", ["lockers", "member"]);
  return (
    <Modal title={`Assign locker ${locker.number}`} size="sm" onClose={onClose}>
      <Field label="Until (optional)"><Input type="date" value={until} onChange={e => setUntil(e.target.value)} className="h-9" /></Field>
      <Field label="Member"><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="h-9" autoFocus /></Field>
      {q && (data?.items ?? []).map(m => <button key={m.id} className="block w-full text-start rounded-md px-3 py-1.5 text-sm hover:bg-muted" onClick={() => assign.mutate(m.id, { onSuccess: onClose })}>{m.fullName} <span className="text-xs text-muted-foreground">{m.memberNumber}</span></button>)}
    </Modal>
  );
}

function LockersPanel() {
  const { branchId, branches, setBranchId } = useWorkingBranch();
  const { data = [], isLoading, error } = useLockers({ branchId: branchId || undefined });
  const [bulk, setBulk] = React.useState(false);
  const [assign, setAssign] = React.useState<LockerDto | null>(null);
  const bulkAdd = useAct((b: Record<string, unknown>) => fitnessApi.addLockers(b), "Lockers added.", ["lockers"]);
  const release = useAct((id: string) => fitnessApi.releaseLocker(id), "Released.", ["lockers", "member"]);
  const del = useAct((id: string) => fitnessApi.deleteLocker(id), "Removed.", ["lockers"]);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Can permission="fitness.facility.create"><Button size="sm" className="gap-1.5" onClick={() => setBulk(true)}><Plus className="h-4 w-4" />Add lockers</Button></Can>
        {branches.length > 1 && <select className={cn(SELECT, "w-auto")} value={branchId} onChange={e => setBranchId(e.target.value)}>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>}
      </div>
      <TableState loading={isLoading} error={error as Error | null} empty={data.length === 0} emptyText="No lockers yet." icon={KeyRound} />
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">{data.map(l => (
        <Card key={l.id} className={cn("p-3 text-sm space-y-1", l.state === "out_of_use" && "opacity-50")}>
          <div className="flex justify-between"><span className="font-bold">{l.number}</span><Pill state={l.state} /></div>
          <p className="text-xs text-muted-foreground truncate">{l.memberName ?? l.area ?? " "}</p>
          <div className="flex gap-2 text-xs">
            {l.state === "available" && <Can permission="fitness.facility.edit"><button className="text-primary" onClick={() => setAssign(l)}>Assign</button></Can>}
            {(l.state === "assigned" || l.state === "expired") && <Can permission="fitness.facility.edit"><button className="text-primary" onClick={() => release.mutate(l.id)}>Release</button></Can>}
            {l.state !== "assigned" && <Can permission="fitness.facility.delete"><button className="text-red-600" onClick={() => del.mutate(l.id)}>Delete</button></Can>}
          </div>
        </Card>))}</div>
      <AnimatePresence>
        {bulk && <FormModal title="Add lockers" size="sm" pending={bulkAdd.isPending} onClose={() => setBulk(false)}
          initial={{ prefix: "", from: "1", to: "20", area: "", monthlyRate: "0" }}
          fields={[{ key: "prefix", label: "Prefix", hint: "e.g. M- for M-1, M-2…" }, { key: "area", label: "Area" }, { key: "from", label: "From number", type: "number", required: true }, { key: "to", label: "To number", type: "number", required: true }, { key: "monthlyRate", label: "Monthly rate", type: "number" }]}
          onSubmit={v => bulkAdd.mutate({ branchId, prefix: orUndef(v.prefix), from: num(v.from), to: num(v.to), area: orUndef(v.area), monthlyRate: num(v.monthlyRate) }, { onSuccess: () => setBulk(false) })} />}
        {assign && <AssignModal locker={assign} onClose={() => setAssign(null)} />}
      </AnimatePresence>
    </div>
  );
}

export function FacilityView() {
  const [tab, setTab] = React.useState<"equipment" | "lockers">("equipment");
  return (
    <div className="space-y-5">
      <PageHeader title="Facility" description="Equipment servicing and member lockers." />
      <Tabs value={tab} onChange={setTab as (v: string) => void} items={[{ value: "equipment", label: "Equipment" }, { value: "lockers", label: "Lockers" }]} />
      {tab === "equipment" ? <EquipmentPanel /> : <LockersPanel />}
    </div>
  );
}
