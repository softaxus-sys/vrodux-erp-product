import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { PagedResult } from "@/lib/api-client";
import {
  listingsApi, type Listing, type ListingContent, type ListingParams, type ListingSummary,
  type NewListingPhoto, type ProductOption, type PublishCheck, type VariantInput,
} from "@/lib/inventory/listings.api";
import { inventoryProductKeys } from "./use-inventory-products";

export const listingKeys = {
  all:    ["inventory-listings"] as const,
  lists:  () => [...listingKeys.all, "list"] as const,
  list:   (p: ListingParams) => [...listingKeys.lists(), p] as const,
  detail: (id: string) => [...listingKeys.all, "detail", id] as const,
  check:  (id: string) => [...listingKeys.all, "check", id] as const,
};

export function useListings(params: ListingParams = {}) {
  return useQuery<PagedResult<ListingSummary>>({
    queryKey: listingKeys.list(params),
    queryFn: () => listingsApi.getAll(params),
    placeholderData: prev => prev,
  });
}

export function useListing(id: string | null | undefined) {
  return useQuery<Listing>({
    queryKey: listingKeys.detail(id ?? ""),
    queryFn: () => listingsApi.getById(id!),
    enabled: !!id,
  });
}

export function usePublishCheck(id: string | null | undefined) {
  return useQuery<PublishCheck>({
    queryKey: listingKeys.check(id ?? ""),
    queryFn: () => listingsApi.publishCheck(id!),
    enabled: !!id,
  });
}

/**
 * A listing change usually also changes products (new variants, stock, a variant's online switch), so
 * product lists refresh too — otherwise Stock Items would keep showing the old picture.
 */
function useListingMutation<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
  opts: { success?: string; touchesProducts?: boolean } = {},
) {
  const qc = useQueryClient();
  return useMutation<TResult, Error, TArgs>({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: listingKeys.all });
      if (opts.touchesProducts) qc.invalidateQueries({ queryKey: inventoryProductKeys.all });
      if (opts.success) toast.success(opts.success);
    },
    onError: (e) => toast.error(e.message),
  });
}

export const useCreateListing = () =>
  useListingMutation((b: { content: ListingContent; options: ProductOption[]; variants: VariantInput[] }) =>
    listingsApi.create(b), { success: "Listing created.", touchesProducts: true });

export const useUpdateListing = () =>
  useListingMutation((a: {
    id: string; content: ListingContent; options: ProductOption[];
    variantChoices?: { productId: string; options: Record<string, string> }[];
  }) => listingsApi.update(a.id, { content: a.content, options: a.options, variantChoices: a.variantChoices }),
    { success: "Listing saved.", touchesProducts: true });

export const useSetListingPublished = () =>
  useListingMutation((a: { id: string; published: boolean }) => listingsApi.setPublished(a.id, a.published));

export const useDeleteListing = () =>
  useListingMutation((id: string) => listingsApi.remove(id), { success: "Listing deleted.", touchesProducts: true });

export const useAddListingVariants = () =>
  useListingMutation((a: { id: string; variants: VariantInput[] }) => listingsApi.addVariants(a.id, a.variants),
    { success: "Variants added.", touchesProducts: true });

export const useUpdateListingVariant = () =>
  useListingMutation((a: { id: string; productId: string; options: Record<string, string>; sellOnline: boolean;
    weightGrams?: number | null; lengthCm?: number | null; widthCm?: number | null; heightCm?: number | null }) =>
    listingsApi.updateVariant(a.id, a.productId, a), { touchesProducts: true });

export const useRemoveListingVariant = () =>
  useListingMutation((a: { id: string; productId: string }) => listingsApi.removeVariant(a.id, a.productId),
    { success: "Variant removed from the listing.", touchesProducts: true });

export const useAddListingPhotos = () =>
  useListingMutation((a: { id: string; images: NewListingPhoto[] }) => listingsApi.addImages(a.id, a.images));

export const useDeleteListingPhoto = () =>
  useListingMutation((a: { id: string; imageId: string }) => listingsApi.deleteImage(a.id, a.imageId));

export const useSetPrimaryListingPhoto = () =>
  useListingMutation((a: { id: string; imageId: string }) => listingsApi.setPrimaryImage(a.id, a.imageId));

export const useUpdateListingPhoto = () =>
  useListingMutation((a: { id: string; imageId: string; altText: string | null; productId: string | null }) =>
    listingsApi.updateImage(a.id, a.imageId, { altText: a.altText, productId: a.productId }));

export const useReorderListingPhotos = () =>
  useListingMutation((a: { id: string; orderedIds: string[] }) => listingsApi.reorderImages(a.id, a.orderedIds));
