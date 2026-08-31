import { useQuery } from "@tanstack/react-query";
import { appSettingsApi } from "@/lib/identity/app-settings.api";
import { useAuthStore } from "@/store/auth.store";

/**
 * The letterhead a customer-facing document prints: who issued it, how to reach them, and the
 * sign-off. Read from Settings → General → Company, which is also where the quotation branding
 * comes from — so a quotation and an invoice from the same workspace look like the same company.
 */
export interface CompanyBranding {
  /** Legal name if set, else trading name, else the workspace name. Never a placeholder. */
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  /** Tax registration number — a UAE tax invoice is not valid without one. */
  taxNumber: string;
  registrationNo: string;
  logoUrl: string;
  signatureUrl: string;
  stampUrl: string;
}

/**
 * The name alone, for callers outside React (the print window is opened from a plain function).
 * There is deliberately no hardcoded fallback: the invoice print used to default to the literal
 * "Your Company", which is what every generated invoice actually said.
 */
export function getTenantName(): string {
  return useAuthStore.getState().tenant?.name?.trim() || "";
}

const EMPTY: CompanyBranding = {
  name: "", address: "", phone: "", email: "", website: "",
  taxNumber: "", registrationNo: "", logoUrl: "", signatureUrl: "", stampUrl: "",
};

/**
 * Reads the company block from app settings. Cached for 5 minutes and shared with any other
 * caller of the same key, so a document that needs it costs no extra round trip.
 */
export function useCompanyBranding(): CompanyBranding {
  const tenantName = useAuthStore(s => s.tenant?.name);

  const { data } = useQuery({
    queryKey: ["app-settings", "company"],
    queryFn: () => appSettingsApi.getCategory("company"),
    staleTime: 5 * 60 * 1000,
    // A workspace that has never opened Settings → General has no row yet; the tenant name is a
    // perfectly good answer, so a failure here must not surface as an error.
    retry: false,
  });

  const s = (key: string) => (data?.[key] ?? "").trim();

  return {
    ...EMPTY,
    name: s("legalName") || s("name") || (tenantName ?? "").trim(),
    address:        s("address"),
    phone:          s("phone"),
    email:          s("email"),
    website:        s("website"),
    taxNumber:      s("taxNumber"),
    registrationNo: s("registrationNo"),
    logoUrl:        s("logoUrl"),
    signatureUrl:   s("signatureUrl"),
    stampUrl:       s("stampUrl"),
  };
}

/** Convenience for callers that only need the name. */
export function useCompanyName(): string {
  return useCompanyBranding().name;
}
