import * as React from "react";
import { MapPin, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAct, useBaseAccess, useWfBases, useWfContext, useWfUnits } from "@/hooks/workflow/use-workflow";
import { workflowApi, type AccessUser, type WfBase, type WfUnit } from "@/lib/workflow/workflow.api";
import { Empty, Field, Modal, Spinner, UserPicker } from "../shared/ui";

function BaseModal({ b, onClose }: { b: WfBase | null; onClose: () => void }) {
  const [f, setF] = React.useState({ code: b?.code ?? "", name: b?.name ?? "", country: b?.country ?? "", sortOrder: b?.sortOrder ?? 0, isActive: b?.isActive ?? true });
  const save = useAct(() => workflowApi.saveBase({ id: b?.id, ...f, country: f.country || null }), "Saved.");
  return (
    <Modal title={b ? "Edit location" : "Add a location"} size="sm" onClose={onClose}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!f.code.trim() || !f.name.trim() || save.isPending} onClick={async () => { try { await save.mutateAsync(undefined); onClose(); } catch { /* toast */ } }}>Save</Button></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3"><Field label="Code" required><Input value={f.code} maxLength={10} onChange={e => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder="UAE" /></Field>
          <Field label="Name" required className="col-span-2"><Input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="United Arab Emirates" /></Field></div>
        <Field label="Country"><Input value={f.country} onChange={e => setF({ ...f, country: e.target.value })} /></Field>
        <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={f.isActive} onChange={e => setF({ ...f, isActive: e.target.checked })} /> Active — people can raise requests here</label>
      </div>
    </Modal>
  );
}

/** Who may use a location (R2). Admins always can. */
function AccessModal({ b, onClose }: { b: WfBase; onClose: () => void }) {
  const q = useBaseAccess(b.id);
  const [users, setUsers] = React.useState<AccessUser[] | null>(null);
  React.useEffect(() => { if (q.data && users === null) setUsers(q.data.users); }, [q.data, users]);
  const save = useAct(() => workflowApi.setBaseAccess(b.id, users ?? []), "Access saved.");
  return (
    <Modal title={`Who can use ${b.name}`} subtitle="They can raise requests here and file its documents. Administrators can use every location." size="md" onClose={onClose}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={save.isPending || users === null} onClick={async () => { try { await save.mutateAsync(undefined); onClose(); } catch { /* toast */ } }}>Save</Button></>}>
      {users === null ? <Spinner className="py-6" /> : (
        <div className="space-y-4">
          <UserPicker exclude={users.map(u => u.userId)} onPick={u => setUsers([...users, { userId: u.id, userName: u.name }])} />
          {users.length === 0 ? <p className="text-sm text-muted-foreground">No one yet. Only administrators can use this location.</p> : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {users.map(u => <li key={u.userId} className="flex items-center justify-between px-3 py-2 text-sm">{u.userName}
                <button className="p-1 rounded text-muted-foreground hover:text-destructive" aria-label="Remove" onClick={() => setUsers(users.filter(x => x.userId !== u.userId))}><X className="size-4" /></button></li>)}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}

function UnitModal({ u, onClose }: { u: WfUnit | null; onClose: () => void }) {
  const [f, setF] = React.useState({ name: u?.name ?? "", code: u?.code ?? "", sortOrder: u?.sortOrder ?? 0, isActive: u?.isActive ?? true });
  const save = useAct(() => workflowApi.saveUnit({ id: u?.id, ...f, code: f.code || null }), "Saved.");
  return (
    <Modal title={u ? "Edit unit" : "Add a business unit"} size="sm" onClose={onClose}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!f.name.trim() || save.isPending} onClick={async () => { try { await save.mutateAsync(undefined); onClose(); } catch { /* toast */ } }}>Save</Button></>}>
      <div className="space-y-4">
        <Field label="Name" required><Input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Food & Beverage" /></Field>
        <Field label="Short code"><Input value={f.code} maxLength={10} onChange={e => setF({ ...f, code: e.target.value })} /></Field>
        <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={f.isActive} onChange={e => setF({ ...f, isActive: e.target.checked })} /> Active</label>
      </div>
    </Modal>
  );
}

export function LocationsTab() {
  const ctx = useWfContext();
  const bases = useWfBases();
  const units = useWfUnits();
  const [editBase, setEditBase] = React.useState<WfBase | "new" | null>(null);
  const [access, setAccess] = React.useState<WfBase | null>(null);
  const [editUnit, setEditUnit] = React.useState<WfUnit | "new" | null>(null);
  const delBase = useAct((id: string) => workflowApi.deleteBase(id), "Removed.");
  const delUnit = useAct((id: string) => workflowApi.deleteUnit(id), "Removed.");
  const loc = ctx.data?.settings.locationLabel ?? "Base"; const unit = ctx.data?.settings.unitLabel ?? "Business unit";

  return (
    <div className="grid gap-5 lg:grid-cols-2 items-start">
      <section className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border"><h3 className="font-bold">{loc}s</h3><Button size="sm" onClick={() => setEditBase("new")}><Plus className="size-4" /> Add</Button></div>
        {bases.isLoading ? <Spinner className="py-6" /> : (bases.data?.length ?? 0) === 0 ? <Empty icon={MapPin} title={`No ${loc.toLowerCase()}s yet`} hint="Add each place that raises requests, such as a country, property or site." /> : (
          <ul className="divide-y divide-border">
            {bases.data!.map(b => (
              <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                <span className="size-9 rounded-lg bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{b.code}</span>
                <div className="min-w-0 flex-1"><p className="font-medium leading-tight">{b.name}{!b.isActive && <span className="ms-2 text-[10px] uppercase text-muted-foreground">off</span>}</p>
                  <p className="text-xs text-muted-foreground">{b.userCount} {b.userCount === 1 ? "person" : "people"} with access</p></div>
                <Button variant="outline" size="sm" onClick={() => setAccess(b)}><Users className="size-4" /> Access</Button>
                <button className="p-1.5 rounded hover:bg-muted text-muted-foreground" aria-label="Edit" onClick={() => setEditBase(b)}><Pencil className="size-4" /></button>
                <button className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive" aria-label="Delete" onClick={() => delBase.mutate(b.id)}><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border"><h3 className="font-bold">{unit}s</h3><Button size="sm" onClick={() => setEditUnit("new")}><Plus className="size-4" /> Add</Button></div>
        {units.isLoading ? <Spinner className="py-6" /> : (units.data?.length ?? 0) === 0 ? <Empty title={`No ${unit.toLowerCase()}s yet`} hint="Departments or business lines, when your approvals depend on them." /> : (
          <ul className="divide-y divide-border">
            {units.data!.map(u => (
              <li key={u.id} className="flex items-center gap-3 px-4 py-2.5">
                <p className="min-w-0 flex-1 font-medium">{u.name}{!u.isActive && <span className="ms-2 text-[10px] uppercase text-muted-foreground">off</span>}</p>
                <button className="p-1.5 rounded hover:bg-muted text-muted-foreground" aria-label="Edit" onClick={() => setEditUnit(u)}><Pencil className="size-4" /></button>
                <button className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive" aria-label="Delete" onClick={() => delUnit.mutate(u.id)}><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editBase && <BaseModal b={editBase === "new" ? null : editBase} onClose={() => setEditBase(null)} />}
      {access && <AccessModal b={access} onClose={() => setAccess(null)} />}
      {editUnit && <UnitModal u={editUnit === "new" ? null : editUnit} onClose={() => setEditUnit(null)} />}
    </div>
  );
}
