import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { warehousesApi, type CreateWarehouseRequest } from "@/lib/inventory/warehouses.api";

export const warehouseKeys = {
  all:     ["inventory-warehouses"] as const,
  list:    () => [...warehouseKeys.all, "list"] as const,
  detail:  (id: string) => [...warehouseKeys.all, "detail", id] as const,
  summary: () => [...warehouseKeys.all, "summary"] as const,
};

export function useWarehouses() {
  return useQuery({
    queryKey: warehouseKeys.list(),
    queryFn:  () => warehousesApi.getAll(),
  });
}

export function useWarehouse(id: string) {
  return useQuery({
    queryKey: warehouseKeys.detail(id),
    queryFn:  () => warehousesApi.getById(id),
    enabled:  !!id,
  });
}

export function useWarehouseSummary() {
  return useQuery({
    queryKey: warehouseKeys.summary(),
    queryFn:  () => warehousesApi.getSummary(),
  });
}

export function useCreateWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateWarehouseRequest) => warehousesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: warehouseKeys.all });
    },
  });
}
