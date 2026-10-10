import { activeLocale, parseApiDate } from "@/lib/utils";

/** Longest note / subject the server accepts. Mirrors `Activity.SubjectMaxLength`. */
export const ACTIVITY_TEXT_MAX = 4000;

/** Types that are scheduled for a moment, so they take a time as well as a date. */
export const isTimedActivity = (type: string) => type === "meeting" || type === "call";

/**
 * When an activity is scheduled for: "10 Oct 2026, 12:00 PM", or just the date when no time was set.
 * The date and time are the user's own calendar values, so they are read as local — never shifted
 * by a timezone offset.
 */
export function formatActivitySchedule(dueDate?: string | null, dueTime?: string | null): string {
  if (!dueDate) return "";
  const [y, m, d] = dueDate.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return dueDate;

  const [hh, mm] = (dueTime ?? "").split(":").map(Number);
  const hasTime = !!dueTime && Number.isFinite(hh) && Number.isFinite(mm);
  const date = new Date(y, m - 1, d, hasTime ? hh : 0, hasTime ? mm : 0);

  return new Intl.DateTimeFormat(activeLocale(), {
    day: "numeric", month: "short", year: "numeric",
    ...(hasTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(date);
}

/** When an entry was logged, with the time: "10 Oct 2026, 3:42 PM". */
export function formatActivityLogged(createdAt?: string | null): string {
  if (!createdAt) return "";
  const d = parseApiDate(createdAt);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(activeLocale(), {
    day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
  }).format(d);
}
