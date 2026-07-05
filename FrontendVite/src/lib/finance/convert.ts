import type { ExchangeRateDto } from "@/lib/finance/exchange-rates.api";

/**
 * Build a { CODE → USD-per-unit } lookup from the latest rate per currency.
 * USD (the base) is always 1. Rates are quoted as units of USD per 1 unit of the currency,
 * so cross-rates are computed as (from→USD) / (to→USD).
 */
export function buildRateMap(rates: ExchangeRateDto[]): Record<string, number> {
  const latest: Record<string, { date: string; rate: number }> = {};
  for (const r of rates) {
    const code = r.currencyCode.toUpperCase();
    if (!latest[code] || r.rateDate > latest[code].date) latest[code] = { date: r.rateDate, rate: r.rate };
  }
  const map: Record<string, number> = { USD: 1 };
  for (const [code, v] of Object.entries(latest)) if (v.rate > 0) map[code] = v.rate;
  return map;
}

/**
 * Convert an amount between currencies using a USD-per-unit rate map (see buildRateMap).
 * Returns the input unchanged when either rate is missing, so callers degrade gracefully.
 */
export function convert(
  amount: number,
  from: string,
  to: string,
  rateMap: Record<string, number>,
): number {
  if (!Number.isFinite(amount)) return 0;
  const f = from.toUpperCase();
  const t = to.toUpperCase();
  if (f === t) return amount;
  const fromUsd = rateMap[f];
  const toUsd = rateMap[t];
  if (!fromUsd || !toUsd) return amount;
  return (amount * fromUsd) / toUsd;
}
