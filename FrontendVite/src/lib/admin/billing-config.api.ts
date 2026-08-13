import { apiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/admin/billing-config`;

/**
 * Platform billing configuration — Vrodux's OWN Stripe/PayPal accounts, used to charge tenants.
 * Not to be confused with the per-tenant POS payment-gateway settings.
 *
 * Secrets (Stripe secret key, PayPal client secret, webhook signing secrets) are NOT part of this
 * API in either direction. They come from environment variables on the server; the API only
 * reports whether each one is present so the screen can say which half is missing.
 */

/** Tiers that can be self-purchased. Enterprise is sales-led and has no price id. */
export const BILLABLE_PLANS = ["Micro", "Starter", "Professional"] as const;
export type BillablePlan = (typeof BILLABLE_PLANS)[number];

export const BILLING_CADENCES = ["Monthly", "Annual"] as const;
export type BillingCadence = (typeof BILLING_CADENCES)[number];

/** Backend keys its price/plan maps as "Micro:Monthly". Keep the two in lockstep. */
export const idKey = (plan: BillablePlan, cadence: BillingCadence) => `${plan}:${cadence}`;

export interface BillingProviderConfigDto {
  enabled: boolean;
  /** Whether the provider's secret exists in the server environment. Read-only. */
  hasSecret: boolean;
  /** PayPal only — Stripe's test/live split is decided by which key is configured. */
  useSandbox: boolean | null;
  /** Price / plan ids keyed "Micro:Monthly". */
  ids: Record<string, string>;
  /** Enabled AND has its secret AND has at least one id — i.e. checkout would actually work. */
  isUsable: boolean;
}

export interface BillingConfigDto {
  currency: string;
  /** Origin the providers redirect back to. Env-only, shown read-only. */
  publicBaseUrl: string;
  stripe: BillingProviderConfigDto;
  payPal: BillingProviderConfigDto;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface UpdateBillingConfigRequest {
  currency: string | null;
  stripeEnabled: boolean;
  stripePrices: Record<string, string>;
  payPalEnabled: boolean;
  payPalUseSandbox: boolean;
  payPalPlans: Record<string, string>;
}

export const billingConfigApi = {
  get: (): Promise<BillingConfigDto> => apiClient.get(BASE),
  update: (req: UpdateBillingConfigRequest): Promise<BillingConfigDto> => apiClient.put(BASE, req),
};
