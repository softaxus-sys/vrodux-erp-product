import * as React from "react";
import { AnimatePresence } from "framer-motion";
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { assetUrl } from "@/lib/storefront/shop.api";
import { useAssets, useUploadAsset } from "@/hooks/ecommerce/use-store";
import { cn } from "@/lib/utils";
import { Field, Modal, SELECT } from "../../shared/ui";

export const TEXTAREA = "w-full rounded-md border border-input bg-card px-3 py-2 text-sm min-h-[80px]";

export function TextField({ label, value, onChange, hint, placeholder, type = "text", dir, maxLength }: {
  label: string; value: string; onChange: (v: string) => void; hint?: string; placeholder?: string; type?: string; dir?: "ltr" | "rtl"; maxLength?: number;
}) {
  return (
    <Field label={label} hint={hint}>
      <Input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} dir={dir} maxLength={maxLength} className="h-9 text-sm" />
    </Field>
  );
}

export function TextAreaField({ label, value, onChange, hint, rows = 4, placeholder }: { label: string; value: string; onChange: (v: string) => void; hint?: string; rows?: number; placeholder?: string }) {
  return (
    <Field label={label} hint={hint}>
      <textarea className={TEXTAREA} rows={rows} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
    </Field>
  );
}

export function SelectField({ label, value, onChange, options, hint }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <select className={SELECT} value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
}

export function ToggleField({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span><span className="text-sm font-medium">{label}</span>{hint && <span className="block text-xs text-muted-foreground">{hint}</span>}</span>
    </label>
  );
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"} onChange={e => onChange(e.target.value)} className="h-9 w-12 rounded border border-input bg-card p-1 cursor-pointer" aria-label={label} />
        <Input value={value} onChange={e => onChange(e.target.value)} className="h-9 text-sm font-mono w-28" maxLength={9} dir="ltr" />
      </div>
    </Field>
  );
}

export function NumberField({ label, value, onChange, min, max, step, hint, placeholder }: { label: string; value: number | null; onChange: (v: number | null) => void; min?: number; max?: number; step?: number; hint?: string; placeholder?: string }) {
  return (
    <Field label={label} hint={hint}>
      <Input type="number" value={value ?? ""} min={min} max={max} step={step} placeholder={placeholder} className="h-9 text-sm"
        onChange={e => onChange(e.target.value === "" ? null : Number(e.target.value))} />
    </Field>
  );
}

// ── Pictures ─────────────────────────────────────────────────────────────────

/** A picture chosen from what the store already uploaded, or uploaded right here. Stores an asset id. */
export function ImageField({ label, slug, value, onChange, hint }: { label: string; slug: string; value: string | null; onChange: (id: string | null) => void; hint?: string }) {
  const [open, setOpen] = React.useState(false);
  const upload = useUploadAsset();
  const input = React.useRef<HTMLInputElement>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { toast.error("Images can be up to 3 MB."); return; }
    try { const a = await upload.mutateAsync(file); onChange(a.id); toast.success("Image uploaded."); } catch { /* toast shown */ }
  };

  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-3">
        <div className="h-16 w-16 shrink-0 rounded-md border border-border bg-muted/30 overflow-hidden flex items-center justify-center">
          {value ? <img src={assetUrl(slug, value)} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-6 w-6 text-muted-foreground/50" />}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={upload.isPending} onClick={() => input.current?.click()}>
            {upload.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}Upload
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>Choose</Button>
          {value && <Button type="button" size="sm" variant="ghost" className="gap-1.5 text-destructive" onClick={() => onChange(null)}><Trash2 className="h-3.5 w-3.5" />Remove</Button>}
        </div>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={e => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      <AnimatePresence>{open && <AssetLibrary slug={slug} onClose={() => setOpen(false)} onPick={id => { onChange(id); setOpen(false); }} />}</AnimatePresence>
    </Field>
  );
}

function AssetLibrary({ slug, onClose, onPick }: { slug: string; onClose: () => void; onPick: (id: string) => void }) {
  const q = useAssets();
  return (
    <Modal title="Choose an image" subtitle="Pictures you have uploaded to this store." onClose={onClose} size="lg" layer={60}>
      {q.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p>
        : (q.data?.length ?? 0) === 0 ? <p className="text-sm text-muted-foreground">Nothing uploaded yet. Use Upload first.</p>
        : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {q.data!.map(a => (
              <button key={a.id} type="button" onClick={() => onPick(a.id)} className={cn("aspect-square rounded-md border border-border overflow-hidden hover:ring-2 ring-primary")} title={a.fileName}>
                <img src={assetUrl(slug, a.id)} alt={a.fileName} className="h-full w-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        )}
    </Modal>
  );
}

// ── Repeating items (features, testimonials, FAQ, gallery) ───────────────────

export function ItemsEditor<T extends Record<string, unknown>>({ label, items, onChange, blank, render, max = 12, addLabel = "Add" }: {
  label: string; items: T[]; onChange: (items: T[]) => void; blank: T; max?: number; addLabel?: string;
  render: (item: T, update: (patch: Partial<T>) => void, index: number) => React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      {items.map((item, i) => (
        <div key={i} className="rounded-md border border-border p-3 space-y-3 bg-muted/10">
          {render(item, patch => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x))), i)}
          <div className="flex justify-end"><Button type="button" size="sm" variant="ghost" className="gap-1.5 text-destructive h-7" onClick={() => onChange(items.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" />Remove</Button></div>
        </div>
      ))}
      {items.length < max && <Button type="button" size="sm" variant="outline" onClick={() => onChange([...items, { ...blank }])}>{addLabel}</Button>}
    </div>
  );
}
