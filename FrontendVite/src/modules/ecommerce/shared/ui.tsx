import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, parseApiDate } from "@/lib/utils";

export const LABEL = "text-xs font-semibold text-muted-foreground uppercase tracking-wide";
export const SELECT = "h-9 w-full rounded-md border border-input bg-card px-3 text-sm";
export const TH = "text-start font-semibold px-4 py-3";

/** Debounces a fast-changing value (a search box) so each keystroke is not a request. */
export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => { const id = setTimeout(() => setV(value), ms); return () => clearTimeout(id); }, [value, ms]);
  return v;
}

/** "3 minutes ago" in the user's language. Null when there is no date. */
export function useTimeAgo() {
  const { i18n } = useTranslation();
  return React.useCallback((iso: string | null | undefined) => {
    if (!iso) return null;
    const d = parseApiDate(iso);
    if (!d) return null;
    const seconds = Math.round((d.getTime() - Date.now()) / 1000);
    const rtf = new Intl.RelativeTimeFormat(i18n.language, { numeric: "auto" });
    const abs = Math.abs(seconds);
    if (abs < 60) return rtf.format(Math.trunc(seconds), "second");
    if (abs < 3600) return rtf.format(Math.trunc(seconds / 60), "minute");
    if (abs < 86400) return rtf.format(Math.trunc(seconds / 3600), "hour");
    return rtf.format(Math.trunc(seconds / 86400), "day");
  }, [i18n.language]);
}

export function Field({ label, hint, children, className }: {
  label: string; hint?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className={LABEL}>{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Pill({ meta, children }: { meta: { color: string; bg: string }; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap", meta.color, meta.bg)}>
      {children}
    </span>
  );
}

/** Render inside the parent's <AnimatePresence>. */
export function Modal({ title, subtitle, onClose, children, footer, size = "md", layer = 50 }: {
  title: React.ReactNode; subtitle?: React.ReactNode; onClose: () => void; children: React.ReactNode;
  footer?: React.ReactNode; size?: "sm" | "md" | "lg" | "xl"; layer?: 50 | 60;
}) {
  const { t } = useTranslation("ecommerce");
  const width = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" }[size];
  const z = layer === 60 ? "z-[60]" : "z-50";

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className={cn("fixed inset-0 bg-black/40", z)} onClick={onClose} />
      {/* Centred by a flex wrapper, not a CSS translate: the open animation writes its own transform on the panel. */}
      <div className={cn("fixed inset-0 flex items-start justify-center px-4 pt-[6vh] pointer-events-none", z)}>
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
          transition={{ type: "spring", damping: 30, stiffness: 320 }}
          className={cn("pointer-events-auto flex flex-col bg-card border border-border shadow-2xl w-full max-h-[88vh] rounded-xl", width)}>
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
          {footer && <div className="flex justify-end gap-2 px-5 py-3 border-t border-border shrink-0">{footer}</div>}
        </motion.div>
      </div>
    </>
  );
}

export function ConfirmDialog({ title, body, confirmLabel, destructive = true, pending, onConfirm, onClose }: {
  title: string; body: React.ReactNode; confirmLabel: string; destructive?: boolean; pending?: boolean;
  onConfirm: () => void; onClose: () => void;
}) {
  const { t } = useTranslation("ecommerce");
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-[70]" onClick={onClose} />
      <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[30vh] pointer-events-none">
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
          className="pointer-events-auto w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-2xl">
          <p className="font-semibold text-sm">{title}</p>
          <div className="text-sm text-muted-foreground mt-1 space-y-3">{body}</div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>{t("action.cancel")}</Button>
            <Button size="sm" className={cn("gap-1.5", destructive && "bg-destructive hover:bg-destructive/90")}
              disabled={pending} onClick={onConfirm}>
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{confirmLabel}
            </Button>
          </div>
        </motion.div>
      </div>
    </>
  );
}

export function PageHeader({ title, description, children }: {
  title: string; description: string; children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder, className, autoFocus }: {
  value: string; onChange: (v: string) => void; placeholder: string; className?: string; autoFocus?: boolean;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} className="h-9 ps-9 text-sm" />
    </div>
  );
}

export function Pager({ page, pageSize, total, onPage }: {
  page: number; pageSize: number; total: number; onPage: (p: number) => void;
}) {
  const { t } = useTranslation("ecommerce");
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

export function TableState({ loading, error, empty, emptyText, icon: Icon }: {
  loading: boolean; error?: Error | null; empty: boolean; emptyText: string; icon: React.ElementType;
}) {
  const { t } = useTranslation("ecommerce");
  if (loading) return <div className="p-12 text-center text-sm text-muted-foreground">{t("loading")}</div>;
  if (error) return <div className="p-12 text-center text-sm text-destructive">{error.message}</div>;
  if (empty)
    return (
      <div className="p-12 text-center">
        <Icon className="h-8 w-8 mx-auto text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground mt-3">{emptyText}</p>
      </div>
    );
  return null;
}
