import { apiClient, ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth.store";
import { getApiBaseUrl } from "@/lib/desktop";
import type { ListingImage, NewListingPhoto } from "@/lib/inventory/listings.api";

const base = (productId: string) => `${getApiBaseUrl()}/api/inventory/products/${productId}/photos`;

/** Photos of a stock item. An online listing shows the photos of the items inside it. */
export const productPhotosApi = {
  list: (productId: string): Promise<ListingImage[]> => apiClient.get<ListingImage[]>(base(productId)),
  add: (productId: string, images: NewListingPhoto[]): Promise<ListingImage[]> =>
    apiClient.post<ListingImage[]>(base(productId), { images }),
  remove: (productId: string, imageId: string): Promise<void> => apiClient.delete<void>(`${base(productId)}/${imageId}`),
  setPrimary: (productId: string, imageId: string): Promise<void> =>
    apiClient.patch<void>(`${base(productId)}/${imageId}/primary`, {}),
  /** The bytes sit behind the bearer token, so they are fetched once into an object URL. */
  objectUrl: async (productId: string, imageId: string): Promise<string> => {
    const token = useAuthStore.getState().token;
    const res = await fetch(`${base(productId)}/${imageId}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    if (!res.ok) throw new ApiError(res.status, null, `HTTP ${res.status}`);
    return URL.createObjectURL(await res.blob());
  },
};
