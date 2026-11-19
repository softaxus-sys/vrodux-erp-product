import * as React from "react";
import { ArrowDown, ArrowUp, Copy, Eye, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAct, useForms } from "@/hooks/workflow/use-workflow";
import { FIELD_TYPES, parseFields, workflowApi, type ColumnDef, type FieldDef, type FieldType, type WfForm } from "@/lib/workflow/workflow.api";
import { Empty, Field, LABEL, Modal, SELECT, Spinner, TEXTAREA } from "../shared/ui";
import { FormRenderer, type FormData } from "../requests/form-renderer";

const keyFrom = (label: string, taken: string[]) => {
  const words = label.replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/).filter(Boolean).slice(0, 4);
  let k = words.map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase())).join("") || "field";
  if (!/^[a-z]/i.test(k)) k = `f${k}`;
  const base = k; let n = 2;
  while (taken.includes(k)) k = `${base}${n++}`;
  return k;
};
const optsToText = (o?: string[] | null) => (o ?? []).join("\n");
const textToOpts = (t: string) => t.split(/\r?\n|,/).map(s => s.trim()).filter(Boolean);

function ColumnEditor({ cols, onChange }: { cols: ColumnDef[]; onChange: (c: ColumnDef[]) => void }) {
  const upd = (i: number, p: Partial<ColumnDef>) => onChange(cols.map((c, idx) => (idx === i ? { ...c, ...p } : c)));
  const numeric = cols.filter(c => c.type === "number" || c.type === "money");
  return (
    <div className="space-y-2 rounded-lg bg-muted/40 p-3">
      <p className={LABEL}>Table columns</p>
      {cols.map((c, i) => (
        <div key={i} className="rounded-md border border-border bg-card p-2 space-y-2">
          <div className="flex flex-wrap gap-2">
            <Input className="h-8 flex-1 min-w-[120px]" value={c.label} placeholder="Column name" onChange={e => upd(i, { label: e.target.value, key: /^col\d*$/.test(c.key) || !c.key ? keyFrom(e.target.value, cols.filter((_, x) => x !== i).map(z => z.key)) : c.key })} />
            <select className={cn(SELECT, "h-8 w-[130px]")} value={c.type} onChange={e => upd(i, { type: e.target.value, product: null })}>
              {["text", "number", "money", "date", "select"].map(t => <option key={t}>{t}</option>)}</select>
            <label className="inline-flex items-center gap-1 text-xs"><input type="checkbox" checked={!!c.required} onChange={e => upd(i, { required: e.target.checked })} /> Required</label>
            <button className="p-1 text-muted-foreground hover:text-destructive" aria-label="Remove column" onClick={() => onChange(cols.filter((_, x) => x !== i))}><Trash2 className="size-4" /></button>
          </div>
          {c.type === "select" && <textarea className={cn(TEXTAREA, "min-h-[56px]")} placeholder="One choice per line" value={optsToText(c.options)} onChange={e => upd(i, { options: textToOpts(e.target.value) })} />}
          {c.type === "money" && (
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <label className="inline-flex items-center gap-1"><input type="checkbox" checked={!!c.isAmount} onChange={e => upd(i, { isAmount: e.target.checked })} /> Counts toward the request amount</label>
              <label className="inline-flex items-center gap-1">Calculated as
                <select className="h-7 rounded border border-input bg-card px-1" value={c.product?.join("*") ?? ""} onChange={e => upd(i, { product: e.target.value ? e.target.value.split("*") : null })}>
                  <option value="">typed in</option>
                  {numeric.filter(a => a.key !== c.key).flatMap(a => numeric.filter(b => b.key !== c.key && b.key > a.key).map(b => <option key={a.key + b.key} value={`${a.key}*${b.key}`}>{a.label} × {b.label}</option>))}
                </select></label>
            </div>
          )}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...cols, { key: keyFrom("col", cols.map(c => c.key)), label: "", type: "text" }])}><Plus className="size-4" /> Add column</Button>
    </div>
  );
}

function FieldCard({ f, idx, total, all, onChange, onMove, onRemove }: {
  f: FieldDef; idx: number; total: number; all: FieldDef[]; onChange: (f: FieldDef) => void; onMove: (d: -1 | 1) => void; onRemove: () => void;
}) {
  const [open, setOpen] = React.useState(!f.label);
  const dependsOn = all.filter(x => x.key !== f.key && x.type === "select");
  const other = f.showIf ? all.find(x => x.key === f.showIf!.field) : null;
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 px-3 py-2">
        <button className="min-w-0 flex-1 text-start" onClick={() => setOpen(!open)}>
          <p className="font-medium text-sm truncate">{f.label || <span className="text-muted-foreground">New field</span>}{f.required && <span className="text-destructive"> *</span>}</p>
          <p className="text-[11px] text-muted-foreground">{FIELD_TYPES.find(t => t.value === f.type)?.label}{f.showIf ? " · conditional" : ""}{f.isAmount ? " · amount" : ""}</p></button>
        <button className="p-1 rounded hover:bg-muted disabled:opacity-30" disabled={idx === 0} onClick={() => onMove(-1)} aria-label="Move up"><ArrowUp className="size-4" /></button>
        <button className="p-1 rounded hover:bg-muted disabled:opacity-30" disabled={idx === total - 1} onClick={() => onMove(1)} aria-label="Move down"><ArrowDown className="size-4" /></button>
        <button className="p-1 rounded hover:bg-muted" onClick={() => setOpen(!open)} aria-label="Edit"><Pencil className="size-4" /></button>
        <button className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive" onClick={onRemove} aria-label="Remove"><Trash2 className="size-4" /></button>
      </div>
      {open && (
        <div className="border-t border-border p-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Label"><Input value={f.label} onChange={e => onChange({ ...f, label: e.target.value })} /></Field>
            <Field label="Type"><select className={SELECT} value={f.type} onChange={e => {
              const t = e.target.value as FieldType;
              onChange({ ...f, type: t, options: t === "select" ? (f.options?.length ? f.options : ["Option 1"]) : null, columns: t === "lines" ? (f.columns?.length ? f.columns : [{ key: "description", label: "Description", type: "text" }]) : null,
                isAmount: t === "money" || t === "number" ? f.isAmount : false });
            }}>{FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></Field>
          </div>
          {f.type === "select" && <Field label="Choices" hint="One per line."><textarea className={cn(TEXTAREA, "min-h-[72px]")} value={optsToText(f.options)} onChange={e => onChange({ ...f, options: textToOpts(e.target.value) })} /></Field>}
          {f.type === "lines" && <ColumnEditor cols={f.columns ?? []} onChange={c => onChange({ ...f, columns: c })} />}
          <Field label="Help text" hint="Shown under the field."><Input value={f.help ?? ""} onChange={e => onChange({ ...f, help: e.target.value || null })} /></Field>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {f.type !== "checkbox" && <label className="inline-flex items-center gap-2"><input type="checkbox" checked={!!f.required} onChange={e => onChange({ ...f, required: e.target.checked })} /> Required</label>}
            {(f.type === "money" || f.type === "number") && <label className="inline-flex items-center gap-2"><input type="checkbox" checked={!!f.isAmount} onChange={e => onChange({ ...f, isAmount: e.target.checked })} /> This is the request amount</label>}
            {f.type === "text" && <label className="inline-flex items-center gap-2"><input type="checkbox" checked={!!f.isTitle} onChange={e => onChange({ ...f, isTitle: e.target.checked })} /> Use as the request title</label>}
          </div>
          <div className="rounded-md bg-muted/40 p-2.5 space-y-2">
            <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={!!f.showIf} disabled={dependsOn.length === 0}
              onChange={e => onChange({ ...f, showIf: e.target.checked ? { field: dependsOn[0].key, in: [dependsOn[0].options?.[0] ?? ""] } : null })} /> Only show this field when another answer is…</label>
            {dependsOn.length === 0 && <p className="text-[11px] text-muted-foreground">Add a choice-list field first to make this conditional.</p>}
            {f.showIf && (
              <div className="flex flex-wrap items-center gap-2">
                <select className={cn(SELECT, "w-auto h-8")} value={f.showIf.field} onChange={e => onChange({ ...f, showIf: { field: e.target.value, in: [all.find(x => x.key === e.target.value)?.options?.[0] ?? ""] } })}>
                  {dependsOn.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}</select>
                <span className="text-sm">is</span>
                <select className={cn(SELECT, "w-auto h-8")} value={f.showIf.in[0] ?? ""} onChange={e => onChange({ ...f, showIf: { ...f.showIf!, in: [e.target.value] } })}>
                  {(other?.options ?? []).map(o => <option key={o}>{o}</option>)}</select>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BuilderModal({ form, onClose }: { form: WfForm | null; onClose: () => void }) {
  const [meta, setMeta] = React.useState({ name: form?.name ?? "", description: form?.description ?? "", category: form?.category ?? "", isActive: form?.isActive ?? true });
  const [fields, setFields] = React.useState<FieldDef[]>(() => (form ? parseFields(form.fieldsJson) : [{ key: "details", label: "Details", type: "textarea", required: true }]));
  const [preview, setPreview] = React.useState(false);
  const [demo, setDemo] = React.useState<FormData>({});
  const save = useAct(() => workflowApi.saveForm({ id: form?.id, name: meta.name, description: meta.description || null, category: meta.category || null,
    fieldsJson: JSON.stringify(fields), sortOrder: form?.sortOrder ?? 99, isActive: meta.isActive }), "Form saved.");
  const set = (i: number, f: FieldDef) => setFields(fields.map((x, idx) => (idx === i ? f : x)));
  const keys = fields.map(f => f.key);
  const add = () => setFields([...fields, { key: keyFrom("field", keys), label: "", type: "text" }]);
  // A new field's key follows its label until the form is saved once; after that a key never changes, so old requests keep their answers.
  const rename = (i: number, f: FieldDef) => {
    const prev = fields[i];
    const fresh = !form || !parseFields(form.fieldsJson).some(x => x.key === prev.key);
    set(i, fresh && f.label !== prev.label ? { ...f, key: keyFrom(f.label, keys.filter((_, x) => x !== i)) } : f);
  };
  return (
    <Modal title={form ? `Edit “${form.name}”` : "Build a form"} subtitle={form && form.requestCount > 0 ? `${form.requestCount} requests already use it. Changes apply to new requests only; old ones keep the version they were sent with.` : "Add the fields people fill in. The preview shows exactly what they'll see."}
      size="xl" side onClose={onClose}
      footer={<><Button variant="outline" onClick={() => setPreview(!preview)} className="me-auto"><Eye className="size-4" /> {preview ? "Back to editing" : "Preview"}</Button>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={!meta.name.trim() || fields.length === 0 || fields.some(f => !f.label.trim()) || save.isPending} onClick={async () => { try { await save.mutateAsync(undefined); onClose(); } catch { /* toast */ } }}>Save form</Button></>}>
      {preview ? (
        <div className="max-w-2xl mx-auto rounded-xl border border-border p-5">
          <h3 className="font-bold text-lg mb-1">{meta.name || "Untitled form"}</h3>{meta.description && <p className="text-sm text-muted-foreground mb-4">{meta.description}</p>}
          <FormRenderer fields={fields} data={demo} onChange={setDemo} attachments={[]} uploading={null} onAttach={() => undefined} onRemoveAttachment={() => undefined} onOpenAttachment={() => undefined} />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Form name" required><Input value={meta.name} onChange={e => setMeta({ ...meta, name: e.target.value })} placeholder="Petty Cash Reimbursement" /></Field>
            <Field label="Group" hint="Forms are grouped by this on the “new request” screen."><Input value={meta.category} onChange={e => setMeta({ ...meta, category: e.target.value })} placeholder="Finance" /></Field>
            <Field label="What it's for" className="sm:col-span-2"><Input value={meta.description} onChange={e => setMeta({ ...meta, description: e.target.value })} /></Field>
            <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={meta.isActive} onChange={e => setMeta({ ...meta, isActive: e.target.checked })} /> Available to raise</label>
          </div>
          <div className="space-y-2">
            <p className={LABEL}>Fields</p>
            {fields.map((f, i) => (
              <FieldCard key={i} f={f} idx={i} total={fields.length} all={fields} onChange={x => rename(i, x)}
                onMove={d => { const n = [...fields]; [n[i], n[i + d]] = [n[i + d], n[i]]; setFields(n); }} onRemove={() => setFields(fields.filter((_, x) => x !== i))} />
            ))}
            <Button variant="outline" onClick={add}><Plus className="size-4" /> Add a field</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function FormsTab() {
  const q = useForms(true);
  const [edit, setEdit] = React.useState<WfForm | "new" | null>(null);
  const dup = useAct((id: string) => workflowApi.duplicateForm(id), "Copied — it's switched off until you turn it on.");
  const del = useAct((id: string) => workflowApi.deleteForm(id), "Removed.");
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div><h3 className="font-bold">Forms</h3><p className="text-xs text-muted-foreground">What people fill in. Each form is routed by the approval matrix.</p></div>
        <Button size="sm" onClick={() => setEdit("new")}><Plus className="size-4" /> Build a form</Button></div>
      {q.isLoading ? <Spinner className="py-6" /> : (q.data?.length ?? 0) === 0 ? <Empty icon={FileText} title="No forms yet" hint="Build one, or install the starter pack from the Overview." /> : (
        <ul className="divide-y divide-border">
          {q.data!.map(f => (
            <li key={f.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1"><p className="font-medium leading-tight">{f.name}{!f.isActive && <span className="ms-2 text-[10px] uppercase text-muted-foreground">off</span>}</p>
                <p className="text-xs text-muted-foreground">{f.category ?? "General"} · {parseFields(f.fieldsJson).length} fields · v{f.version} · {f.requestCount} requests · {f.flowCount === 0 ? <span className="text-amber-600 font-medium">no approval flow</span> : `${f.flowCount} flow${f.flowCount > 1 ? "s" : ""}`}</p></div>
              <button className="p-1.5 rounded hover:bg-muted text-muted-foreground" aria-label="Edit" onClick={() => setEdit(f)}><Pencil className="size-4" /></button>
              <button className="p-1.5 rounded hover:bg-muted text-muted-foreground" aria-label="Copy" onClick={() => dup.mutate(f.id)}><Copy className="size-4" /></button>
              <button className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive" aria-label="Delete" onClick={() => del.mutate(f.id)}><Trash2 className="size-4" /></button>
            </li>))}
        </ul>
      )}
      {edit && <BuilderModal form={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </section>
  );
}
