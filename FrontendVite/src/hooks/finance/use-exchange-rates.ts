import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as React from "react";
import { exchangeRatesApi } from "@/lib/finance/exchange-rates.api";
import { tenantSettingsApi } from "@/lib/identity/tenant-settings.api";
import { buildRateMap, convert } from "@/lib/finance/convert";
import { useCurrency } from "@/hooks/use-currency";
import { useAuthStore } from "@/store/auth.store";
import { refreshSession } from "@/lib/identity/refresh-session";

const QK = "exchange-rates";

/**
 * The current exchange rates (USD base) — one row per currency. 30-min staleness; rates move slowly.
 *
 * Asks the server for latest-per-currency rather than the whole history: both consumers
 * (`buildRateMap` and the settings table) reduce to exactly this, and the table gains a row per
 * currency every day, so the unfiltered read grows without bound.
 */
export function useExchangeRates() {
  return useQuery({
    queryKey: [QK, "latest"],
    queryFn: () => exchangeRatesApi.getAll(undefined, true),
    staleTime: 30 * 60 * 1000,
  });
}

/** Manual "Refresh now" — pulls live rates from the online provider. */
export function useRefreshRates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => exchangeRatesApi.refresh(),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: [QK] });
      toast.success(res.updated > 0
        ? `Updated ${res.updated} rate${res.updated === 1 ? "" : "s"} (as of ${res.asOf}).`
        : "No live rates were available — kept the current rates.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/**
 * Change the tenant's operating currency. Persists on the backend and updates the auth store
 * immediately so the whole app (formatCurrency via useCurrency) reflects it without a re-login.
 *
 * The store patch alone is not enough: the backend stamps every newly created record with the
 * currency from the JWT `currency` claim, which is fixed at sign-in. Without re-issuing the
 * token the app would render the new currency while the server kept writing the old one — a
 * quotation composed in USD came back stored, exported and printed as AED. So refresh the
 * session too; it is best-effort, since the currency itself is already persisted.
 */
export function useUpdateTenantCurrency() {
  return useMutation({
    mutationFn: async (currency: string) => {
      const res = await tenantSettingsApi.updateCurrency(currency);
      const reissued = await refreshSession();
      return { res, reissued };
    },
    onSuccess: ({ reissued }, currency) => {
      const code = currency.toUpperCase();
      const tenant = useAuthStore.getState().tenant;
      // The refresh already rebuilt the tenant from fresh claims; patch only if it did not run.
      if (!reissued && tenant) useAuthStore.getState().setTenant({ ...tenant, currency: code });
      if (reissued) toast.success(`Operating currency changed to ${code}.`);
      else toast.warning(
        `Operating currency changed to ${code}. Sign out and back in so new records are recorded in ${code}.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/**
 * A memoised converter into the tenant's operating currency, using live USD-based rates.
 * Amounts recorded in another currency are re-expressed for display/reporting (non-destructive).
 */
export function useCurrencyConverter() {
  const tenantCurrency = useCurrency();
  const { data: rates = [] } = useExchangeRates();
  const rateMap = React.useMemo(() => buildRateMap(rates), [rates]);

  const toTenant = React.useCallback(
    (amount: number, from: string) => convert(amount, from, tenantCurrency, rateMap),
    [rateMap, tenantCurrency],
  );
  const between = React.useCallback(
    (amount: number, from: string, to: string) => convert(amount, from, to, rateMap),
    [rateMap],
  );

  return { toTenant, between, rateMap, tenantCurrency };
}
