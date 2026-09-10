import { useQuery } from "@tanstack/react-query";
import { inventoryApi } from "@/lib/inventory.api";
import type { ProductsPageParams } from "@/types/inventory";

const QK = "inventory" as const;

export function useProductsPaged(params: ProductsPageParams) {
  return useQuery({
    queryKey: [QK, "products", "paged", params],
    queryFn: () => inventoryApi.getProducts(params),
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: [QK, "product", id],
    queryFn: () => inventoryApi.getProduct(id),
    enabled: Boolean(id),
  });
}

export function useProductStock(id: string) {
  return useQuery({
    queryKey: [QK, "product-stock", id],
    queryFn: () => inventoryApi.getProductStock(id),
    enabled: Boolean(id),
  });
}

export function useWarehouses(enabled: boolean) {
  return useQuery({
    queryKey: [QK, "warehouses"],
    queryFn: inventoryApi.getWarehouses,
    enabled,
  });
}
