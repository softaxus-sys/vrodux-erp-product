import {
  AtSign, Banknote, Bell, Briefcase, Building2, CalendarClock, CheckCircle2, FileText,
  Handshake, Info, Package, ShoppingCart, Stamp, TriangleAlert, UtensilsCrossed, XCircle,
  type LucideIcon,
} from "lucide-react";

/**
 * How a notification looks. Keyed by the BACKEND's module keys (NotificationModules) — the two
 * must stay in step, so anything unknown falls back rather than rendering a blank tile.
 */
export interface ModuleMeta {
  label: string;
  icon:  LucideIcon;
  /** Tailwind classes for the icon chip: text + background. */
  tone:  string;
  /** Solid colour for the unread dot and the toast's accent bar. */
  accent: string;
}

const FALLBACK: ModuleMeta = {
  label: "Notification", icon: Bell,
  tone: "text-slate-600 bg-slate-500/10 dark:text-slate-300",
  accent: "bg-slate-500",
};

const MODULES: Record<string, ModuleMeta> = {
  crm:                  { label: "CRM",       icon: Handshake,        tone: "text-violet-600 bg-violet-500/10 dark:text-violet-300",  accent: "bg-violet-500" },
  hr:                   { label: "HR",        icon: Briefcase,        tone: "text-sky-600 bg-sky-500/10 dark:text-sky-300",           accent: "bg-sky-500" },
  finance:              { label: "Finance",   icon: Banknote,         tone: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-300", accent: "bg-emerald-500" },
  purchase:             { label: "Purchase",  icon: ShoppingCart,     tone: "text-amber-600 bg-amber-500/10 dark:text-amber-300",     accent: "bg-amber-500" },
  sales:                { label: "Sales",     icon: FileText,         tone: "text-blue-600 bg-blue-500/10 dark:text-blue-300",        accent: "bg-blue-500" },
  inventory:            { label: "Inventory", icon: Package,          tone: "text-orange-600 bg-orange-500/10 dark:text-orange-300",  accent: "bg-orange-500" },
  "project-management": { label: "Projects",  icon: CalendarClock,    tone: "text-indigo-600 bg-indigo-500/10 dark:text-indigo-300",  accent: "bg-indigo-500" },
  "real-estate":        { label: "Property",  icon: Building2,        tone: "text-teal-600 bg-teal-500/10 dark:text-teal-300",        accent: "bg-teal-500" },
  visa:                 { label: "Visa",      icon: Stamp,            tone: "text-rose-600 bg-rose-500/10 dark:text-rose-300",        accent: "bg-rose-500" },
  restaurant:           { label: "Restaurant",icon: UtensilsCrossed,  tone: "text-red-600 bg-red-500/10 dark:text-red-300",           accent: "bg-red-500" },
  pos:                  { label: "POS",       icon: ShoppingCart,     tone: "text-cyan-600 bg-cyan-500/10 dark:text-cyan-300",        accent: "bg-cyan-500" },
  support:              { label: "Support",   icon: Info,             tone: "text-slate-600 bg-slate-500/10 dark:text-slate-300",     accent: "bg-slate-500" },
  system:               { label: "Account",   icon: Bell,             tone: "text-slate-600 bg-slate-500/10 dark:text-slate-300",     accent: "bg-slate-500" },
};

export const moduleMeta = (module: string): ModuleMeta => MODULES[module] ?? FALLBACK;

/** Every module that can appear, for the panel's filter chips. */
export const NOTIFICATION_MODULES = Object.keys(MODULES);

/**
 * Severity overlay. The module decides the icon; the type decides whether it reads as good news or
 * bad. A rejected payroll and an approved one come from the same module and must not look alike.
 */
const TYPE_ICON: Record<string, LucideIcon> = {
  success: CheckCircle2,
  warning: TriangleAlert,
  error:   XCircle,
  mention: AtSign,
};

export const typeIcon = (type: string, module: string): LucideIcon =>
  TYPE_ICON[type] ?? moduleMeta(module).icon;

export const typeAccent = (type: string, module: string): string =>
  type === "success" ? "bg-emerald-500"
  : type === "warning" ? "bg-amber-500"
  : type === "error"   ? "bg-red-500"
  : moduleMeta(module).accent;
