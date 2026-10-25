import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { taxRatesApi } from "@/lib/pos/master-data.api";
import { taxForCountry, type CountryTax } from "@/lib/onboarding/geo-data";
import { useAuthStore } from "@/store/auth.store";

/**
 * The tax rates a product form offers, taken from the workspace's tax master (Master Data → Tax Rates),
 * which is seeded for the tenant's country and editable. Falls back to the built-in country table when the
 * master is empty or cannot be read (for example a workspace without the POS/Finance module), so the form
 * always offers something sensible.
 */
export function useTaxOptions(): CountryTax & { fromMaster: boolean } {
  const country  = useAuthStore(s => s.tenant?.country);
  const fallback = React.useMemo(() => taxForCountry(country), [country]);

  const { data } = useQuery({
    queryKey: ["tax-master-options"],
    queryFn: () => taxRatesApi.getAll(),
    staleTime: 5 * 60_000,
    retry: false,
  });

  return React.useMemo(() => {
    const active = (data ?? []).filter(r => r.isActive);
    if (active.length === 0) return { ...fallback, fromMaster: false };

    const rates = Array.from(new Set(["0", ...active.map(r => String(Number(r.rate)))]))
      .sort((a, b) => Number(a) - Number(b));
    const def = active.find(r => r.isDefault) ?? active.find(r => Number(r.rate) > 0);
    return {
      label: fallback.label,
      rates,
      standard: def ? String(Number(def.rate)) : fallback.standard,
      fromMaster: true,
    };
  }, [data, fallback]);
}
