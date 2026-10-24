import { findCountry } from "@/lib/onboarding/geo-data";
import { useAuthStore } from "@/store/auth.store";

export interface TaxAuthority {
  code: string;
  /** Short name people use, e.g. "FBR". */
  short: string;
  name: string;
  /** True only where this product actually reports invoices to the authority. */
  connected: boolean;
}

const AUTHORITIES: Record<string, Omit<TaxAuthority, "code">> = {
  PK: { short: "FBR",   name: "Federal Board of Revenue",         connected: true },
  AE: { short: "FTA",   name: "Federal Tax Authority",            connected: false },
  SA: { short: "ZATCA", name: "Zakat, Tax and Customs Authority", connected: false },
  BH: { short: "NBR",   name: "National Bureau for Revenue",      connected: false },
  OM: { short: "OTA",   name: "Oman Tax Authority",               connected: false },
  QA: { short: "GTA",   name: "General Tax Authority",            connected: false },
  KW: { short: "MOF",   name: "Ministry of Finance",              connected: false },
  EG: { short: "ETA",   name: "Egyptian Tax Authority",           connected: false },
  IN: { short: "GSTN",  name: "Goods and Services Tax Network",   connected: false },
  BD: { short: "NBR",   name: "National Board of Revenue",        connected: false },
  GB: { short: "HMRC",  name: "HM Revenue & Customs",             connected: false },
  TR: { short: "GIB",   name: "Revenue Administration",           connected: false },
  MY: { short: "LHDN",  name: "Inland Revenue Board",             connected: false },
  US: { short: "IRS",   name: "Internal Revenue Service",         connected: false },
};

/** ISO code for a country name or code, upper-cased; "" when unknown. */
export function countryCodeOf(country?: string | null): string {
  if (!country) return "";
  return (findCountry(country)?.code ?? country).trim().toUpperCase();
}

export function taxAuthorityFor(country?: string | null): TaxAuthority | null {
  const code = countryCodeOf(country);
  const a = AUTHORITIES[code];
  return a ? { code, ...a } : null;
}

/** The signed-in workspace's own country, from its signup country. */
export function useTenantCountryCode(): string {
  return countryCodeOf(useAuthStore(s => s.tenant?.country));
}
