import { useTranslation } from "react-i18next";
import { Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { isActivityLog, type ActivityDto, type ActivityType } from "@/lib/crm/crm.api";
import {
  ACTIVITY_TEXT_MAX, formatActivityLogged, formatActivitySchedule, isTimedActivity,
} from "@/lib/crm/activity-format";

/**
 * The text box of the quick-add row. Notes and emails are free text and get a multi-line box
 * (Ctrl+Enter adds); tasks, calls and meetings stay a one-line title (Enter adds).
 */
export function ActivityTextField({ type, value, onChange, onSubmit, placeholder }: {
  type: ActivityType; value: string; onChange: (v: string) => void; onSubmit: () => void; placeholder: string;
}) {
  const nearLimit = value.length > ACTIVITY_TEXT_MAX - 500;

  if (!isActivityLog(type)) {
    return (
      <Input value={value} maxLength={ACTIVITY_TEXT_MAX} onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === "Enter" && onSubmit()} placeholder={placeholder} className="h-8 text-sm flex-1 min-w-[10rem]" />
    );
  }

  return (
    <div className="flex-1 min-w-[10rem]">
      <textarea value={value} maxLength={ACTIVITY_TEXT_MAX} rows={value.length > 80 || value.includes("\n") ? 4 : 2}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onSubmit(); } }}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-card px-3 py-1.5 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/30" />
      {nearLimit && (
        <p className={cn("text-[10px] text-end tabular-nums", value.length >= ACTIVITY_TEXT_MAX ? "text-destructive" : "text-muted-foreground")}>
          {value.length} / {ACTIVITY_TEXT_MAX}
        </p>
      )}
    </div>
  );
}

/** Date for anything with a due date, plus a time for meetings and calls. */
export function ActivityDueFields({ type, dueDate, dueTime, onDate, onTime }: {
  type: ActivityType; dueDate: string; dueTime: string; onDate: (v: string) => void; onTime: (v: string) => void;
}) {
  const { t } = useTranslation("crm");
  if (isActivityLog(type)) return null;
  return (
    <>
      <Input type="date" value={dueDate} onChange={e => onDate(e.target.value)}
        aria-label={t("activity.dueDate", { defaultValue: "Date" })} className="h-8 text-xs w-36" />
      {isTimedActivity(type) && (
        <Input type="time" value={dueTime} onChange={e => onTime(e.target.value)} disabled={!dueDate}
          aria-label={t("activity.dueTime", { defaultValue: "Time" })} className="h-8 text-xs w-28" />
      )}
    </>
  );
}

/** The entry's text, keeping the line breaks of a long note. */
export function ActivityText({ text }: { text: string }) {
  return <p className="text-sm font-medium leading-snug whitespace-pre-wrap break-words">{text}</p>;
}

/** "⏱ 10 Oct 2026, 12:00 PM · overdue" — when the task / call / meeting is scheduled for. */
export function ActivitySchedule({ activity, overdue }: { activity: ActivityDto; overdue: boolean }) {
  const { t } = useTranslation("crm");
  if (!activity.dueDate) return null;
  return (
    <span className={cn("inline-flex items-center gap-0.5", overdue && "text-destructive font-semibold")}>
      <Clock className="h-2.5 w-2.5" />
      {formatActivitySchedule(activity.dueDate, activity.dueTime)}
      {overdue && ` · ${t("activity.overdue")}`}
    </span>
  );
}

/** "Logged 10 Oct 2026, 3:42 PM" — when the entry itself was written. */
export function ActivityLogged({ activity }: { activity: ActivityDto }) {
  const { t } = useTranslation("crm");
  const when = formatActivityLogged(activity.createdAt);
  if (!when) return null;
  return <p className="text-[11px] text-muted-foreground/80 mt-0.5">{t("activity.loggedOn", { date: when, defaultValue: "Logged {{date}}" })}</p>;
}
