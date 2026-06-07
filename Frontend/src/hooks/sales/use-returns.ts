import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { returnsApi } from "@/lib/sales/returns.api";

export const returnKeys = {
  all:     ["sales-returns"] as const,
  list:    (params?: object) => [...returnKeys.all, "list", params ?? {}] as const,
  detail:  (id: string) => [...returnKeys.all, "detail", id] as const,
  summary: () => [...returnKeys.all, "summary"] as const,
};

export function useReturns(params?: { status?: string; reason?: string }) {
  return useQuery({
    queryKey: returnKeys.list(params),
    queryFn:  () => returnsApi.getAll(params),
  });
}

export function useReturn(id: string) {
  return useQuery({
    queryKey: returnKeys.detail(id),
    queryFn:  () => returnsApi.getById(id),
    enabled:  !!id,
  });
}

export function useReturnSummary() {
  return useQuery({
    queryKey: returnKeys.summary(),
    queryFn:  () => returnsApi.getSummary(),
  });
}

export function useApproveReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, refundMethod }: { id: string; refundMethod: string }) =>
      returnsApi.approve(id, refundMethod),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: returnKeys.all });
    },
  });
}

export function useRejectReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      returnsApi.reject(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: returnKeys.all });
    },
  });
}
