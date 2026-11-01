import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { productImportApi } from "@/lib/inventory/product-import.api";
import { inventoryProductKeys } from "./use-inventory-products";
import { listingKeys } from "./use-listings";
import { productPhotoKeys } from "./use-product-photos";

const KEY = ["inventory-product-import", "photos"] as const;

/** Pictures an import file pointed at are downloaded in the background; this follows how that is going. */
export function useImportPhotoStatus(enabled = true) {
  return useQuery({
    queryKey: KEY,
    queryFn: () => productImportApi.photoStatus(),
    enabled,
    // Quick while something is downloading, otherwise a slow check that costs nothing.
    refetchInterval: q => ((q.state.data?.pending ?? 0) > 0 ? 4000 : 30000),
  });
}

export function useRetryFailedImportPhotos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => productImportApi.retryFailed(),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Refreshes everything a finished picture changes: the photo lists and the listings that show them. */
export function useRefreshAfterImport() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: inventoryProductKeys.lists() });
    qc.invalidateQueries({ queryKey: listingKeys.all });
    qc.invalidateQueries({ queryKey: productPhotoKeys.all });
    qc.invalidateQueries({ queryKey: KEY });
  };
}
