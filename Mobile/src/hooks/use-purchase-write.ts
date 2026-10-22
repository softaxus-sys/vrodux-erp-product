import { useMutation, useQueryClient } from "@tanstack/react-query";
import { purchaseWriteApi, type VendorInput } from "@/lib/purchase-write.api";

export function useCreatePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: purchaseWriteApi.createOrder, onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase"] }) });
}

export function useCreateVendor() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: purchaseWriteApi.createVendor, onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase"] }) });
}

export function useUpdateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<VendorInput> }) => purchaseWriteApi.updateVendor(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase"] }),
  });
}
