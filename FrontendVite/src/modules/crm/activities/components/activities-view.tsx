import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { CheckSquare, Phone, Mail, Calendar, StickyNote, ListTodo, AlertTriangle, CalendarClock, Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useActivitiesPaged, useActivitiesSummary, useCompleteActivity, useReopenActivity, useDeleteActivity,
} from "@/hooks/crm/use-crm";
import { Button } from "@/components/ui/button";

const ICON: Record<string, typeof Phone> = { task: CheckSquare, call: Phone, meeting: Calendar, email: Mail, note: StickyNote };
const ORIGIN_KEYS = new Set(["customer", "deal", "lead"]);
const FILTERS = ["open", "overdue", "today", "completed", "all"] as const;
type FilterKey = typeof FILTERS[number];

export function ActivitiesView() {
  const { t } = useTranslation("crm");
  const [filter, setFilter] = React.useState<FilterKey>("open");
  const { data: summary } = useActivitiesSummary();
  const complete = useCompleteActivity();
  const reopen = useReopenActivity();
  const del = useDeleteActivity();

  const today = new Date().toISOString().slice(0, 10);
  const [page, setPage] = React.useState(1);

  // Every filter now narrows in SQL. "overdue" and "today" used to be applied in the browser over
  // the whole list, which cannot survive paging: it would filter within one page and under-report.
  const params = React.useMemo(() => {
    switch (filter) {
      case "completed": return { completed: true };
      case "all":       return {};
      case "overdue":   return { completed: false, dueBefore: today };
      case "today":     return { completed: false, dueOn: today };
      default:          return { completed: false };
    }
  }, [filter, today]);

  // Back to page one whenever the filter changes — page 3 of the previous filter is meaningless
  // against a different result set, and often past its end.
  React.useEffect(() => { setPage(1); }, [filter]);

  const { data: paged, isFetching } = useActivitiesPaged({ ...params, page, pageSize: 30 });
  const items      = paged?.items ?? [];
  const totalCount = paged?.totalCount ?? 0;
  const totalPages = paged?.totalPages ?? 1;

  const stats = [
    { label: t("activity.view.openTasks"), value: summary?.openTasks ?? 0, icon: ListTodo, color: "text-primary", bg: "bg-primary/10" },
    { label: t("activity.view.overdueStat"), value: summary?.overdue ?? 0, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
    { label: t("activity.view.dueToday"), value: summary?.dueToday ?? 0, icon: CalendarClock, color: "text-warning", bg: "bg-warning/10" },
    { label: t("activity.view.upcoming"), value: summary?.upcoming ?? 0, icon: Calendar, color: "text-success", bg: "bg-success/10" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ListTodo className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{t("activity.view.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("activity.view.subtitle")}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", s.bg)}>
                <Icon className={cn("h-5 w-5", s.color)} />
              </div>
              <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="font-bold text-lg leading-tight">{s.value}</p></div>
            </motion.div>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              filter === f ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground")}>
            {t(`activity.view.filter.${f}`)}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
        {totalCount === 0 ? (
          <div className="text-center py-16 text-sm text-muted-foreground">{t("activity.view.empty")}</div>
        ) : items.map(a => {
          const Icon = ICON[a.type] ?? StickyNote;
          const overdue = !a.completed && a.dueDate && a.dueDate < today;
          return (
            <div key={a.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 group">
              <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                a.completed ? "bg-success/10 text-success" : "bg-primary/10 text-primary")}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-medium leading-tight truncate", a.completed && "line-through text-muted-foreground")}>{a.subject}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  <span>{t(`activityType.${a.type}`)}</span>
                  {a.relatedToName && <> · {a.relatedToName} <span className="opacity-70">({t(`activity.origin.${ORIGIN_KEYS.has(a.relatedToType) ? a.relatedToType : "customer"}`)})</span></>}
                  {a.dueDate && <span className={cn(overdue && "text-destructive font-semibold")}> · {t("activity.view.due", { date: a.dueDate })}{overdue && ` ${t("activity.view.overdueParen")}`}</span>}
                  {a.assignedTo && <> · {a.assignedTo}</>}
                </p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {a.type !== "note" && a.type !== "email" && (
                  a.completed
                    ? <button onClick={() => reopen.mutate(a.id)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1">{t("activity.view.reopen")}</button>
                    : <button onClick={() => complete.mutate(a.id)} className="inline-flex items-center gap-1 text-xs text-success hover:bg-success/10 rounded px-2 py-1"><Check className="h-3.5 w-3.5" />{t("activity.view.done")}</button>
                )}
                <button onClick={() => del.mutate(a.id)} className="p-1.5 rounded text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          );
        })}
        {totalCount > 0 && (
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-xs text-muted-foreground">
              {t("activity.view.showing", {
                shown: `${(page - 1) * 30 + 1}–${Math.min(page * 30, totalCount)}`,
                total: totalCount,
              })}
            </span>
            <div className="flex items-center gap-2">
              {/* Disabled while fetching, so a double-click cannot skip a page. */}
              <Button variant="outline" size="sm" className="h-8 text-xs"
                disabled={page <= 1 || isFetching}
                onClick={() => setPage(p => Math.max(1, p - 1))}>
                {t("activity.view.prev", { defaultValue: "Previous" })}
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" className="h-8 text-xs"
                disabled={page >= totalPages || isFetching}
                onClick={() => setPage(p => p + 1)}>
                {t("activity.view.next", { defaultValue: "Next" })}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
