import * as React from "react";
import { Pencil, Plus, Trash2, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAct, useHolders, usePositions, useWfBases, useWfContext, useWfUnits } from "@/hooks/workflow/use-workflow";
import { workflowApi, type Holder, type Position } from "@/lib/workflow/workflow.api";
import { Empty, Field, Modal, SELECT, Spinner, TEXTAREA, UserPicker, initials } from "../shared/ui";

function PositionModal({ p, onClose }: { p: Position | null; onClose: () => void }) {
  const [f, setF] = React.useState({ name: p?.name ?? "", description: p?.description ?? "", isActive: p?.isActive ?? true });
  const save = useAct(() => workflowApi.savePosition({ id: p?.id, ...f, description: f.description || null }), "Saved.");
  return (
    <Modal title={p ? "Edit position" : "Add a position"} subtitle="A seat in an approval chain, like “Property Finance”. Chains use positions, so changing who sits in one never touches a chain." size="sm" onClose={onClose}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!f.name.trim() || save.isPending} onClick={async () => { try { await save.mutateAsync(undefined); onClose(); } catch { /* toast */ } }}>Save</Button></>}>
      <div className="space-y-4">
        <Field label="Name" required><Input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Property Manager" /></Field>
        <Field label="What they do"><textarea className={TEXTAREA} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></Field>
        <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={f.isActive} onChange={e => setF({ ...f, isActive: e.target.checked })} /> Active</label>
      </div>
    </Modal>
  );
}

function HolderModal({ position, h, onClose }: { position: Position; h: Holder | null; onClose: () => void }) {
  const bases = useWfBases(); const units = useWfUnits(); const ctx = useWfContext();
  const [who, setWho] = React.useState<{ id: string; name: string; email: string } | null>(h ? { id: h.userId, name: h.userName, email: h.email ?? "" } : null);
  const [f, setF] = React.useState({ baseId: h?.baseId ?? "", unitId: h?.unitId ?? "", designation: h?.designation ?? "" });
  const save = useAct(() => workflowApi.saveHolder({ id: h?.id, positionId: position.id, baseId: f.baseId || null, unitId: f.unitId || null,
    userId: who!.id, userName: who!.name, email: who!.email || null, designation: f.designation || null }), "Saved.");
  return (
    <Modal title={h ? "Edit who holds this" : `Who holds “${position.name}”`} size="md" onClose={onClose}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!who || save.isPending} onClick={async () => { try { await save.mutateAsync(undefined); onClose(); } catch { /* toast */ } }}>Save</Button></>}>
      <div className="space-y-4">
        {who ? (
          <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"><span className="size-8 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{initials(who.name)}</span>
            <div className="min-w-0 flex-1"><p className="font-medium leading-tight">{who.name}</p><p className="text-xs text-muted-foreground">{who.email}</p></div>
            {!h && <Button variant="ghost" size="sm" onClick={() => setWho(null)}>Change</Button>}</div>
        ) : <Field label="Person" required><UserPicker onPick={setWho} /></Field>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={ctx.data?.settings.locationLabel ?? "Base"} hint="Leave on “Everywhere” to cover every location."><select className={SELECT} value={f.baseId} onChange={e => setF({ ...f, baseId: e.target.value })}><option value="">Everywhere</option>{(bases.data ?? []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
          <Field label={ctx.data?.settings.unitLabel ?? "Business unit"} hint="Leave on “Every unit” to cover all."><select className={SELECT} value={f.unitId} onChange={e => setF({ ...f, unitId: e.target.value })}><option value="">Every unit</option>{(units.data ?? []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
        </div>
        <Field label="Designation on the PDF" hint="Printed next to their name on every approval or rejection record."><Input value={f.designation} onChange={e => setF({ ...f, designation: e.target.value })} placeholder={position.name} /></Field>
      </div>
    </Modal>
  );
}

function PositionDetail({ p, onClose }: { p: Position; onClose: () => void }) {
  const holders = useHolders(p.id);
  const [edit, setEdit] = React.useState<Holder | "new" | null>(null);
  const del = useAct((id: string) => workflowApi.deleteHolder(id), "Removed.");
  return (
    <Modal title={p.name} subtitle={p.description ?? "People who hold this position"} size="lg" side onClose={onClose}
      footer={<Button onClick={() => setEdit("new")}><Plus className="size-4" /> Add a person</Button>}>
      <p className="text-sm text-muted-foreground mb-4">When a request reaches a step using this position, it goes to whoever holds it for that request's location and unit. The most specific match wins: location + unit, then location, then unit, then everywhere.</p>
      {holders.isLoading ? <Spinner className="py-6" /> : (holders.data?.length ?? 0) === 0 ? <Empty icon={UserCheck} title="No one holds this yet" hint="Requests that need this position can't be submitted until someone does." /> : (
        <ul className="space-y-2">
          {holders.data!.map(h => (
            <li key={h.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
              <span className="size-9 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{initials(h.userName)}</span>
              <div className="min-w-0 flex-1"><p className="font-medium leading-tight">{h.userName}{h.designation && <span className="text-muted-foreground font-normal"> · {h.designation}</span>}</p>
                <p className="text-xs text-muted-foreground">{h.baseName ?? "Every location"} · {h.unitName ?? "every unit"}</p></div>
              <button className="p-1.5 rounded hover:bg-muted text-muted-foreground" aria-label="Edit" onClick={() => setEdit(h)}><Pencil className="size-4" /></button>
              <button className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive" aria-label="Remove" onClick={() => del.mutate(h.id)}><Trash2 className="size-4" /></button>
            </li>))}
        </ul>
      )}
      {edit && <HolderModal position={p} h={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </Modal>
  );
}

export function PositionsTab() {
  const list = usePositions();
  const [edit, setEdit] = React.useState<Position | "new" | null>(null);
  const [open, setOpen] = React.useState<string | null>(null);
  const del = useAct((id: string) => workflowApi.deletePosition(id), "Removed.");
  const openPos = list.data?.find(p => p.id === open) ?? null;
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div><h3 className="font-bold">Positions and who holds them</h3><p className="text-xs text-muted-foreground">Approval chains name positions. Choose the people behind each one.</p></div>
        <Button size="sm" onClick={() => setEdit("new")}><Plus className="size-4" /> Add position</Button></div>
      {list.isLoading ? <Spinner className="py-6" /> : (list.data?.length ?? 0) === 0 ? <Empty icon={UserCheck} title="No positions yet" hint="Add the seats in your approval chains, like Finance Manager or Security." /> : (
        <ul className="divide-y divide-border">
          {list.data!.map(p => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
              <button className="min-w-0 flex-1 text-start" onClick={() => setOpen(p.id)}>
                <p className="font-medium leading-tight">{p.name}{!p.isActive && <span className="ms-2 text-[10px] uppercase text-muted-foreground">off</span>}</p>
                <p className="text-xs text-muted-foreground">{p.holderCount === 0 ? <span className="text-amber-600 font-medium">No one holds this yet</span> : `${p.holderCount} ${p.holderCount === 1 ? "assignment" : "assignments"}`} · used in {p.flowCount} {p.flowCount === 1 ? "step" : "steps"}</p></button>
              <Button variant="outline" size="sm" onClick={() => setOpen(p.id)}>People</Button>
              <button className="p-1.5 rounded hover:bg-muted text-muted-foreground" aria-label="Edit" onClick={() => setEdit(p)}><Pencil className="size-4" /></button>
              <button className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive" aria-label="Delete" onClick={() => del.mutate(p.id)}><Trash2 className="size-4" /></button>
            </li>))}
        </ul>
      )}
      {edit && <PositionModal p={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
      {openPos && <PositionDetail p={openPos} onClose={() => setOpen(null)} />}
    </section>
  );
}
