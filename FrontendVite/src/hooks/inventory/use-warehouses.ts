import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { warehousesApi, type UpsertWarehouseRequest } from "@/lib/inventory/warehouses.api";

const QK = "inventory-warehouses";

export function useWarehouses() {
  return useQuery({
    queryKey: [QK],
    queryFn:  warehousesApi.getAll,
  });
}

export function useCreateWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertWarehouseRequest) => warehousesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
      toast.success("Warehouse created.");
    },
    onError: () => toast.error("Failed to create warehouse."),
  });
}

export function useUpdateWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpsertWarehouseRequest }) =>
      warehousesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
      toast.success("Warehouse updated.");
    },
    onError: () => toast.error("Failed to update warehouse."),
  });
}

export function useSetDefaultWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => warehousesApi.setDefault(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
      toast.success("Default warehouse updated.");
    },
    onError: () => toast.error("Failed to set default warehouse."),
  });
}

export function useDeleteWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => warehousesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
      toast.success("Warehouse deleted.");
    },
    onError: () => toast.error("Failed to delete warehouse."),
  });
}
