import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { billingApi, type PaymentProviderName } from "@/lib/billing/billing.api";

const QK = "billing";

export function useBillingOverview(enabled = true) {
  return useQuery({
    queryKey: [QK, "overview"],
    queryFn: billingApi.getOverview,
    enabled,
    // Kept short: the tenant's status can flip the moment a payment webhook lands, and a stale
    // "expired" banner in front of a customer who has just paid is the worst possible moment to be wrong.
    staleTime: 15_000,
  });
}

export function useBillingInvoices(enabled = true) {
  return useQuery({
    queryKey: [QK, "invoices"],
    queryFn: billingApi.getInvoices,
    enabled,
    staleTime: 60_000,
  });
}

/**
 * Start checkout and hand off to the provider.
 * Navigates the current tab (not a popup) — popup blockers routinely eat payment windows.
 */
export function useStartCheckout() {
  return useMutation({
    mutationFn: ({ plan, billingPeriod, provider }: {
      plan: string;
      billingPeriod: "Monthly" | "Annual";
      provider: PaymentProviderName;
    }) => billingApi.checkout(plan, billingPeriod, provider),
    onSuccess: (session) => { window.location.href = session.redirectUrl; },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useBillingPortal() {
  return useMutation({
    mutationFn: () => billingApi.portal(),
    onSuccess: (session) => { window.location.href = session.redirectUrl; },
    onError: (e: Error) => toast.error(e.message),
  });
}

/**
 * Claim the 30-day trial from the billing page — the escape hatch for a "Buy Now" signup that
 * didn't go through with payment. A hard reload afterwards, because access is granted by the
 * JWT's subscription_state claim: without a fresh token the app would still consider the tenant
 * blocked and bounce them straight back here.
 */
export function useStartTrial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => billingApi.startTrial(),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: [QK] });
      toast.success("Your 30-day free trial has started.");
      window.location.href = "/dashboard";
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCancelSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (immediate: boolean) => billingApi.cancel(immediate),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
      toast.success("Subscription cancelled.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
