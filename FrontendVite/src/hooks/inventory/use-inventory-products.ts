import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { inventoryProductsApi, type GetProductsParams } from "@/lib/inventory/products.api";
import type { ProductDto, ProductSummaryDto } from "@/lib/inventory/types";
import type { PagedResult } from "@/lib/api-client";
import { toast } from "sonner";

// ── Query keys ────────────────────────────────────────────────────────────────

export const inventoryProductKeys = {
  all:     ["inventory-products"] as const,
  lists:   () => [...inventoryProductKeys.all, "list"] as const,
  list:    (params: GetProductsParams) => [...inventoryProductKeys.lists(), params] as const,
  details: () => [...inventoryProductKeys.all, "detail"] as const,
  detail:  (id: string) => [...inventoryProductKeys.details(), id] as const,
};

// ── Queries ───────────────────────────────────────────────────────────────────

export function useInventoryProducts(params: GetProductsParams = {}) {
  return useQuery<PagedResult<ProductSummaryDto>>({
    queryKey: inventoryProductKeys.list(params),
    queryFn:  () => inventoryProductsApi.getAll(params),
  });
}

export function useInventoryProduct(id: string) {
  return useQuery<ProductDto>({
    queryKey: inventoryProductKeys.detail(id),
    queryFn:  () => inventoryProductsApi.getById(id),
    enabled:  !!id,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useDeleteInventoryProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => inventoryProductsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryProductKeys.lists() });
      toast.success("Product deleted.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useActivateInventoryProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => inventoryProductsApi.activate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryProductKeys.lists() });
      toast.success("Product activated.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeactivateInventoryProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => inventoryProductsApi.deactivate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryProductKeys.lists() });
      toast.success("Product deactivated.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
