/**
 * useTenantBootstrap — runs once when the user is authenticated.
 *
 * Fetches the saved "regional" settings from the backend and patches the
 * auth-store tenant with the correct country, currency and timezone so
 * every module (POS receipt, reports, shift-gate denominations) sees the
 * right values without requiring the user to open the Settings page first.
 *
 * Called from ErpLayout so it fires on every authenticated page load.
 */

import * as React from "react";
import { useAuthStore } from "@/store/auth.store";
import { appSettingsApi } from "@/lib/identity/app-settings.api";

const CURRENCY_TO_COUNTRY: Record<string, string> = {
  AED: "ae", PKR: "pk", SAR: "sa", OMR: "om",
  INR: "in", GBP: "gb", USD: "us", EUR: "eu",
  QAR: "qa", KWD: "kw", BHD: "bh",
};

function deriveCountry(country?: string, currency?: string): string {
  const c = (country ?? "").toLowerCase().trim();
  if (c === "ae" || c.includes("uae") || c.includes("emirates"))  return "ae";
  if (c === "pk" || c.includes("pakistan"))                        return "pk";
  if (c === "sa" || c.includes("saudi"))                           return "sa";
  if (c === "om" || c === "oman")                                  return "om";
  if (c === "qa" || c === "qatar")                                 return "qa";
  if (c === "kw" || c === "kuwait")                                return "kw";
  if (c === "bh" || c === "bahrain")                               return "bh";
  if (c === "in" || c === "india")                                 return "in";
  if (c === "gb" || c.includes("kingdom"))                         return "gb";
  if (c === "us" || c.includes("united states"))                   return "us";
  if (c.length === 2 && /^[a-z]{2}$/.test(c))                     return c; // already a code
  // Fallback: derive from currency
  return CURRENCY_TO_COUNTRY[(currency ?? "").toUpperCase()] ?? "pk";
}

export function useTenantBootstrap() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  React.useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    (async () => {
      try {
        const regional = await appSettingsApi.getCategory("regional");
        if (cancelled) return;

        const currency  = regional.currency  ?? "";
        const timezone  = regional.timezone  ?? "";
        const rawCountry = regional.country  ?? "";
        const country   = deriveCountry(rawCountry, currency);
        const vatRate   = parseFloat(regional.vatRate ?? "0") || 0;

        const { tenant, setTenant } = useAuthStore.getState();
        if (!tenant) return;

        // Only update if something actually differs — avoids noisy re-renders
        if (
          tenant.country  !== country  ||
          tenant.currency !== currency ||
          tenant.timezone !== timezone
        ) {
          setTenant({
            ...tenant,
            country,
            currency,
            timezone,
            settings: {
              ...tenant.settings,
              vatEnabled:      vatRate > 0,
              defaultCurrency: currency as any,
            },
          });
        }
      } catch {
        // Backend unavailable — keep whatever is already in the store
      }
    })();

    return () => { cancelled = true; };
  }, [isAuthenticated]); // re-runs if the user logs out and back in
}
