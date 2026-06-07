import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  purchaseOrdersApi,
  type GetPurchaseOrdersParams,
  type CreatePurchaseOrderRequest,
  type UpdatePurchaseOrderRequest,
} from "@/lib/purchase/orders.api";
import type { PurchaseOrderDto, PurchaseOrderSummaryDto } from "@/lib/pos/types";
import type { PagedResult } from "@/lib/api-client";
import { toast } from "sonner";

export const purchaseOrderKeys = {
  all:     ["purchase-orders"] as const,
  lists:   () => [...purchaseOrderKeys.all, "list"] as const,
  list:    (params: GetPurchaseOrdersParams) => [...purchaseOrderKeys.lists(), params] as const,
  details: () => [...purchaseOrderKeys.all, "detail"] as const,
  detail:  (id: string) => [...purchaseOrderKeys.details(), id] as const,
};

export function usePurchaseOrders(params: GetPurchaseOrdersParams = {}) {
  return useQuery<PagedResult<PurchaseOrderSummaryDto>>({
    queryKey: purchaseOrderKeys.list(params),
    queryFn:  () => purchaseOrdersApi.getAll(params),
  });
}

export function usePurchaseOrder(id: string | null) {
  return useQuery<PurchaseOrderDto>({
    queryKey: purchaseOrderKeys.detail(id ?? ""),
    queryFn:  () => purchaseOrdersApi.getById(id!),
    enabled:  !!id,
  });
}

export function useCreatePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePurchaseOrderRequest) => purchaseOrdersApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
      toast.success("Purchase order created.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdatePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & UpdatePurchaseOrderRequest) =>
      purchaseOrdersApi.update(id, payload),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
      qc.invalidateQueries({ queryKey: purchaseOrderKeys.detail(id) });
      toast.success("Purchase order updated.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdatePurchaseOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      purchaseOrdersApi.updateStatus(id, status),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
      qc.invalidateQueries({ queryKey: purchaseOrderKeys.detail(id) });
      toast.success("Status updated.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeletePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => purchaseOrdersApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
      toast.success("Purchase order deleted.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
