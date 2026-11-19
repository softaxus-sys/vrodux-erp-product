import * as React from "react";
import { createPortal } from "react-dom";
import { Loader2, MapPin, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useUsers } from "@/hooks/identity/use-users";
import { statusMeta } from "@/lib/workflow/workflow.api";
import { useActiveBase, useDebounced } from "@/hooks/workflow/use-workflow";

export const LABEL = "text-xs font-semibold text-muted-foreground uppercase tracking-wide";
export const SELECT = "h-9 w-full rounded-md border border-input bg-card px-3 text-sm";
export const TEXTAREA = "w-full rounded-md border border-input bg-card px-3 py-2 text-sm min-h-[84px]";
export const TH = "text-start font-semibold px-4 py-3";

export function Field({ label, hint, children, className, required }: { label: string; hint?: string; children: React.ReactNode; className?: string; required?: boolean }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className={LABEL}>{label}{required && <span className="text-destructive"> *</span>}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function StatusPill({ status, className }: { status: string; className?: string }) {
  const m = statusMeta(status);
  return <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap", m.tone, className)}>{m.label}</span>;
}

export function Spinner({ className }: { className?: string }) {
  return <div className={cn("flex justify-center py-12 text-muted-foreground", className)}><Loader2 className="size-5 animate-spin" /></div>;
}

export function Empty({ icon: Icon, title, hint, action }: { icon?: React.ComponentType<{ className?: string }>; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-14 px-6 text-muted-foreground">
      {Icon && <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3"><Icon className="size-6" /></div>}
      <p className="font-semibold text-foreground">{title}</p>
      {hint && <p className="text-sm mt-1 max-w-md">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
      <p className="font-semibold text-destructive">That didn't load</p>
      <p className="text-sm text-muted-foreground mt-1">{error instanceof Error ? error.message : "Something went wrong."}</p>
      {onRetry && <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A centred dialog (or a right-hand drawer with `side`). Portalled, so a transformed parent can't clip it. */
export function Modal({ title, subtitle, onClose, children, footer, size = "md", side = false }: {
  title: React.ReactNode; subtitle?: React.ReactNode; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl"; side?: boolean;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const width = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" }[size];
  return createPortal(
    <div className="fixed inset-0 z-[70] flex" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={cn("relative flex w-full pointer-events-none", side ? "justify-end" : "items-start justify-center px-3 pt-[5vh]")}>
        <div className={cn("pointer-events-auto flex flex-col bg-card border-border shadow-2xl w-full",
          side ? "h-full border-s" : "max-h-[90dvh] rounded-xl border", width)}>
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
            <div className="min-w-0">
              <h2 className="font-bold text-lg leading-tight">{title}</h2>
              {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground" aria-label="Close"><X className="size-4" /></button>
          </div>
          <div className="overflow-y-auto px-5 py-4 flex-1 min-h-0">{children}</div>
          {footer && <div className="px-5 py-3 border-t border-border flex flex-wrap items-center justify-end gap-2 shrink-0">{footer}</div>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Pick a person from the workspace's logins. Calls `onPick` and clears itself. */
export function UserPicker({ onPick, placeholder = "Search people by name or email…", exclude }: {
  onPick: (u: { id: string; name: string; email: string }) => void; placeholder?: string; exclude?: string[];
}) {
  const [text, setText] = React.useState("");
  const q = useDebounced(text, 250);
  const { data, isFetching } = useUsers({ search: q, pageSize: 8 }, q.trim().length >= 2);
  const list = (data?.items ?? []).filter(u => !exclude?.includes(u.id));
  return (
    <div className="relative">
      <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
      <Input value={text} onChange={e => setText(e.target.value)} placeholder={placeholder} className="ps-9" />
      {q.trim().length >= 2 && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-card shadow-lg max-h-60 overflow-auto">
          {isFetching && list.length === 0 && <p className="p-3 text-sm text-muted-foreground">Searching…</p>}
          {!isFetching && list.length === 0 && <p className="p-3 text-sm text-muted-foreground">No one found.</p>}
          {list.map(u => (
            <button key={u.id} type="button" className="w-full text-start px-3 py-2 hover:bg-muted text-sm"
              onClick={() => { onPick({ id: u.id, name: u.fullName, email: u.email }); setText(""); }}>
              <span className="font-medium">{u.fullName}</span> <span className="text-muted-foreground">· {u.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The Base the person is working in. Renders nothing when they can use only one. */
export function BaseSwitcher({ className }: { className?: string }) {
  const { base, bases, setBase, labels } = useActiveBase();
  if (bases.length === 0) return null;
  if (bases.length === 1) {
    return <span className={cn("inline-flex items-center gap-1.5 text-sm text-muted-foreground", className)}><MapPin className="size-4" />{base?.name}</span>;
  }
  return (
    <label className={cn("inline-flex items-center gap-2 text-sm", className)}>
      <MapPin className="size-4 text-muted-foreground" />
      <span className="text-muted-foreground hidden sm:inline">{labels?.locationLabel ?? "Base"}</span>
      <select value={base?.id ?? ""} onChange={e => setBase(e.target.value)} className="h-9 rounded-md border border-input bg-card px-2 text-sm font-medium">
        {bases.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
    </label>
  );
}

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join("") || "?";
