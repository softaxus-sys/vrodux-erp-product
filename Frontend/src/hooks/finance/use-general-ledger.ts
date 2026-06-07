import { useQuery } from "@tanstack/react-query";
import { generalLedgerApi } from "@/lib/finance/general-ledger.api";

export const glKeys = {
  all:          ["finance-general-ledger"] as const,
  summary:      () => [...glKeys.all, "summary"] as const,
  trialBalance: (period?: string) => [...glKeys.all, "trial-balance", period ?? "current"] as const,
};

export function useGLSummary() {
  return useQuery({
    queryKey: glKeys.summary(),
    queryFn:  () => generalLedgerApi.getSummary(),
  });
}

export function useTrialBalance(period?: string) {
  return useQuery({
    queryKey: glKeys.trialBalance(period),
    queryFn:  () => generalLedgerApi.getTrialBalance(period),
  });
}
