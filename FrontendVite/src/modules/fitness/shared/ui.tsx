import * as React from "react";
import { motion } from "framer-motion";
import { Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { statusMeta } from "@/lib/fitness/fitness.api";

export const LABEL = "text-xs font-semibold text-muted-foreground uppercase tracking-wide";
export const SELECT = "h-9 w-full rounded-md border border-input bg-card px-3 text-sm";
export const TH = "text-start font-semibold px-4 py-3";
export const TEXTAREA = "w-full rounded-md border border-input bg-card px-3 py-2 text-sm min-h-[72px]";
export const num = (s: unknown) => { const n = parseFloat(String(s ?? "")); return Number.isFinite(n) ? n : 0; };
export const orUndef = (s: unknown) => { const v = String(s ?? "").trim(); return v === "" ? undefined : v; };

/** True when the user holds any of the keys. */
export function useCanAny(keys: string[]) {
  const has = useAuthStore(st => st.hasRawPermission);
  return keys.some(k => has(k));
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => { const id = setTimeout(() => setV(value), ms); return () => clearTimeout(id); }, [value, ms]);
  return v;
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className={LABEL}>{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Pill({ state, label }: { state: string; label?: string }) {
  const m = statusMeta(state);
  return <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap", m.color, m.bg)}>{label ?? m.label}</span>;
}

/** Render inside the parent's <AnimatePresence>. `side` slides in from the edge as a drawer. */
export function Modal({ title, subtitle, onClose, children, footer, size = "md", side = false }: {
  title: React.ReactNode; subtitle?: React.ReactNode; onClose: () => void; children: React.ReactNode;
  footer?: React.ReactNode; size?: "sm" | "md" | "lg" | "xl"; side?: boolean;
}) {
  const width = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" }[size];
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      {/* A flex wrapper centres it: the open animation writes its own transform, which would cancel a CSS translate. */}
      <div className={cn("fixed inset-0 z-50 flex pointer-events-none", side ? "justify-end" : "items-start justify-center px-4 pt-[6vh]")}>
        <motion.div
          initial={side ? { x: "100%" } : { opacity: 0, scale: 0.97 }} animate={side ? { x: 0 } : { opacity: 1, scale: 1 }}
          exit={side ? { x: "100%" } : { opacity: 0, scale: 0.97 }} transition={{ type: "spring", damping: 30, stiffness: 320 }}
          className={cn("pointer-events-auto flex flex-col bg-card border-border shadow-2xl w-full", side ? "h-full border-s" : "max-h-[88vh] rounded-xl border", width)}>
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
            <div className="min-w-0">
              <h2 className="text-base font-bold truncate">{title}</h2>
              {subtitle && <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground shrink-0" aria-label="Close"><X className="h-4 w-4" /></button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">{children}</div>
          {footer && <div className="flex justify-end gap-2 px-5 py-3 border-t border-border shrink-0">{footer}</div>}
        </motion.div>
      </div>
    </>
  );
}

export function ConfirmDialog({ title, body, confirmLabel, destructive = true, pending, onConfirm, onClose }: {
  title: string; body: React.ReactNode; confirmLabel: string; destructive?: boolean; pending?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />
      <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[30vh] pointer-events-none">
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
          className="pointer-events-auto w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-2xl">
          <p className="font-semibold text-sm">{title}</p>
          <div className="text-sm text-muted-foreground mt-1">{body}</div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>Cancel</Button>
            <Button size="sm" className={cn("gap-1.5", destructive && "bg-destructive hover:bg-destructive/90")} disabled={pending} onClick={onConfirm}>
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{confirmLabel}
            </Button>
          </div>
        </motion.div>
      </div>
    </>
  );
}

export function PageHeader({ title, description, children }: { title: string; description: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div><h1 className="text-2xl font-bold">{title}</h1><p className="text-sm text-muted-foreground mt-0.5">{description}</p></div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder, className, autoFocus, onEnter }: {
  value: string; onChange: (v: string) => void; placeholder: string; className?: string; autoFocus?: boolean; onEnter?: () => void;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus}
        onKeyDown={onEnter ? e => { if (e.key === "Enter") { e.preventDefault(); onEnter(); } } : undefined} className="h-9 ps-9 text-sm" />
    </div>
  );
}

export function TableState({ loading, error, empty, emptyText, icon: Icon }: {
  loading: boolean; error?: Error | null; empty: boolean; emptyText: string; icon: React.ElementType;
}) {
  if (loading) return <div className="p-12 text-center text-sm text-muted-foreground">Loading…</div>;
  if (error) return <div className="p-12 text-center text-sm text-destructive">{error.message}</div>;
  if (empty) return (
    <div className="p-12 text-center"><Icon className="h-8 w-8 mx-auto text-muted-foreground/50" /><p className="text-sm text-muted-foreground mt-3">{emptyText}</p></div>
  );
  return null;
}

export function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: "warn" | "bad" | "good" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className={LABEL}>{label}</p>
      <p className={cn("text-2xl font-bold mt-1 tabular-nums", tone === "warn" && "text-amber-600", tone === "bad" && "text-red-600", tone === "good" && "text-emerald-600")}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string }[] }) {
  return (
    <div className="flex gap-1 border-b border-border overflow-x-auto">
      {items.map(i => (
        <button key={i.value} onClick={() => onChange(i.value)}
          className={cn("px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap", value === i.value ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
          {i.label}
        </button>
      ))}
    </div>
  );
}

// ── A small form builder ────────────────────────────────────────────────────
// Most Fitness screens are "a handful of fields, save". One spec-driven form keeps them consistent.

export interface FormField {
  key: string; label: string; type?: "text" | "number" | "date" | "time" | "email" | "select" | "textarea" | "checkbox";
  options?: { value: string; label: string }[]; required?: boolean; hint?: string; span?: 1 | 2; placeholder?: string;
}
export type FormValues = Record<string, string | boolean>;

export function FormModal({ title, subtitle, fields, initial, submitLabel = "Save", pending, onSubmit, onClose, size = "md", error }: {
  title: string; subtitle?: string; fields: FormField[]; initial: FormValues; submitLabel?: string; pending?: boolean;
  onSubmit: (v: FormValues) => void; onClose: () => void; size?: "sm" | "md" | "lg"; error?: string | null;
}) {
  const [v, setV] = React.useState<FormValues>(initial);
  const missing = fields.find(f => f.required && f.type !== "checkbox" && !String(v[f.key] ?? "").trim());
  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose} size={size}
      footer={<>
        <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>Cancel</Button>
        <Button size="sm" className="gap-1.5" disabled={pending || !!missing} onClick={() => onSubmit(v)}>
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{submitLabel}
        </Button>
      </>}>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map(f => {
          const set = (x: string | boolean) => setV(p => ({ ...p, [f.key]: x }));
          const span = f.span === 2 || f.type === "textarea" ? "sm:col-span-2" : "";
          if (f.type === "checkbox")
            return (
              <label key={f.key} className={cn("flex items-center gap-2 text-sm", span)}>
                <input type="checkbox" checked={!!v[f.key]} onChange={e => set(e.target.checked)} className="h-4 w-4" />
                <span>{f.label}</span>{f.hint && <span className="text-[11px] text-muted-foreground">— {f.hint}</span>}
              </label>
            );
          return (
            <Field key={f.key} label={f.label + (f.required ? " *" : "")} hint={f.hint} className={span}>
              {f.type === "select" ? (
                <select className={SELECT} value={String(v[f.key] ?? "")} onChange={e => set(e.target.value)}>
                  {!f.required && <option value="">—</option>}
                  {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.type === "textarea" ? (
                <textarea className={TEXTAREA} value={String(v[f.key] ?? "")} onChange={e => set(e.target.value)} placeholder={f.placeholder} />
              ) : (
                <Input type={f.type ?? "text"} value={String(v[f.key] ?? "")} onChange={e => set(e.target.value)} placeholder={f.placeholder}
                  className="h-9 text-sm" {...(f.type === "number" ? { step: "any", min: 0 } : {})} />
              )}
            </Field>
          );
        })}
      </div>
    </Modal>
  );
}
