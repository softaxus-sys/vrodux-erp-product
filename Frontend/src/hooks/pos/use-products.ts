import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productsApi, type GetProductsParams } from "@/lib/pos/products.api";
import type { ProductDto, ProductSummaryDto } from "@/lib/pos/types";
import type { PagedResult } from "@/lib/api-client";
import { toast } from "sonner";

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

/** Fetch ALL active products (for POS product grid — loads up to 500). */
export function useAllPOSProducts() {
  return useQuery<PagedResult<ProductSummaryDto>>({
    queryKey: productKeys.list({ isActive: true, pageSize: 500 }),
    queryFn:  () => productsApi.getAll({ isActive: true, pageSize: 500 }),
    staleTime: 60_000, // 1 minute — products don't change that often during a session
  });
}

export function useProduct(id: string) {
  return useQuery<ProductDto>({
    queryKey: productKeys.detail(id),
    queryFn:  () => productsApi.getById(id),
    enabled:  !!id,
  });
}

export function useProductByBarcode(barcode: string) {
  return useQuery<ProductDto>({
    queryKey: productKeys.barcode(barcode),
    queryFn:  () => productsApi.getByBarcode(barcode),
    enabled:  !!barcode,
    retry:    false, // don't retry on 404 (not found)
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

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
