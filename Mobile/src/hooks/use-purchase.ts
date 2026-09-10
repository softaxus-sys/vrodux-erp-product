import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { purchaseApi } from "@/lib/purchase.api";
import type { PurchaseOrdersPageParams, VendorsPageParams } from "@/types/purchase";

const QK = "purchase" as const;

export function usePurchaseOrdersPaged(params: PurchaseOrdersPageParams) {
  return useQuery({
    queryKey: [QK, "orders", "paged", params],
    queryFn: () => purchaseApi.getOrders(params),
  });
}

export function usePurchaseOrder(id: string) {
  return useQuery({
    queryKey: [QK, "order", id],
    queryFn: () => purchaseApi.getOrder(id),
    enabled: Boolean(id),
  });
}

export function useSetPurchaseOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => purchaseApi.setOrderStatus(id, status),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: [QK, "order", id] });
      qc.invalidateQueries({ queryKey: [QK, "orders", "paged"] });
    },
  });
}

export function useVendorsPaged(params: VendorsPageParams) {
  return useQuery({
    queryKey: [QK, "vendors", "paged", params],
    queryFn: () => purchaseApi.getVendors(params),
  });
}

export function useVendor(id: string) {
  return useQuery({
    queryKey: [QK, "vendor", id],
    queryFn: () => purchaseApi.getVendor(id),
    enabled: Boolean(id),
  });
}
