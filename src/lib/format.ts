import type { Locale } from "@/i18n/config";

const AED = "AED";

/**
 * Prices are stored as plain AED numbers. Arabic gets Arabic-Indic digits via Intl,
 * which is what a Gulf audience expects to read.
 */
export function formatPrice(value: number | null, locale: Locale, fallback: string): string {
  if (value === null) return fallback;
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-AE" : "en-AE", {
    style: "currency",
    currency: AED,
    maximumFractionDigits: 0,
  });
  return nf.format(value);
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-AE" : "en-AE").format(value);
}

/**
 * A compact price for cards, where the full figure crowds the layout.
 * 4_250_000 -> "AED 4.25M". Arabic keeps the full grouped number, since
 * abbreviating millions reads awkwardly in Arabic.
 */
export function formatPriceCompact(value: number | null, locale: Locale, fallback: string): string {
  if (value === null) return fallback;
  if (locale === "ar") return formatPrice(value, locale, fallback);
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `${AED} ${m % 1 === 0 ? m.toFixed(0) : m.toFixed(2).replace(/0$/, "")}M`;
  }
  if (value >= 1_000) return `${AED} ${(value / 1_000).toFixed(0)}K`;
  return formatPrice(value, locale, fallback);
}
