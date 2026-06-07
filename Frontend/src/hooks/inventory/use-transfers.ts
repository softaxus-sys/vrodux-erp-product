import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { transfersApi, type CreateTransferRequest } from "@/lib/inventory/transfers.api";

export const transferKeys = {
  all:     ["inventory-transfers"] as const,
  list:    (params?: object) => [...transferKeys.all, "list", params ?? {}] as const,
  detail:  (id: string) => [...transferKeys.all, "detail", id] as const,
  summary: () => [...transferKeys.all, "summary"] as const,
};

export function useTransfers(params?: { page?: number; pageSize?: number; status?: string }) {
  return useQuery({
    queryKey: transferKeys.list(params),
    queryFn:  () => transfersApi.getAll(params),
  });
}

export function useTransfer(id: string) {
  return useQuery({
    queryKey: transferKeys.detail(id),
    queryFn:  () => transfersApi.getById(id),
    enabled:  !!id,
  });
}

export function useTransferSummary() {
  return useQuery({
    queryKey: transferKeys.summary(),
    queryFn:  () => transfersApi.getSummary(),
  });
}

export function useCreateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTransferRequest) => transfersApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: transferKeys.all });
    },
  });
}

export function useApproveTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => transfersApi.approve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: transferKeys.all });
    },
  });
}

export function useReceiveTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => transfersApi.receive(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: transferKeys.all });
    },
  });
}
