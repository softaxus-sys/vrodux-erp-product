import * as React from "react";
import { CheckCircle2, Download, FileText, Pencil, Plus, Rocket, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAct, useDocTypes, useStarterPack, useWfContext } from "@/hooks/workflow/use-workflow";
import { workflowApi, type DocType } from "@/lib/workflow/workflow.api";
import { Empty, Field, Modal, SELECT, Spinner, TEXTAREA } from "../shared/ui";

const ZONES = ["Asia/Dubai", "Asia/Riyadh", "Asia/Muscat", "Asia/Kuwait", "Asia/Qatar", "Asia/Bahrain", "Asia/Karachi", "Asia/Kolkata", "Africa/Cairo", "Europe/London", "Europe/Paris", "America/New_York", "UTC"];

export function GeneralTab() {
  const ctx = useWfContext();
  const pack = useStarterPack();
  const s = ctx.data?.settings;
  const [f, setF] = React.useState<null | { locationLabel: string; unitLabel: string; directoryRefresh: string; timeZoneId: string; numberPrefix: string }>(null);
  React.useEffect(() => { if (s && !f) setF({ locationLabel: s.locationLabel, unitLabel: s.unitLabel, directoryRefresh: s.directoryRefresh, timeZoneId: s.timeZoneId, numberPrefix: s.numberPrefix }); }, [s, f]);
  const save = useAct(() => workflowApi.updateSettings(f!), "Settings saved.");
  const install = useAct((k: string) => workflowApi.installStarterPack(k), "Starter pack installed.");
  if (!f) return <Spinner />;
  return (
    <div className="grid gap-5 lg:grid-cols-2 items-start">
      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="font-bold">Names and clock</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="What a location is called" hint="Base, Branch, Property, Site…"><Input value={f.locationLabel} onChange={e => setF({ ...f, locationLabel: e.target.value })} /></Field>
          <Field label="What a unit is called" hint="Business unit, Department…"><Input value={f.unitLabel} onChange={e => setF({ ...f, unitLabel: e.target.value })} /></Field>
          <Field label="Request number prefix" hint="REQ-20261118-A1B2C3"><Input maxLength={8} value={f.numberPrefix} onChange={e => setF({ ...f, numberPrefix: e.target.value.toUpperCase() })} /></Field>
          <Field label="Directory refresh"><select className={SELECT} value={f.directoryRefresh} onChange={e => setF({ ...f, directoryRefresh: e.target.value })}><option value="monthly">Every month</option><option value="biweekly">Every two weeks</option></select></Field>
          <Field label="Time zone on PDFs" className="sm:col-span-2" hint="Times on every approval and rejection PDF are shown on this clock."><select className={SELECT} value={f.timeZoneId} onChange={e => setF({ ...f, timeZoneId: e.target.value })}>{[...new Set([...ZONES, f.timeZoneId])].map(z => <option key={z}>{z}</option>)}</select></Field>
        </div>
        <div className="flex justify-end"><Button disabled={save.isPending} onClick={() => save.mutate(undefined)}>Save</Button></div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-bold flex items-center gap-2"><Rocket className="size-4 text-primary" /> Starter packs</h3>
        <p className="text-sm text-muted-foreground">A ready-made set of locations, forms, approval chains and document types. Installing never overwrites anything of yours — it only adds what's missing.</p>
        {pack.isLoading ? <Spinner className="py-4" /> : pack.data?.available.map(p => (
          <div key={p.key} className="rounded-lg border border-border p-3">
            <p className="font-semibold flex items-center gap-2">{p.name}{pack.data!.installed === p.key && <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium"><CheckCircle2 className="size-3.5" /> Installed</span>}</p>
            <p className="text-sm text-muted-foreground mt-1">{p.description}</p>
            <Button className="mt-3" variant={pack.data!.installed === p.key ? "outline" : "default"} size="sm" disabled={install.isPending} onClick={() => install.mutate(p.key)}>{pack.data!.installed === p.key ? "Add anything that's missing" : "Install"}</Button>
          </div>))}
      </section>
    </div>
  );
}

function DocTypeModal({ t, onClose }: { t: DocType | null; onClose: () => void }) {
  const [f, setF] = React.useState({ name: t?.name ?? "", frequency: t?.frequency ?? "daily", description: t?.description ?? "", isActive: t?.isActive ?? true });
  const save = useAct(() => workflowApi.saveDocType({ id: t?.id, ...f, description: f.description || null, sortOrder: t?.sortOrder ?? 99 }), "Saved.");
  return (
    <Modal title={t ? "Edit document type" : "Add a document type"} size="sm" onClose={onClose}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!f.name.trim() || save.isPending} onClick={async () => { try { await save.mutateAsync(undefined); onClose(); } catch { /* toast */ } }}>Save</Button></>}>
      <div className="space-y-4">
        <Field label="Name" required><Input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Daily Revenue Reconciliation" /></Field>
        <Field label="How often"><select className={SELECT} value={f.frequency} onChange={e => setF({ ...f, frequency: e.target.value as "daily" | "monthly" })}><option value="daily">Every day</option><option value="monthly">Every month</option></select></Field>
        <Field label="What it confirms"><textarea className={TEXTAREA} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></Field>
        <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={f.isActive} onChange={e => setF({ ...f, isActive: e.target.checked })} /> Expected from every location</label>
      </div>
    </Modal>
  );
}

export function RepositoryTab() {
  const q = useDocTypes();
  const [edit, setEdit] = React.useState<DocType | "new" | null>(null);
  const del = useAct((id: string) => workflowApi.deleteDocType(id), "Removed.");
  const tpl = useAct((a: { id: string; file: File }) => workflowApi.setTemplate(a.id, a.file), "Template saved.");
  const rm = useAct((id: string) => workflowApi.removeTemplate(id), "Template removed.");
  const ref = React.useRef<HTMLInputElement>(null);
  const [target, setTarget] = React.useState<string | null>(null);
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div><h3 className="font-bold">Repository document types</h3><p className="text-xs text-muted-foreground">What each location files, daily or monthly. Attach a standard template so every location uses the same layout.</p></div>
        <Button size="sm" onClick={() => setEdit("new")}><Plus className="size-4" /> Add type</Button></div>
      <input ref={ref} type="file" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file && target) tpl.mutate({ id: target, file }); e.target.value = ""; }} />
      {q.isLoading ? <Spinner className="py-6" /> : (q.data?.length ?? 0) === 0 ? <Empty icon={FileText} title="No document types yet" hint="Add the reconciliation documents each location must file." /> : (
        <ul className="divide-y divide-border">
          {q.data!.map(t => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1"><p className="font-medium leading-tight">{t.name}{!t.isActive && <span className="ms-2 text-[10px] uppercase text-muted-foreground">off</span>}</p>
                <p className="text-xs text-muted-foreground">{t.frequency === "daily" ? "Daily" : "Monthly"}{t.templateName ? ` · template: ${t.templateName}` : " · no template"}</p></div>
              {t.templateName && <Button variant="ghost" size="sm" onClick={() => workflowApi.openTemplate(t.id).catch((e: Error) => toast.error(e.message))}><Download className="size-4" /></Button>}
              <Button variant="outline" size="sm" onClick={() => { setTarget(t.id); ref.current?.click(); }}><UploadCloud className="size-4" /> {t.templateName ? "Replace" : "Add"} template</Button>
              {t.templateName && <button className="p-1.5 rounded hover:bg-muted text-muted-foreground" aria-label="Remove template" onClick={() => rm.mutate(t.id)}><Trash2 className="size-4" /></button>}
              <button className="p-1.5 rounded hover:bg-muted text-muted-foreground" aria-label="Edit" onClick={() => setEdit(t)}><Pencil className="size-4" /></button>
              <button className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive" aria-label="Delete" onClick={() => del.mutate(t.id)}><Trash2 className="size-4" /></button>
            </li>))}
        </ul>
      )}
      {edit && <DocTypeModal t={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </section>
  );
}
