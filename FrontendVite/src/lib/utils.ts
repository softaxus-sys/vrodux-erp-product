import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import i18n from "@/i18n";
import type { Currency } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * The active UI language as a BCP-47 locale for `Intl.*`. Drives locale-aware
 * dates/numbers (e.g. Arabic "ar" → Arabic-Indic digits + Arabic month names).
 * Formatters accept an explicit `locale` override for cases that must stay fixed
 * regardless of UI language (e.g. printed receipts).
 */
export function activeLocale(): string {
  return i18n?.language || "en";
}

export function formatCurrency(
  amount: number,
  currency: Currency = "AED",
  locale: string = activeLocale()
): string {
  // Guard non-finite input (undefined/null coerced to NaN, or a NaN sum) so we never
  // render e.g. "PKRNaN" — Intl.NumberFormat.format(NaN) outputs the literal "NaN".
  const value = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency || "AED",
  }).format(value);
}

export function formatNumber(value: number, compact = false, locale: string = activeLocale()): string {
  if (compact) {
    return new Intl.NumberFormat(locale, {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat(locale).format(value);
}

export function formatPercentage(value: number, decimals = 1): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(decimals)}%`;
}

/**
 * Parses a timestamp from the API into a real instant.
 *
 * <p>The backend stores and returns UTC, but .NET serialises a `DateTime` whose Kind is
 * Unspecified **without a trailing `Z`** — "2026-08-25T19:03:55.12". JavaScript reads a bare
 * date-time like that as *local* time, so every timestamp rendered as-is was wrong by the
 * viewer's UTC offset: four hours out in the Gulf, and enough to show yesterday's evening
 * activity as today.</p>
 *
 * <p>So a string carrying no zone and no offset is treated as UTC — which is what the server
 * meant — and the browser then formats it in the viewer's own timezone. Date-only values
 * ("2026-08-25", used for attendance and leave dates) are deliberately left alone: they are
 * calendar days, not instants, and shifting them by an offset would move them a day.</p>
 */
export function parseApiDate(value: string): Date {
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const isDateTime = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value);

  return new Date(isDateTime && !hasZone && !isDateOnly ? `${value.replace(" ", "T")}Z` : value);
}

export function formatDate(
  date: string | Date | null | undefined,
  format: "short" | "medium" | "long" | "relative" = "medium",
  locale: string = activeLocale()
): string {
  if (date === null || date === undefined || date === "") return "—";
  const d = typeof date === "string" ? parseApiDate(date) : date;
  if (isNaN(d.getTime())) return "—";

  if (format === "relative") {
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    // Locale-aware relative time (Arabic: "منذ ٥ دقائق", etc.).
    if (days < 7) {
      const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
      if (minutes < 1) return rtf.format(0, "second");
      if (minutes < 60) return rtf.format(-minutes, "minute");
      if (hours < 24) return rtf.format(-hours, "hour");
      return rtf.format(-days, "day");
    }
  }

  const opts: Record<string, Intl.DateTimeFormatOptions> = {
    short:    { day: "2-digit", month: "2-digit", year: "numeric" },
    medium:   { day: "numeric", month: "short",   year: "numeric" },
    long:     { day: "numeric", month: "long",     year: "numeric", weekday: "long" },
    relative: { day: "numeric", month: "short" },
  };
  return new Intl.DateTimeFormat(locale, opts[format] ?? opts["medium"]).format(d);
}

export function getInitials(name: string, maxChars = 2): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, maxChars);
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}


/** Human-readable file size, e.g. "1.4 MB". Shared by every module that stores attachments. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
