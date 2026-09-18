import { useQuery } from "@tanstack/react-query";
import { insuranceApi } from "@/lib/insurance.api";
import { usePagedVerticalList } from "@/hooks/use-vertical-list";

const QK = "insurance" as const;

export function useInsuranceSummary(enabled = true) {
  return useQuery({ queryKey: [QK, "summary"], queryFn: insuranceApi.getSummary, enabled });
}

export function usePoliciesList(enabled = true) {
  return usePagedVerticalList([QK, "policies"], insuranceApi.getPolicies, enabled);
}

export function useRenewalsList(enabled = true) {
  return usePagedVerticalList([QK, "renewals"], insuranceApi.getRenewals, enabled);
}

export function useClaimsList(enabled = true) {
  return usePagedVerticalList([QK, "claims"], insuranceApi.getClaims, enabled);
}
