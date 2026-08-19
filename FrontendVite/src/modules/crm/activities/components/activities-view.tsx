import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { CheckSquare, Phone, Mail, Calendar, StickyNote, ListTodo, AlertTriangle, CalendarClock, Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useActivities, useActivitiesSummary, useCompleteActivity, useReopenActivity, useDeleteActivity,
} from "@/hooks/crm/use-crm";
import { useLazyList } from "@/hooks/use-lazy-list";
import { Button } from "@/components/ui/button";

const ICON: Record<string, typeof Phone> = { task: CheckSquare, call: Phone, meeting: Calendar, email: Mail, note: StickyNote };
const ORIGIN_KEYS = new Set(["customer", "deal", "lead"]);
const FILTERS = ["open", "overdue", "today", "completed", "all"] as const;
type FilterKey = typeof FILTERS[number];

export function ActivitiesView() {
  const { t } = useTranslation("crm");
  const [filter, setFilter] = React.useState<FilterKey>("open");
  const { data: summary } = useActivitiesSummary();
  const { data: all = [] } = useActivities(
    filter === "completed" ? { completed: true } : filter === "all" ? {} : { completed: false }
  );
  const complete = useCompleteActivity();
  const reopen = useReopenActivity();
  const del = useDeleteActivity();

  const today = new Date().toISOString().slice(0, 10);
  const items = React.useMemo(() => {
    if (filter === "overdue") return all.filter(a => !a.completed && a.dueDate && a.dueDate < today);
    if (filter === "today")   return all.filter(a => !a.completed && a.dueDate === today);
    return all;
  }, [all, filter, today]);

  const lazy = useLazyList(items, 30);

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
        {lazy.total === 0 ? (
          <div className="text-center py-16 text-sm text-muted-foreground">{t("activity.view.empty")}</div>
        ) : lazy.visible.map(a => {
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
        {lazy.hasMore && (
          <div ref={lazy.sentinelRef} className="flex items-center justify-center gap-3 py-3">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={lazy.loadMore}>{t("activity.view.loadMore")}</Button>
            <span className="text-xs text-muted-foreground">{t("activity.view.showing", { shown: lazy.shown, total: lazy.total })}</span>
          </div>
        )}
      </div>
    </div>
  );
}
