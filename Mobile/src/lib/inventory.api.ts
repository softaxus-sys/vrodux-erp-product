import { apiClient, type PagedResult } from "@/lib/api-client";
import type { ProductDto, ProductLookupDto, ProductsPageParams, ProductStockSummaryDto, ProductSummaryDto, WarehouseDto } from "@/types/inventory";

const BASE = "/api/inventory";

export const INVENTORY_STOCK_VIEW = "inventory.stock.view";
export const INVENTORY_WAREHOUSES_VIEW = "inventory.warehouses.view";

function buildProductsQuery(p: ProductsPageParams): string {
  const qs = new URLSearchParams();
  qs.set("page", String(p.page ?? 1));
  qs.set("pageSize", String(p.pageSize ?? 25));
  if (p.search?.trim()) qs.set("search", p.search.trim());
  if (p.isLowStock) qs.set("isLowStock", "true");
  return qs.toString();
}

export const inventoryApi = {
  getProducts: (params: ProductsPageParams = {}): Promise<PagedResult<ProductSummaryDto>> =>
    apiClient.get(`${BASE}/products?${buildProductsQuery(params)}`),

  getProduct: (id: string): Promise<ProductDto> => apiClient.get(`${BASE}/products/${id}`),

  getProductByBarcode: (barcode: string): Promise<ProductDto> =>
    apiClient.get(`${BASE}/products/barcode/${encodeURIComponent(barcode)}`),

  /** The server cleans the scan (QR links, GS1 strings, UPC/EAN spellings), finds the product in stock, and otherwise
   *  suggests details from public product databases. An unknown code is a normal answer, not an error. */
  lookupCode: (code: string): Promise<ProductLookupDto> =>
    apiClient.get(`${BASE}/products/lookup?code=${encodeURIComponent(code)}`),

  getProductStock: (productId: string): Promise<ProductStockSummaryDto> =>
    apiClient.get(`${BASE}/product-stock/${productId}`),

  getWarehouses: (): Promise<WarehouseDto[]> => apiClient.get(`${BASE}/warehouses`),
};
