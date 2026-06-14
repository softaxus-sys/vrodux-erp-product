import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  purchaseReturnsApi,
  type GetPurchaseReturnsParams,
  type CreatePurchaseReturnRequest,
  type PurchaseReturnDto,
  type PurchaseReturnSummaryDto,
} from "@/lib/purchase/returns.api";
import { toast } from "sonner";

export const purchaseReturnKeys = {
  all:     ["purchase-returns"] as const,
  lists:   () => [...purchaseReturnKeys.all, "list"] as const,
  list:    (params: GetPurchaseReturnsParams) => [...purchaseReturnKeys.lists(), params] as const,
  details: () => [...purchaseReturnKeys.all, "detail"] as const,
  detail:  (id: string) => [...purchaseReturnKeys.details(), id] as const,
};

export function usePurchaseReturns(params: GetPurchaseReturnsParams = {}) {
  return useQuery<PurchaseReturnSummaryDto[]>({
    queryKey: purchaseReturnKeys.list(params),
    queryFn:  () => purchaseReturnsApi.getAll(params),
  });
}

export function usePurchaseReturn(id: string | null) {
  return useQuery<PurchaseReturnDto>({
    queryKey: purchaseReturnKeys.detail(id ?? ""),
    queryFn:  () => purchaseReturnsApi.getById(id!),
    enabled:  !!id,
  });
}

export function useCreatePurchaseReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePurchaseReturnRequest) => purchaseReturnsApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: purchaseReturnKeys.lists() });
      toast.success("Purchase return recorded.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
