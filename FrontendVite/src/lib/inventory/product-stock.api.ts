import { rawApiClient } from "@/lib/api-client";
import type { ProductStockBreakdown, ProductBatchDto } from "./types";

import { getApiBaseUrl } from "@/lib/desktop";
const BASE = `${getApiBaseUrl()}/api/inventory/product-stock`;

export const productStockApi = {
  getByProduct: (productId: string): Promise<ProductStockBreakdown> =>
    rawApiClient.get(`${BASE}/${productId}`),

  getBatches: (productId: string): Promise<ProductBatchDto[]> =>
    rawApiClient.get(`${BASE}/${productId}/batches`),
};
