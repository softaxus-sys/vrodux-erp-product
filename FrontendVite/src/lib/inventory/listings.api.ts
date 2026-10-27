import { apiClient, ApiError, type PagedResult } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth.store";
import { getApiBaseUrl } from "@/lib/desktop";

const BASE = `${getApiBaseUrl()}/api/inventory/product-templates`;

// ── Types (mirror Inventory.Application.ProductTemplates) ─────────────────────

export interface ProductOption { name: string; values: string[] }

export interface ListingImage {
  id: string;
  /** Set when the photo belongs to one variant; null = shown for all of them. */
  productId: string | null;
  isPrimary: boolean;
  sortOrder: number;
  fileName: string | null;
  altText: string | null;
}

export interface ListingVariant {
  productId: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  options: Record<string, string>;
  salePrice: number;
  costPrice: number;
  taxRate: number;
  stockQuantity: number;
  trackInventory: boolean;
  isActive: boolean;
  sellOnline: boolean;
  weightGrams: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
}

export interface ListingSummary {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  categoryName: string;
  brandName: string | null;
  publishedOnline: boolean;
  isActive: boolean;
  variantCount: number;
  totalStock: number;
  priceFrom: number | null;
  priceTo: number | null;
  coverImageId: string | null;
  imageCount: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface Listing {
  id: string;
  name: string;
  description: string | null;
  shortDescription: string | null;
  categoryId: string;
  categoryName: string;
  brandId: string | null;
  brandName: string | null;
  slug: string;
  seoTitle: string | null;
  metaDescription: string | null;
  tags: string | null;
  options: ProductOption[];
  publishedOnline: boolean;
  publishedAt: string | null;
  isActive: boolean;
  variants: ListingVariant[];
  images: ListingImage[];
  createdAt: string;
  updatedAt: string | null;
}

export interface PublishCheck { ready: boolean; problems: string[] }

export interface ListingContent {
  name: string;
  description: string | null;
  shortDescription: string | null;
  categoryId: string;
  brandId: string | null;
  /** Blank keeps the current address (or generates one for a new listing). */
  slug: string | null;
  seoTitle: string | null;
  metaDescription: string | null;
  tags: string | null;
}

/** One variant to add: an existing product (left as it is) or the details of a new one. */
export interface VariantInput {
  existingProductId?: string | null;
  options: Record<string, string>;
  name?: string | null;
  sku?: string | null;
  barcode?: string | null;
  salePrice?: number;
  costPrice?: number;
  taxRate?: number;
  openingStock?: number;
  reorderLevel?: number;
  unit?: string | null;
  trackInventory?: boolean;
  sellOnline?: boolean;
  weightGrams?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
}

export interface ListingParams {
  page?: number;
  pageSize?: number;
  search?: string;
  categoryId?: string;
  published?: boolean;
}

export interface NewListingPhoto { data: string; fileName?: string; altText?: string | null; productId?: string | null }

// ── Authenticated photo bytes → object URL ────────────────────────────────────

async function fetchBlobUrl(url: string): Promise<string> {
  const token = useAuthStore.getState().token;
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  if (!res.ok) throw new ApiError(res.status, null, `HTTP ${res.status}`);
  return URL.createObjectURL(await res.blob());
}

export const listingsApi = {
  getAll: (p: ListingParams = {}): Promise<PagedResult<ListingSummary>> => {
    const qs = new URLSearchParams();
    if (p.page)        qs.set("page", String(p.page));
    if (p.pageSize)    qs.set("pageSize", String(p.pageSize));
    if (p.search)      qs.set("search", p.search);
    if (p.categoryId)  qs.set("categoryId", p.categoryId);
    if (p.published !== undefined) qs.set("published", String(p.published));
    return apiClient.get<PagedResult<ListingSummary>>(`${BASE}?${qs}`);
  },
  getById: (id: string): Promise<Listing> => apiClient.get<Listing>(`${BASE}/${id}`),
  publishCheck: (id: string): Promise<PublishCheck> => apiClient.get<PublishCheck>(`${BASE}/${id}/publish-check`),

  create: (body: { content: ListingContent; options: ProductOption[]; variants: VariantInput[] }): Promise<Listing> =>
    apiClient.post<Listing>(BASE, body),
  update: (id: string, body: {
    content: ListingContent; options: ProductOption[];
    /** New choices for variants whose choices change together with the options. */
    variantChoices?: { productId: string; options: Record<string, string> }[];
  }): Promise<Listing> =>
    apiClient.put<Listing>(`${BASE}/${id}`, body),
  setPublished: (id: string, published: boolean): Promise<Listing> =>
    apiClient.patch<Listing>(`${BASE}/${id}/published`, { published }),
  remove: (id: string): Promise<void> => apiClient.delete<void>(`${BASE}/${id}`),

  addVariants: (id: string, variants: VariantInput[]): Promise<Listing> =>
    apiClient.post<Listing>(`${BASE}/${id}/variants`, { variants }),
  updateVariant: (id: string, productId: string, body: {
    options: Record<string, string>; sellOnline: boolean;
    weightGrams?: number | null; lengthCm?: number | null; widthCm?: number | null; heightCm?: number | null;
  }): Promise<Listing> => apiClient.put<Listing>(`${BASE}/${id}/variants/${productId}`, body),
  removeVariant: (id: string, productId: string): Promise<Listing> =>
    apiClient.delete<Listing>(`${BASE}/${id}/variants/${productId}`),

  addImages: (id: string, images: NewListingPhoto[]): Promise<ListingImage[]> =>
    apiClient.post<ListingImage[]>(`${BASE}/${id}/images`, { images }),
  imageObjectUrl: (id: string, imageId: string): Promise<string> => fetchBlobUrl(`${BASE}/${id}/images/${imageId}`),
  updateImage: (id: string, imageId: string, body: { altText: string | null; productId: string | null }): Promise<void> =>
    apiClient.put<void>(`${BASE}/${id}/images/${imageId}`, body),
  setPrimaryImage: (id: string, imageId: string): Promise<void> =>
    apiClient.patch<void>(`${BASE}/${id}/images/${imageId}/primary`, {}),
  reorderImages: (id: string, orderedIds: string[]): Promise<void> =>
    apiClient.put<void>(`${BASE}/${id}/images/order`, { orderedIds }),
  deleteImage: (id: string, imageId: string): Promise<void> =>
    apiClient.delete<void>(`${BASE}/${id}/images/${imageId}`),
};
