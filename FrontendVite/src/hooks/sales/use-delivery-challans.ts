import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  deliveryChallansApi,
  type GetDeliveryChallansParams,
  type CreateDeliveryChallanRequest,
  type DeliveryChallanDto,
  type DeliveryChallanSummaryDto,
} from "@/lib/sales/delivery-challans.api";
import { salesOrderKeys } from "@/hooks/sales/use-sales-orders";
import { toast } from "sonner";

export const deliveryChallanKeys = {
  all:     ["delivery-challans"] as const,
  lists:   () => [...deliveryChallanKeys.all, "list"] as const,
  list:    (params: GetDeliveryChallansParams) => [...deliveryChallanKeys.lists(), params] as const,
  details: () => [...deliveryChallanKeys.all, "detail"] as const,
  detail:  (id: string) => [...deliveryChallanKeys.details(), id] as const,
};

export function useDeliveryChallans(params: GetDeliveryChallansParams = {}) {
  return useQuery<DeliveryChallanSummaryDto[]>({
    queryKey: deliveryChallanKeys.list(params),
    queryFn:  () => deliveryChallansApi.getAll(params),
  });
}

export function useDeliveryChallan(id: string | null) {
  return useQuery<DeliveryChallanDto>({
    queryKey: deliveryChallanKeys.detail(id ?? ""),
    queryFn:  () => deliveryChallansApi.getById(id!),
    enabled:  !!id,
  });
}

export function useCreateDeliveryChallan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDeliveryChallanRequest) => deliveryChallansApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: deliveryChallanKeys.lists() });
      qc.invalidateQueries({ queryKey: salesOrderKeys.lists() });
      toast.success("Delivery challan created.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
