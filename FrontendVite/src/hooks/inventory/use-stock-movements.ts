import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { inventoryMovementsApi, type CreateMovementPayload } from "@/lib/inventory/stock-movements.api";
import { inventoryProductKeys } from "./use-inventory-products";

/**
 * Records a stock movement (receipt / write-off / adjustment / count correction)
 * and adjusts the product's on-hand quantity server-side. Invalidates product
 * lists + the movement ledger so the UI reflects the new stock immediately.
 */
export function useCreateStockMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateMovementPayload) => inventoryMovementsApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryProductKeys.lists() });
      qc.invalidateQueries({ queryKey: ["pos-stock-movements"] });
      qc.invalidateQueries({ queryKey: ["inventory-movements"] });
      qc.invalidateQueries({ queryKey: ["inventory-product-stock"] });
      qc.invalidateQueries({ queryKey: ["inventory-product-batches"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
