import * as React from "react";
import { Loader2, Paperclip, Plus, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { fmtBytes, fmtDate, fmtMoney, type Attachment, type ColumnDef, type FieldDef } from "@/lib/workflow/workflow.api";
import { Field, SELECT, TEXTAREA } from "../shared/ui";

export type FormData = Record<string, unknown>;

const num = (v: unknown) => { const n = parseFloat(String(v ?? "").replace(/,/g, "")); return Number.isFinite(n) ? n : 0; };

/** Is this field currently shown? A field can depend on the value of another. */
export function isVisible(f: FieldDef, data: FormData) {
  if (!f.showIf) return true;
  const other = String(data[f.showIf.field] ?? "");
  return f.showIf.in.some(v => v.toLowerCase() === other.toLowerCase());
}

type Row = Record<string, unknown>;

/** A computed column (product of two others) is worked out here for display; the server recomputes it on save. */
const cellValue = (c: ColumnDef, row: Row) =>
  c.product && c.product.length === 2 ? Math.round(num(row[c.product[0]]) * num(row[c.product[1]]) * 100) / 100 : row[c.key];

function LinesEditor({ field, rows, onChange }: { field: FieldDef; rows: Row[]; onChange: (r: Row[]) => void }) {
  const cols = field.columns ?? [];
  const set = (i: number, key: string, v: unknown) => onChange(rows.map((r, idx) => (idx === i ? { ...r, [key]: v } : r)));
  const total = cols.filter(c => c.isAmount).reduce((s, c) => s + rows.reduce((a, r) => a + num(cellValue(c, r)), 0), 0);
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="bg-muted/50">
            <tr>
              {cols.map(c => <th key={c.key} className="text-start px-2 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">{c.label}{c.required && <span className="text-destructive"> *</span>}</th>)}
              <th className="w-9" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={cols.length + 1} className="px-3 py-5 text-center text-muted-foreground text-sm">No rows yet.</td></tr>}
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border">
                {cols.map(c => (
                  <td key={c.key} className="px-1.5 py-1.5 align-top">
                    {c.product ? (
                      <span className="block px-2 py-1.5 text-end tabular-nums font-medium">{fmtMoney(cellValue(c, r) as number)}</span>
                    ) : c.type === "select" ? (
                      <select className={cn(SELECT, "h-8 min-w-[110px]")} value={String(r[c.key] ?? "")} onChange={e => set(i, c.key, e.target.value)}>
                        <option value="">—</option>{(c.options ?? []).map(o => <option key={o}>{o}</option>)}
                      </select>
                    ) : (
                      <Input className="h-8 min-w-[90px]" type={c.type === "date" ? "date" : c.type === "number" || c.type === "money" ? "number" : "text"}
                        inputMode={c.type === "number" || c.type === "money" ? "decimal" : undefined} min={c.type === "number" || c.type === "money" ? 0 : undefined}
                        value={String(r[c.key] ?? "")} onChange={e => set(i, c.key, e.target.value)} />
                    )}
                  </td>
                ))}
                <td className="px-1 align-top pt-2">
                  <button type="button" className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted" aria-label="Remove row" onClick={() => onChange(rows.filter((_, idx) => idx !== i))}>
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...rows, {}])}><Plus className="size-4" /> Add row</Button>
        {total > 0 && <span className="text-sm font-semibold tabular-nums">Total {fmtMoney(total)}</span>}
      </div>
    </div>
  );
}

function FileField({ field, files, busy, onAdd, onRemove, onOpen }: {
  field: FieldDef; files: Attachment[]; busy: boolean; onAdd: (f: File) => void; onRemove: (a: Attachment) => void; onOpen: (a: Attachment) => void;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      {files.map(a => (
        <div key={a.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
          <Paperclip className="size-4 text-muted-foreground shrink-0" />
          <button type="button" className="font-medium truncate text-start hover:underline" onClick={() => onOpen(a)}>{a.fileName}</button>
          <span className="text-xs text-muted-foreground shrink-0">{fmtBytes(a.size)}</span>
          <button type="button" className="ms-auto p-1 rounded text-muted-foreground hover:text-destructive" aria-label="Remove file" onClick={() => onRemove(a)}><Trash2 className="size-4" /></button>
        </div>
      ))}
      <input ref={ref} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onAdd(f); e.target.value = ""; }} />
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => ref.current?.click()}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />} {files.length ? "Add another file" : `Attach ${field.label.toLowerCase()}`}
      </Button>
      <p className="text-[11px] text-muted-foreground">Up to 10 MB per file.</p>
    </div>
  );
}

/** Renders a form definition as inputs. Controlled: the parent owns `data`. */
export function FormRenderer({ fields, data, onChange, attachments, uploading, onAttach, onRemoveAttachment, onOpenAttachment, errors }: {
  fields: FieldDef[]; data: FormData; onChange: (d: FormData) => void; attachments: Attachment[]; uploading: string | null;
  onAttach: (fieldKey: string, file: File) => void; onRemoveAttachment: (a: Attachment) => void; onOpenAttachment: (a: Attachment) => void;
  errors?: string[];
}) {
  const set = (k: string, v: unknown) => onChange({ ...data, [k]: v });
  return (
    <div className="space-y-5">
      {errors && errors.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{errors.map((e, i) => <p key={i}>{e}</p>)}</div>
      )}
      {fields.filter(f => isVisible(f, data)).map(f => (
        <Field key={f.key} label={f.label} required={f.required} hint={f.help ?? undefined}>
          {f.type === "textarea" ? (
            <textarea className={TEXTAREA} value={String(data[f.key] ?? "")} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder ?? undefined} />
          ) : f.type === "select" ? (
            <select className={SELECT} value={String(data[f.key] ?? "")} onChange={e => set(f.key, e.target.value)}>
              <option value="">Choose…</option>{(f.options ?? []).map(o => <option key={o}>{o}</option>)}
            </select>
          ) : f.type === "checkbox" ? (
            <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 rounded border-input" checked={data[f.key] === true} onChange={e => set(f.key, e.target.checked)} /> Yes</label>
          ) : f.type === "lines" ? (
            <LinesEditor field={f} rows={(data[f.key] as Row[] | undefined) ?? []} onChange={r => set(f.key, r)} />
          ) : f.type === "attachment" ? (
            <FileField field={f} files={attachments.filter(a => a.fieldKey === f.key)} busy={uploading === f.key}
              onAdd={file => onAttach(f.key, file)} onRemove={onRemoveAttachment} onOpen={onOpenAttachment} />
          ) : (
            <Input type={f.type === "date" ? "date" : f.type === "number" || f.type === "money" ? "number" : "text"}
              inputMode={f.type === "number" || f.type === "money" ? "decimal" : undefined} min={f.type === "number" || f.type === "money" ? 0 : undefined}
              step={f.type === "money" ? "0.01" : undefined} placeholder={f.placeholder ?? undefined}
              value={String(data[f.key] ?? "")} onChange={e => set(f.key, e.target.value)} />
          )}
        </Field>
      ))}
    </div>
  );
}

/** Shows what was submitted, read-only. */
export function DataView({ fields, data, attachments, onOpenAttachment }: {
  fields: FieldDef[]; data: FormData; attachments: Attachment[]; onOpenAttachment: (a: Attachment) => void;
}) {
  const shown = fields.filter(f => isVisible(f, data));
  const display = (t: string, v: unknown) =>
    t === "money" ? fmtMoney(num(v)) : t === "date" ? fmtDate(String(v)) : t === "checkbox" ? (v === true ? "Yes" : "No") : String(v ?? "");
  return (
    <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
      {shown.map(f => {
        if (f.type === "attachment") {
          const files = attachments.filter(a => a.fieldKey === f.key);
          if (files.length === 0) return null;
          return (
            <div key={f.key} className="sm:col-span-2">
              <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{f.label}</dt>
              <dd className="mt-1 flex flex-wrap gap-2">
                {files.map(a => (
                  <button key={a.id} type="button" onClick={() => onOpenAttachment(a)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">
                    <Paperclip className="size-3.5" />{a.fileName}<span className="text-xs text-muted-foreground">{fmtBytes(a.size)}</span>
                  </button>
                ))}
              </dd>
            </div>
          );
        }
        if (f.type === "lines") {
          const rows = (data[f.key] as Row[] | undefined) ?? [];
          if (rows.length === 0) return null;
          const cols = f.columns ?? [];
          const total = cols.filter(c => c.isAmount).reduce((s, c) => s + rows.reduce((a, r) => a + num(cellValue(c, r)), 0), 0);
          return (
            <div key={f.key} className="sm:col-span-2">
              <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{f.label}</dt>
              <dd className="mt-1.5 overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm min-w-[480px]">
                  <thead className="bg-muted/50"><tr>{cols.map(c => <th key={c.key} className="text-start px-3 py-2 text-xs font-semibold text-muted-foreground">{c.label}</th>)}</tr></thead>
                  <tbody>{rows.map((r, i) => (
                    <tr key={i} className="border-t border-border">{cols.map(c => (
                      <td key={c.key} className={cn("px-3 py-2", (c.type === "money" || c.type === "number") && "text-end tabular-nums")}>
                        {r[c.key] === undefined || r[c.key] === "" ? "—" : display(c.type, cellValue(c, r))}
                      </td>))}</tr>))}</tbody>
                </table>
                {total > 0 && <div className="px-3 py-2 border-t border-border text-end text-sm font-semibold tabular-nums">Total {fmtMoney(total)}</div>}
              </dd>
            </div>
          );
        }
        const v = data[f.key];
        if (v === undefined || v === null || v === "") return null;
        return (
          <div key={f.key} className={cn(f.type === "textarea" && "sm:col-span-2")}>
            <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{f.label}</dt>
            <dd className="mt-1 text-sm whitespace-pre-wrap">{display(f.type, v)}</dd>
          </div>
        );
      })}
    </dl>
  );
}
