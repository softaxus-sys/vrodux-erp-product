import * as React from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BookingStatus, RoomStatus } from "@/lib/hospitality/hospitality.api";

// Shared building blocks for the hotel screens. Overlays are portalled to <body>: a drawer opened
// from inside another transformed drawer would otherwise be clipped to its parent.

export const BOOKING_STATUS: Record<BookingStatus, { label: string; chip: string; bar: string }> = {
  confirmed:   { label: "Confirmed",   chip: "bg-primary/10 text-primary",              bar: "bg-primary/85 text-primary-foreground" },
  checked_in:  { label: "In house",    chip: "bg-success/10 text-success",              bar: "bg-success text-white" },
  checked_out: { label: "Checked out", chip: "bg-muted text-muted-foreground",          bar: "bg-muted-foreground/50 text-white" },
  cancelled:   { label: "Cancelled",   chip: "bg-destructive/10 text-destructive",      bar: "bg-destructive/60 text-white" },
  no_show:     { label: "No-show",     chip: "bg-warning/10 text-warning",              bar: "bg-warning/70 text-white" },
};

export const ROOM_STATUS: Record<RoomStatus, { label: string; chip: string; dot: string }> = {
  available:   { label: "Vacant",          chip: "bg-success/10 text-success",         dot: "bg-success" },
  occupied:    { label: "Occupied",        chip: "bg-primary/10 text-primary",         dot: "bg-primary" },
  maintenance: { label: "Out of service",  chip: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
  cleaning:    { label: "Cleaning",        chip: "bg-warning/10 text-warning",         dot: "bg-warning" },
};

/** Never index a status map bare: an unknown value would take the whole page down. */
export const bookingStatus = (s: string) => BOOKING_STATUS[s as BookingStatus] ?? { label: s.replace(/_/g, " "), chip: "bg-muted text-muted-foreground", bar: "bg-muted-foreground/50 text-white" };
export const roomStatus = (s: string) => ROOM_STATUS[s as RoomStatus] ?? { label: s, chip: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" };

export function StatusChip({ status }: { status: string }) {
  const s = bookingStatus(status);
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap", s.chip)}>{s.label}</span>;
}

export function Stat({ label, value, hint, icon: Icon, tone = "text-primary bg-primary/10" }:
  { label: string; value: React.ReactNode; hint?: string; icon?: React.ElementType; tone?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 min-w-0">
      {Icon && <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", tone)}><Icon className="h-4 w-4" /></div>}
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-lg font-bold leading-tight truncate">{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground/80 truncate">{hint}</p>}
      </div>
    </div>
  );
}

export function Drawer({ title, subtitle, onClose, children, footer, width = "max-w-2xl" }:
  { title: React.ReactNode; subtitle?: React.ReactNode; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; width?: string }) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50">
      <motion.div className="absolute inset-0 bg-black/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} />
      <motion.aside
        initial={{ x: "100%" }} animate={{ x: 0 }} transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className={cn("absolute end-0 top-0 h-full w-full bg-background border-s border-border shadow-2xl flex flex-col", width)}
        role="dialog" aria-modal="true">
        <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-semibold truncate">{title}</h2>
            {subtitle && <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>}
          </div>
          <button onClick={onClose} aria-label="Close" className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted shrink-0">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="px-5 py-3 border-t border-border flex flex-wrap items-center justify-end gap-2 shrink-0 bg-card/50">{footer}</footer>}
      </motion.aside>
    </div>,
    document.body,
  );
}

export function Modal({ title, onClose, children, footer, width = "max-w-md" }:
  { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; width?: string }) {
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-3" onClick={onClose}>
      <div className={cn("w-full bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[92dvh]", width)} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <p className="text-sm font-semibold">{title}</p>
          <button onClick={onClose} aria-label="Close" className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-5 py-4 overflow-y-auto space-y-3">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-border flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Field({ label, children, hint, className }: { label: string; children: React.ReactNode; hint?: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block space-y-1", className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground/80">{hint}</span>}
    </label>
  );
}

export const inputCls = "h-9 w-full px-3 rounded-lg border border-input bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40";
export const selectCls = inputCls;
export const textareaCls = "w-full px-3 py-2 rounded-lg border border-input bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 resize-none";

export function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({ icon: Icon, title, hint, action }: { icon: React.ElementType; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-4 border border-dashed border-border rounded-xl">
      <Icon className="h-9 w-9 text-muted-foreground/40 mb-3" />
      <p className="text-sm font-semibold">{title}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1 max-w-sm">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ─── Dates ────────────────────────────────────────────────────────────────────

export function addDays(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export function nightsBetween(a: string, b: string) {
  if (!a || !b) return 0;
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** "Fri 17 Oct" — a calendar day, formatted without letting the browser shift it across a time zone. */
export function dayLabel(date: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { ...opts, timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}
