import { useQuery } from "@tanstack/react-query";
import { appSettingsApi } from "@/lib/identity/app-settings.api";
import { useAuthStore } from "@/store/auth.store";

/**
 * The name to print on a customer-facing document.
 *
 * Order matters, and it is the order a finance person would expect on a tax invoice:
 *   1. the configured legal name (Settings → General → Company),
 *   2. the configured trading name,
 *   3. the workspace's own name from the JWT.
 *
 * There is deliberately no hardcoded fallback. The invoice print used to default to the literal
 * string "Your Company", which is what every generated invoice actually said.
 */
export function getTenantName(): string {
  return useAuthStore.getState().tenant?.name?.trim() || "";
}

/**
 * Reads the company block from app settings. Cached for 5 minutes and shared with any other
 * caller of the same key, so a document that needs it does not cost an extra round trip.
 */
export function useCompanyName(): string {
  const tenantName = useAuthStore(s => s.tenant?.name);

  const { data } = useQuery({
    queryKey: ["app-settings", "company"],
    queryFn: () => appSettingsApi.getCategory("company"),
    staleTime: 5 * 60 * 1000,
    // A workspace that has never opened Settings → General has no row yet; the tenant name is a
    // perfectly good answer, so a failure here must not surface as an error.
    retry: false,
  });

  return (
    data?.legalName?.trim() ||
    data?.name?.trim() ||
    tenantName?.trim() ||
    ""
  );
}
