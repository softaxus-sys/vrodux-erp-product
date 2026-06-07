import { useQuery } from "@tanstack/react-query";
import { productStockApi } from "@/lib/inventory/product-stock.api";

export function useProductStock(productId: string | null | undefined) {
  return useQuery({
    queryKey: ["inventory-product-stock", productId],
    queryFn:  () => productStockApi.getByProduct(productId!),
    enabled:  !!productId,
    staleTime: 30_000,
  });
}

export function useProductBatches(productId: string | null | undefined) {
  return useQuery({
    queryKey: ["inventory-product-batches", productId],
    queryFn:  () => productStockApi.getBatches(productId!),
    enabled:  !!productId,
    staleTime: 30_000,
  });
}
