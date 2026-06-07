import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  salesOrdersApi,
  type GetSalesOrdersParams,
  type CreateSalesOrderPayload,
  type UpdateSalesOrderPayload,
} from "@/lib/pos/sales-orders.api";
import type { SalesOrderDto, SalesOrderSummaryDto } from "@/lib/pos/types";
import type { PagedResult } from "@/lib/api-client";
import { toast } from "sonner";

export const salesOrderKeys = {
  all:     ["pos-sales-orders"] as const,
  lists:   () => [...salesOrderKeys.all, "list"] as const,
  list:    (params: GetSalesOrdersParams) => [...salesOrderKeys.lists(), params] as const,
  details: () => [...salesOrderKeys.all, "detail"] as const,
  detail:  (id: string) => [...salesOrderKeys.details(), id] as const,
};

export function useSalesOrders(params: GetSalesOrdersParams = {}) {
  return useQuery<PagedResult<SalesOrderSummaryDto>>({
    queryKey: salesOrderKeys.list(params),
    queryFn:  () => salesOrdersApi.getAll(params),
  });
}

export function useSalesOrder(id: string) {
  return useQuery<SalesOrderDto>({
    queryKey: salesOrderKeys.detail(id),
    queryFn:  () => salesOrdersApi.getById(id),
    enabled:  !!id,
  });
}

export function useCreateSalesOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSalesOrderPayload) => salesOrdersApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: salesOrderKeys.lists() });
      toast.success("Sales order created.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateSalesOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & UpdateSalesOrderPayload) =>
      salesOrdersApi.update(id, payload),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: salesOrderKeys.lists() });
      qc.invalidateQueries({ queryKey: salesOrderKeys.detail(id) });
      toast.success("Sales order updated.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteSalesOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => salesOrdersApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: salesOrderKeys.lists() });
      toast.success("Sales order deleted.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
