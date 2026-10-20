import * as React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { AlertTriangle, ChevronLeft, ChevronRight, Coins, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, parseApiDate } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { scoreBand, statusStyle } from "@/lib/leadgen/leadgen.api";
import { useInboxCounts, useWallet } from "@/hooks/leadgen/use-leadgen";

export const LABEL = "text-xs font-semibold text-muted-foreground uppercase tracking-wide";
export const SELECT = "h-9 w-full rounded-md border border-input bg-card px-3 text-sm";
export const TEXTAREA = "w-full rounded-md border border-input bg-card px-3 py-2 text-sm leading-relaxed resize-y min-h-[88px]";
export const TH = "text-start font-semibold px-4 py-3 whitespace-nowrap";

export const num = (s: string) => { const n = parseFloat(s); return Number.isFinite(n) ? n : 0; };

/** True when the user holds any of the keys. One hook call, so it is safe where `a || b` of two hooks is not. */
export function useCanAny(keys: string[]) {
  const has = useAuthStore(s => s.hasRawPermission);
  return keys.some(k => has(k));
}

/** Debounces a fast-changing value (a search box) so each keystroke is not a request. */
export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => { const id = setTimeout(() => setV(value), ms); return () => clearTimeout(id); }, [value, ms]);
  return v;
}

/** A date-and-time as the viewer's own clock shows it. The API sends UTC instants; dates stay dates. */
export function formatDateTime(value: string | null | undefined, locale?: string) {
  if (!value) return "—";
  const d = parseApiDate(value);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
}

export function Field({ label, hint, error, children, className }: {
  label: string; hint?: string; error?: string | null; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className={LABEL}>{label}</label>
      {children}
      {error ? <p role="alert" className="text-[11px] text-destructive">{error}</p>
        : hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Colours come from the status map; the words come from i18n under `status.<key>`. */
export function StatusPill({ status, label }: { status: string; label?: string }) {
  const { t } = useTranslation("leadgen");
  const s = statusStyle(status);
  return (
    <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap", s.color, s.bg)}>
      {label ?? t(`status.${status}`, { defaultValue: status })}
    </span>
  );
}

/** A 0–100 score as a small coloured chip. Colour is never the only signal: the number is always there. */
export function ScoreChip({ value, label, title }: { value: number; label: string; title?: string }) {
  const band = scoreBand(value);
  const cls = band === "high" ? "text-success bg-success/10" : band === "mid" ? "text-amber-600 bg-amber-50 dark:bg-amber-900/20" : "text-muted-foreground bg-muted";
  return (
    <span title={title} className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold tabular-nums", cls)}>
      <span className="opacity-70 font-medium">{label}</span>{value}
    </span>
  );
}

export function Modal({ title, subtitle, onClose, children, footer, size = "md", side = false, layer = 50 }: {
  title: React.ReactNode; subtitle?: React.ReactNode; onClose: () => void; children: React.ReactNode;
  footer?: React.ReactNode; size?: "sm" | "md" | "lg" | "xl"; side?: boolean; layer?: 50 | 60;
}) {
  const { t } = useTranslation("leadgen");
  const width = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" }[size];
  const z = layer === 60 ? "z-[60]" : "z-50";

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className={cn("fixed inset-0 bg-black/40", z)} onClick={onClose} />
      {/* Centred by a flex wrapper, not a CSS translate: the open animation writes its own
          transform on the panel, which would cancel a translate and push it off-centre. */}
      <div className={cn("fixed inset-0 flex pointer-events-none", z, side ? "justify-end" : "items-start justify-center px-4 pt-[6vh]")}>
        <motion.div
          role="dialog" aria-modal="true"
          initial={side ? { x: "100%" } : { opacity: 0, scale: 0.97 }}
          animate={side ? { x: 0 } : { opacity: 1, scale: 1 }}
          exit={side ? { x: "100%" } : { opacity: 0, scale: 0.97 }}
          transition={{ type: "spring", damping: 30, stiffness: 320 }}
          className={cn("pointer-events-auto flex flex-col bg-card border-border shadow-2xl w-full",
            side ? "h-full border-s" : "max-h-[88vh] rounded-xl border", width)}>
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
            <div className="min-w-0">
              <h2 className="text-base font-bold truncate">{title}</h2>
              {subtitle && <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground shrink-0" aria-label={t("action.close")}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 px-5 py-3 border-t border-border shrink-0">{footer}</div>}
        </motion.div>
      </div>
    </>
  );
}

export function ConfirmDialog({ title, body, confirmLabel, destructive = true, pending, onConfirm, onClose }: {
  title: string; body: React.ReactNode; confirmLabel: string; destructive?: boolean; pending?: boolean;
  onConfirm: () => void; onClose: () => void;
}) {
  const { t } = useTranslation("leadgen");
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-[70]" onClick={onClose} />
      <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[30vh] pointer-events-none">
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
          className="pointer-events-auto w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-2xl">
          <p className="font-semibold text-sm">{title}</p>
          <div className="text-sm text-muted-foreground mt-1">{body}</div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>{t("action.cancel")}</Button>
            <Button size="sm" className={cn("gap-1.5", destructive && "bg-destructive hover:bg-destructive/90")} disabled={pending} onClick={onConfirm}>
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{confirmLabel}
            </Button>
          </div>
        </motion.div>
      </div>
    </>
  );
}

export function SearchBox({ value, onChange, placeholder, className }: {
  value: string; onChange: (v: string) => void; placeholder: string; className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="h-9 ps-9 text-sm" />
    </div>
  );
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void; }) {
  const { t } = useTranslation("leadgen");
  if (total <= pageSize) return null;
  const pages = Math.ceil(total / pageSize);
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted-foreground">
      <span>{t("pager.range", { from: (page - 1) * pageSize + 1, to: Math.min(page * pageSize, total), total })}</span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label={t("pager.previous")}>
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        </Button>
        <span className="px-2 tabular-nums">{page} / {pages}</span>
        <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label={t("pager.next")}>
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </Button>
      </div>
    </div>
  );
}

export function StatTile({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "good" | "warn" | "bad" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-bold mt-1 tabular-nums",
        tone === "good" && "text-success", tone === "warn" && "text-amber-600", tone === "bad" && "text-destructive")}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: React.ElementType; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="p-12 text-center">
      <Icon className="h-9 w-9 mx-auto text-muted-foreground/50" />
      <p className="text-sm font-semibold mt-3">{title}</p>
      {body && <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingBlock() {
  const { t } = useTranslation("leadgen");
  return <div className="p-12 text-center text-sm text-muted-foreground flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{t("loading")}</div>;
}

/** A failed request must never look like a slow one — say what went wrong and offer another try. */
export function ErrorBlock({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  const { t } = useTranslation("leadgen");
  return (
    <div className="p-10 text-center">
      <AlertTriangle className="h-8 w-8 mx-auto text-destructive" />
      <p className="text-sm font-semibold mt-3">{t("error.title")}</p>
      <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
      {onRetry && <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>{t("action.retry")}</Button>}
    </div>
  );
}

export function Banner({ tone = "info", children, action }: { tone?: "info" | "warn" | "bad" | "good"; children: React.ReactNode; action?: React.ReactNode }) {
  const cls = {
    info: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/40 dark:bg-blue-900/10 dark:text-blue-200",
    warn: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-200",
    bad:  "border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-200",
    good: "border-green-200 bg-green-50 text-green-900 dark:border-green-900/40 dark:bg-green-900/10 dark:text-green-200",
  }[tone];
  return (
    <div className={cn("rounded-lg border px-4 py-3 text-sm flex items-start justify-between gap-3", cls)}>
      <div className="min-w-0">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ── Page frame ──────────────────────────────────────────────────────────────

interface Tab { to: string; key: string; perm: string[]; end?: boolean; badge?: number }

/**
 * The header every Lead Generation screen shares: title, the credit balance (always visible,
 * because everything that costs money is one click away) and a tab bar that shows only the screens
 * the signed-in user's role actually grants.
 */
export function LeadGenFrame({ title, description, actions, children }: {
  title: string; description?: string; actions?: React.ReactNode; children: React.ReactNode;
}) {
  const { t } = useTranslation("leadgen");
  const navigate = useNavigate();
  const has = useAuthStore(s => s.hasRawPermission);
  const canWallet = useCanAny(["leadgen.searches.view", "leadgen.prospects.view", "leadgen.credits.view", "leadgen.campaigns.view", "leadgen.reports.view"]);
  const canInbox = has("leadgen.inbox.view");
  const wallet = useWallet(canWallet);
  const counts = useInboxCounts(canInbox);

  const tabs: Tab[] = [
    { to: "/lead-generation", key: "overview", perm: ["leadgen.reports.view"], end: true },
    { to: "/lead-generation/find", key: "find", perm: ["leadgen.searches.view"] },
    { to: "/lead-generation/prospects", key: "prospects", perm: ["leadgen.prospects.view"] },
    { to: "/lead-generation/campaigns", key: "campaigns", perm: ["leadgen.campaigns.view"] },
    { to: "/lead-generation/inbox", key: "inbox", perm: ["leadgen.inbox.view"], badge: counts.data?.unread },
    { to: "/lead-generation/mailboxes", key: "mailboxes", perm: ["leadgen.mailboxes.view"] },
    { to: "/lead-generation/credits", key: "credits", perm: ["leadgen.credits.view"] },
    { to: "/lead-generation/settings", key: "settings", perm: ["leadgen.settings.view"] },
  ].filter(tab => tab.perm.some(p => has(p)));

  const balance = wallet.data?.balance;
  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{title}</h1>
          {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          {balance !== undefined && (
            <button
              onClick={() => has("leadgen.credits.view") && navigate("/lead-generation/credits")}
              className={cn("inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold tabular-nums transition-colors",
                balance < 5 ? "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-900/10 dark:text-amber-300" : "border-border bg-card hover:bg-muted/40")}
              title={t("balance.title")}>
              <Coins className="h-4 w-4" />{t("balance.value", { count: balance })}
            </button>
          )}
        </div>
      </div>

      {tabs.length > 1 && (
        <nav className="flex gap-1 overflow-x-auto border-b border-border -mx-1 px-1" aria-label={t("title")}>
          {tabs.map(tab => (
            <NavLink key={tab.to} to={tab.to} end={tab.end}
              className={({ isActive }) => cn(
                "relative px-3 py-2 text-sm font-medium whitespace-nowrap rounded-t-md transition-colors",
                isActive ? "text-primary after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-primary" : "text-muted-foreground hover:text-foreground")}>
              <span className="inline-flex items-center gap-1.5">
                {t(`nav.${tab.key}`)}
                {!!tab.badge && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold inline-flex items-center justify-center tabular-nums">{tab.badge}</span>}
              </span>
            </NavLink>
          ))}
        </nav>
      )}

      {children}
    </div>
  );
}

/** Shown when a role lacks the permission a screen needs. Hides nothing silently. */
export function NoAccess({ permission }: { permission: string }) {
  const { t } = useTranslation("leadgen");
  return (
    <div className="rounded-xl border border-border bg-card p-12 text-center">
      <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground/60" />
      <p className="text-sm font-semibold mt-3">{t("noAccess.title")}</p>
      <p className="text-sm text-muted-foreground mt-1">{t("noAccess.body", { permission })}</p>
    </div>
  );
}
