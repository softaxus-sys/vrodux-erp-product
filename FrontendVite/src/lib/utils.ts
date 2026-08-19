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

export function formatDate(
  date: string | Date | null | undefined,
  format: "short" | "medium" | "long" | "relative" = "medium",
  locale: string = activeLocale()
): string {
  if (date === null || date === undefined || date === "") return "—";
  const d = typeof date === "string" ? new Date(date) : date;
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

