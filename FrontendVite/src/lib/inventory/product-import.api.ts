import { apiClient } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/desktop";

const BASE = `${getApiBaseUrl()}/api/inventory/product-import`;

export interface ImportProductRow {
  name: string;
  sku?: string | null;
  barcode?: string | null;
  category?: string | null;
  brand?: string | null;
  unit?: string | null;
  costPrice: number;
  salePrice: number;
  taxRate: number;
  openingStock: number;
  reorderLevel: number;
  description?: string | null;
  imageUrls: string[];
  group?: string | null;
  options?: string | null;
}

export interface ImportProductsResult {
  created: number;
  existing: number;
  listed: number;
  photosQueued: number;
  failed: { index: number; reason: string }[];
  notes: string[];
}

export interface ImportPhotoStatus {
  pending: number;
  failedCount: number;
  doneLastDay: number;
  failures: { id: string; productId: string; productName: string; url: string; error: string | null }[];
}

export const productImportApi = {
  /** Max 500 rows a call; the dialog sends larger files in slices. */
  import: (rows: ImportProductRow[], listOnline: boolean): Promise<ImportProductsResult> =>
    apiClient.post<ImportProductsResult>(BASE, { rows, listOnline }),
  photoStatus: (): Promise<ImportPhotoStatus> => apiClient.get<ImportPhotoStatus>(`${BASE}/photos`),
  retryFailed: (): Promise<number> => apiClient.post<number>(`${BASE}/photos/retry-failed`, {}),
};
