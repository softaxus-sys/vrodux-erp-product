import type { CalendarEventDto } from "@/lib/calendar/calendar.api";

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
export const fmtTime = (d: Date) => d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

const pad = (n: number) => String(n).padStart(2, "0");
/** yyyy-MM-dd in LOCAL time (what a date input holds). */
export const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** HH:mm in LOCAL time (what a time input holds). */
export const toTimeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/**
 * Where an event sits in the viewer's calendar, as local Dates.
 *
 * A timed event is an instant, so the browser shows it in the viewer's zone. An all-day event is a
 * calendar DATE, stored as midnight UTC: converting it would shift it a day for anyone west of UTC,
 * so it is read by its UTC date parts and placed on that same local date. The end is exclusive.
 */
export function eventLocalRange(e: CalendarEventDto): [Date, Date] {
  const s = new Date(e.startUtc), en = new Date(e.endUtc);
  if (!e.isAllDay) return [s, en];
  return [
    new Date(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()),
    new Date(en.getUTCFullYear(), en.getUTCMonth(), en.getUTCDate()),
  ];
}

/** An all-day date picked as yyyy-MM-dd -> midnight UTC of that date (ISO). */
export const allDayUtc = (yyyyMmDd: string, plusDays = 0) => {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + plusDays)).toISOString();
};

/** Local date + time inputs -> UTC ISO. */
export const localToUtc = (date: string, time: string) => new Date(`${date}T${time}`).toISOString();
