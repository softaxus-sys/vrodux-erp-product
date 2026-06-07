import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taxApi, type CreateTaxPeriodRequest } from "@/lib/finance/tax.api";
import { toast } from "sonner";

export const taxKeys = {
  all:          ["finance-tax"] as const,
  periods:      () => [...taxKeys.all, "periods"] as const,
  period:       (id: string) => [...taxKeys.periods(), id] as const,
  summary:      () => [...taxKeys.all, "summary"] as const,
  transactions: (periodId?: string) => [...taxKeys.all, "transactions", periodId ?? "all"] as const,
};

export function useTaxPeriods() {
  return useQuery({
    queryKey: taxKeys.periods(),
    queryFn:  () => taxApi.getPeriods(),
  });
}

export function useTaxPeriod(id: string) {
  return useQuery({
    queryKey: taxKeys.period(id),
    queryFn:  () => taxApi.getPeriodById(id),
    enabled:  !!id,
  });
}

export function useTaxSummary() {
  return useQuery({
    queryKey: taxKeys.summary(),
    queryFn:  () => taxApi.getSummary(),
  });
}

export function useTaxTransactions(periodId?: string) {
  return useQuery({
    queryKey: taxKeys.transactions(periodId),
    queryFn:  () => taxApi.getTransactions(periodId),
  });
}

export function useCreateTaxPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTaxPeriodRequest) => taxApi.createPeriod(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taxKeys.periods() });
      toast.success("Tax period created.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useFileTaxPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => taxApi.filePeriod(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taxKeys.periods() });
      qc.invalidateQueries({ queryKey: taxKeys.summary() });
      toast.success("Return filed.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function usePayTaxPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => taxApi.payPeriod(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taxKeys.periods() });
      qc.invalidateQueries({ queryKey: taxKeys.summary() });
      toast.success("Payment recorded.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
