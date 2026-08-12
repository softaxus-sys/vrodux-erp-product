import { apiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/billing`;

export type SubscriptionStatus =
  | "Trialing" | "Active" | "PastDue" | "Canceled" | "Expired" | "Incomplete";

export type PaymentProviderName = "Stripe" | "PayPal" | "Manual";

export interface SubscriptionDto {
  id: string;
  plan: string;
  billingPeriod: "Monthly" | "Annual";
  status: SubscriptionStatus;
  provider: PaymentProviderName;
  amount: number;
  currency: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  grantsAccess: boolean;
}

export interface PlanOptionDto {
  id: string;
  name: string;
  label: string;
  monthlyUsd: number | null;
  annualUsdPerMonth: number | null;
  annualUsdTotal: number | null;
  maxUsers: number;
  selfServe: boolean;
  isCurrent: boolean;
  modules: string[];
}

export interface BillingOverviewDto {
  tenantId: string;
  tenantName: string;
  plan: string;
  planLabel: string;
  tenantStatus: "Trial" | "Active" | "Suspended" | "Expired" | "PendingPayment" | string;
  trialEndsAt: string | null;
  trialDaysRemaining: number | null;
  hasProductAccess: boolean;
  /** True only for a "Buy Now" signup that never paid and has never had a trial. */
  canStartTrial: boolean;
  usersInUse: number;
  maxUsers: number;
  subscription: SubscriptionDto | null;
  plans: PlanOptionDto[];
  /** Providers with credentials configured server-side — only these should be offered. */
  availableProviders: PaymentProviderName[];
}

export interface BillingInvoiceDto {
  id: string;
  provider: PaymentProviderName;
  providerInvoiceId: string;
  amount: number;
  currency: string;
  status: "Open" | "Paid" | "Failed" | "Refunded" | "Void";
  periodStart: string | null;
  periodEnd: string | null;
  paidAt: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
  createdAt: string;
}

export interface CheckoutSessionDto {
  redirectUrl: string;
  provider: PaymentProviderName;
}

export const billingApi = {
  getOverview: (): Promise<BillingOverviewDto> => apiClient.get(`${BASE}/overview`),

  getInvoices: (): Promise<BillingInvoiceDto[]> => apiClient.get(`${BASE}/invoices`),

  /** Returns the provider URL the browser must be sent to. */
  checkout: (plan: string, billingPeriod: "Monthly" | "Annual", provider: PaymentProviderName): Promise<CheckoutSessionDto> =>
    apiClient.post(`${BASE}/checkout`, { plan, billingPeriod, provider }),

  /** Stripe-hosted billing portal (update card, change plan, cancel). */
  portal: (): Promise<CheckoutSessionDto> => apiClient.post(`${BASE}/portal`, {}),

  /** Claim the 30-day trial — only valid for a "Buy Now" signup that never paid. */
  startTrial: (): Promise<void> => apiClient.post(`${BASE}/start-trial`, {}),

  /** Defaults to end-of-period so the customer keeps what they already paid for. */
  cancel: (immediate = false): Promise<void> => apiClient.post(`${BASE}/cancel`, { immediate }),
};
