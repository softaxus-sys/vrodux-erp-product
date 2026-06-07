import { rawApiClient } from "@/lib/api-client";
import type { ProductStockBreakdown, ProductBatchDto } from "./types";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/inventory/product-stock`;

export const productStockApi = {
  getByProduct: (productId: string): Promise<ProductStockBreakdown> =>
    rawApiClient.get(`${BASE}/${productId}`),

  getBatches: (productId: string): Promise<ProductBatchDto[]> =>
    rawApiClient.get(`${BASE}/${productId}/batches`),
};
