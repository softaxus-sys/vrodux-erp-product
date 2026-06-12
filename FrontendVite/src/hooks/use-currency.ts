import { useAuthStore } from "@/store/auth.store";
import type { Currency } from "@/types/global";

/** The tenant's configured currency (Settings → Regional), defaults to "AED". */
export function useCurrency(): Currency {
  return useAuthStore(s => s.tenant?.currency) ?? "AED";
}
