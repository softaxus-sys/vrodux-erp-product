import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productsApi, type GetProductsParams } from "@/lib/pos/products.api";
import { inventoryProductsApi } from "@/lib/inventory/products.api";
import type { ProductDto, ProductSummaryDto } from "@/lib/pos/types";
import type { ProductSummaryDto as InvProductSummaryDto } from "@/lib/inventory/types";
import type { PagedResult } from "@/lib/api-client";
import { toast } from "sonner";

/** Map Inventory ProductSummaryDto → POS ProductSummaryDto (superset → subset). */
function mapInvToPos(p: InvProductSummaryDto): ProductSummaryDto {
  return {
    id:            p.id,
    name:          p.name,
    sku:           p.sku,
    barcode:       p.barcode,
    categoryName:  p.categoryName,
    salePrice:     p.salePrice,
    taxRate:       p.taxRate,
    stockQuantity: p.stockQuantity,
    unit:          p.unit,
    isActive:      p.isActive,
    isLowStock:    p.isLowStock,
    reorderLevel:  p.reorderLevel,
    costPrice:     p.costPrice,
  };
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const productKeys = {
  all:      ["pos-products"] as const,
  lists:    () => [...productKeys.all, "list"] as const,
  list:     (params: GetProductsParams) => [...productKeys.lists(), params] as const,
  details:  () => [...productKeys.all, "detail"] as const,
  detail:   (id: string) => [...productKeys.details(), id] as const,
  barcode:  (code: string) => [...productKeys.all, "barcode", code] as const,
};

// ── Queries ───────────────────────────────────────────────────────────────────

export function useProducts(params: GetProductsParams = {}) {
  return useQuery<PagedResult<ProductSummaryDto>>({
    queryKey: productKeys.list(params),
    queryFn:  () => productsApi.getAll(params),
  });
}

/**
 * Fetch ALL active products for the POS product grid.
 * Uses the Inventory API which UNIONs both inventory.products and pos.products,
 * so items created in either module appear here automatically.
 */
export function useAllPOSProducts() {
  return useQuery<PagedResult<ProductSummaryDto>>({
    queryKey: productKeys.list({ isActive: true, pageSize: 500 }),
    queryFn:  async () => {
      const result = await inventoryProductsApi.getAll({ isActive: true, pageSize: 500 });
      return { ...result, items: result.items.map(mapInvToPos) };
    },
    staleTime: 60_000,
  });
}

const PAGE_SIZE = 24;

/**
 * Infinite-scroll paginated products for the POS product grid.
 * Fetches 24 items per page. Automatically resets when search or categoryId change.
 */
export function usePaginatedPOSProducts(params: {
  search?:     string;
  categoryId?: string;
}) {
  return useInfiniteQuery({
    queryKey: [...productKeys.all, "paginated", params] as const,
    queryFn: async ({ pageParam }) => {
      const result = await inventoryProductsApi.getAll({
        page:       pageParam as number,
        pageSize:   PAGE_SIZE,
        search:     params.search     || undefined,
        categoryId: params.categoryId || undefined,
        isActive:   true,
      });
      return { ...result, items: result.items.map(mapInvToPos) };
    },
    initialPageParam: 1,
    getNextPageParam: (last) => last.hasNext ? (last.page + 1) : undefined,
    staleTime: 0,
  });
}

export function useProduct(id: string) {
  return useQuery<ProductDto>({
    queryKey: productKeys.detail(id),
    queryFn:  () => productsApi.getById(id),
    enabled:  !!id,
  });
}

/**
 * Look up a product by barcode at the POS terminal.
 * Uses the Inventory barcode endpoint which searches both schemas.
 */
export function useProductByBarcode(barcode: string) {
  return useQuery<ProductDto>({
    queryKey: productKeys.barcode(barcode),
    queryFn:  () => inventoryProductsApi.getByBarcode(barcode) as Promise<ProductDto>,
    enabled:  !!barcode,
    retry:    false,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCreatePOSProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof productsApi.create>[0]) =>
      productsApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.lists() });
      toast.success("Product added to catalogue.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAdjustStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      quantity,
      adjustmentType,
      notes,
    }: {
      id: string;
      quantity: number;
      adjustmentType: string;
      notes?: string;
    }) => productsApi.adjustStock(id, quantity, adjustmentType, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.all });
      toast.success("Stock adjusted.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => productsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.lists() });
      toast.success("Product deleted.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
