import { useAuthStore } from "@/store/auth.store";
import type { Currency } from "@/types/global";

/**
 * Fallback used only when no tenant is resolved (logged out, or a super-admin acting
 * outside any tenant). Mirrors the backend's `TenantCurrency.Fallback`.
 */
const FALLBACK: Currency = "AED";

/**
 * The tenant's operating currency (Settings → Currency & Rates).
 *
 * This is the display currency for the whole app: recorded amounts are never converted,
 * the tenant's own currency is what every figure is labelled with. Genuinely
 * multi-currency records — foreign bank accounts, import purchase bills — are the one
 * exception and show their own stored `currencyCode` instead.
 */
export function useCurrency(): Currency {
  return useAuthStore(s => s.tenant?.currency) || FALLBACK;
}

/**
 * Non-reactive read of the same value, for contexts that cannot call a hook:
 * module-scope constants, print/PDF/CSV builders, ESC-POS receipts, event handlers.
 *
 * Prefer `useCurrency()` inside components — this does not re-render on a currency
 * change, so a value captured at module scope would go stale after Settings → Currency
 * is edited. Call it at use time, not at module load.
 */
export function getTenantCurrency(): Currency {
  return useAuthStore.getState().tenant?.currency || FALLBACK;
}

/**
 * Currency codes offered in a picker, with the tenant's own currency guaranteed present
 * and listed first.
 *
 * Every "add" form in the app used to hard-code a list like `["AED","USD","EUR"]` and
 * default its state to `"AED"`, so a PKR tenant creating an expense, a contract or a BOQ
 * silently recorded it in dirhams — and in several of those lists PKR was not even an
 * option. The tenant's currency is the sensible default; the rest are for the genuinely
 * foreign-currency case.
 */
export function useCurrencyOptions(extra: readonly string[] = COMMON_CURRENCIES): Currency[] {
  const tenant = useCurrency();
  return [tenant, ...extra.filter(c => c.toUpperCase() !== tenant.toUpperCase())];
}

/** Widely used codes offered alongside the tenant's own currency. */
export const COMMON_CURRENCIES = [
  "USD", "EUR", "GBP", "AED", "SAR", "QAR", "KWD", "BHD", "OMR", "PKR", "INR",
] as const;
