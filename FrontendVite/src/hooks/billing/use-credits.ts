import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { creditsApi, creditPricingAdminApi, type UpdateCreditPricingRequest } from "@/lib/billing/credits.api";

const QK = "billing-credits";

export function useCreditCatalog() {
  return useQuery({ queryKey: [QK, "catalog"], queryFn: creditsApi.catalog, staleTime: 15_000 });
}

/** Priced on the server; only runs when the amount is a real number so typing does not spam the API. */
export function useCreditQuote(module: string | null, credits: number) {
  return useQuery({
    queryKey: [QK, "quote", module, credits],
    queryFn: () => creditsApi.quote(module!, credits),
    enabled: !!module && Number.isFinite(credits) && credits > 0,
    retry: false,
    staleTime: 60_000,
  });
}

export function useCreditPurchases() {
  return useQuery({ queryKey: [QK, "purchases"], queryFn: creditsApi.purchases, staleTime: 10_000 });
}

export function useCreditSwaps() {
  return useQuery({ queryKey: [QK, "swaps"], queryFn: creditsApi.swaps, staleTime: 10_000 });
}

export function useCreditSwapQuote(from: string | null, to: string | null, credits: number) {
  return useQuery({
    queryKey: [QK, "swap-quote", from, to, credits],
    queryFn: () => creditsApi.swapQuote(from!, to!, credits),
    enabled: !!from && !!to && from !== to && Number.isFinite(credits) && credits > 0,
    retry: false,
    staleTime: 60_000,
  });
}

export function useCreditCheckout() {
  return useMutation({
    mutationFn: (v: { module: string; credits: number; provider: string }) => creditsApi.checkout(v.module, v.credits, v.provider),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCapturePayPalCredits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => creditsApi.capturePayPal(orderId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useSwapCredits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { from: string; to: string; credits: number }) => creditsApi.swap(v.from, v.to, v.credits),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: [QK] });
      // Module screens show their own balances; refresh them too.
      qc.invalidateQueries({ queryKey: ["seo"] });
      qc.invalidateQueries({ queryKey: ["leadgen"] });
      toast.success(`Swapped: you now have ${r.toCredits.toLocaleString()} more credits.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreditPricingAdmin() {
  return useQuery({ queryKey: ["admin", "credit-pricing"], queryFn: creditPricingAdminApi.get });
}

export function useUpdateCreditPricing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: UpdateCreditPricingRequest) => creditPricingAdminApi.update(b),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "credit-pricing"] }); qc.invalidateQueries({ queryKey: [QK] }); toast.success("Credit pricing saved."); },
    onError: (e: Error) => toast.error(e.message),
  });
}
