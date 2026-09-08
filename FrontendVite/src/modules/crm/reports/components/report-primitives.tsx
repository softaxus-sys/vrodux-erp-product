import * as React from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Inbox, Loader2 } from "lucide-react";
import { cn, fitTextClass } from "@/lib/utils";

/** Small KPI tile used across every report header. */
export function StatTile({
  label, value, hint, tone = "default", index = 0,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "success" | "danger" | "warning" | "primary";
  index?: number;
}) {
  const toneClass = {
    default: "text-foreground",
    primary: "text-primary",
    success: "text-success",
    danger:  "text-destructive",
    warning: "text-amber-600 dark:text-amber-500",
  }[tone];

  // Only a plain string/number can be measured and shrunk to fit; a caller passing richer JSX
  // (an icon + text, a badge) keeps the default size — it's on them to keep it short.
  const isPlain = typeof value === "string" || typeof value === "number";
  const sizeClass = isPlain ? fitTextClass(value, "lg") : "text-lg";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3) }}
      className="bg-card border border-border rounded-xl p-4 min-w-0"
    >
      <p className="text-xs text-muted-foreground truncate">{label}</p>
      <p className={cn("font-bold leading-tight mt-1 truncate", sizeClass, toneClass)} title={isPlain ? String(value) : undefined}>
        {value}
      </p>
      {hint && <p className="text-[11px] text-muted-foreground mt-1 truncate">{hint}</p>}
    </motion.div>
  );
}

export function ReportCard({
  title, subtitle, children, className,
}: {
  title: string; subtitle?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("bg-card border border-border rounded-xl p-5", className)}>
      <div className="mb-4">
        <h3 className="font-semibold text-sm">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

/** Honest empty state — never render a chart of nothing as if it were data. */
export function EmptyState({ message }: { message?: string }) {
  const { t } = useTranslation("crm");
  return (
    <div className="py-10 flex flex-col items-center justify-center text-center gap-2">
      <Inbox className="h-7 w-7 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">{message ?? t("reports.empty")}</p>
    </div>
  );
}

export function ReportLoading() {
  const { t } = useTranslation("crm");
  return (
    <div className="py-16 flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {t("reports.loading")}
    </div>
  );
}

export function ReportError({ message }: { message?: string }) {
  const { t } = useTranslation("crm");
  return (
    <div className="py-12 text-center">
      <p className="text-sm text-destructive font-medium">{t("reports.errorTitle")}</p>
      {message && <p className="text-xs text-muted-foreground mt-1">{message}</p>}
    </div>
  );
}

/** Horizontal bar list — the workhorse for "by stage / by source / by owner" breakdowns. */
export function BarList({
  rows, emptyMessage,
}: {
  rows: { label: string; value: number; display: string; sub?: string; color?: string }[];
  emptyMessage?: string;
}) {
  if (rows.length === 0) return <EmptyState message={emptyMessage} />;
  const max = Math.max(1, ...rows.map(r => r.value));

  return (
    <div className="space-y-3">
      {rows.map(r => (
        <div key={r.label}>
          <div className="flex items-baseline justify-between gap-3 mb-1">
            {/* Labels arrive already translated — no casing/underscore transform, which would mangle
                non-Latin scripts and double-transform an existing translation. */}
            <span className="text-xs font-medium truncate">{r.label}</span>
            <span className="text-xs text-muted-foreground shrink-0">
              {r.display}
              {r.sub && <span className="ml-1.5 text-[10px]">{r.sub}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(r.value / max) * 100}%` }}
              transition={{ duration: 0.4 }}
              className={cn("h-full rounded-full", r.color ?? "bg-primary")}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export interface Column<T> {
  key:     string;
  header:  string;
  render:  (row: T) => React.ReactNode;
  align?:  "left" | "right";
  /** Value used for CSV/PDF export — falls back to the rendered node when omitted. */
  exportValue?: (row: T) => string | number;
}

/** Compact data table shared by the tabular reports. */
export function ReportTable<T>({
  columns, rows, emptyMessage, rowKey,
}: {
  columns: Column<T>[];
  rows: T[];
  emptyMessage?: string;
  rowKey: (row: T, i: number) => string;
}) {
  if (rows.length === 0) return <EmptyState message={emptyMessage} />;

  return (
    <div className="overflow-x-auto -mx-5 px-5">
      <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr className="border-b border-border">
            {columns.map(c => (
              <th
                key={c.key}
                className={cn(
                  "pb-2 text-xs font-medium text-muted-foreground whitespace-nowrap",
                  c.align === "right" ? "text-right pl-3" : "text-left pr-3",
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={rowKey(row, i)} className="border-b border-border/50 last:border-0">
              {columns.map(c => (
                <td
                  key={c.key}
                  className={cn(
                    "py-2.5 whitespace-nowrap",
                    c.align === "right" ? "text-right pl-3 tabular-nums" : "text-left pr-3",
                  )}
                >
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Locale-aware formatters. A hook because month names and day pluralisation both depend on the
 * active language — Arabic in particular has six plural forms, which a hand-rolled `n === 1` check
 * gets wrong.
 */
export function useReportFormat() {
  const { t, i18n } = useTranslation("crm");

  return React.useMemo(() => ({
    /** Month key ("2026-07") → "Jul 2026". Safe against unexpected values. */
    formatPeriod: (period: string): string => {
      const m = /^(\d{4})-(\d{2})$/.exec(period);
      if (!m) return period;
      return new Date(Number(m[1]), Number(m[2]) - 1, 1)
        .toLocaleString(i18n.language, { month: "short", year: "numeric" });
    },
    pct:  (value: number): string => `${value}%`,
    days: (value: number): string =>
      value ? t("reports.common.days", { count: value }) : t("reports.common.none"),
  }), [t, i18n.language]);
}
