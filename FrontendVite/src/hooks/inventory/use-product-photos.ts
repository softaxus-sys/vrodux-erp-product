import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { productPhotosApi } from "@/lib/inventory/product-photos.api";
import type { NewListingPhoto } from "@/lib/inventory/listings.api";
import { listingKeys } from "./use-listings";

export const productPhotoKeys = {
  all:  ["inventory-product-photos"] as const,
  list: (productId: string) => [...productPhotoKeys.all, productId] as const,
};

export function useProductPhotos(productId: string | null | undefined) {
  return useQuery({
    queryKey: productPhotoKeys.list(productId ?? ""),
    queryFn: () => productPhotosApi.list(productId!),
    enabled: !!productId,
  });
}

/** A photo change also changes what the item's online listing shows, so listings refresh too. */
function usePhotoMutation<TArgs>(fn: (a: TArgs) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation<unknown, Error, TArgs>({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productPhotoKeys.all });
      qc.invalidateQueries({ queryKey: listingKeys.all });
    },
    onError: e => toast.error(e.message),
  });
}

export const useAddProductPhotos = () =>
  usePhotoMutation((a: { productId: string; images: NewListingPhoto[] }) => productPhotosApi.add(a.productId, a.images));

export const useDeleteProductPhoto = () =>
  usePhotoMutation((a: { productId: string; imageId: string }) => productPhotosApi.remove(a.productId, a.imageId));

export const useSetPrimaryProductPhoto = () =>
  usePhotoMutation((a: { productId: string; imageId: string }) => productPhotosApi.setPrimary(a.productId, a.imageId));
