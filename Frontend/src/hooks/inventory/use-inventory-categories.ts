import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { inventoryCategoriesApi } from "@/lib/inventory/categories.api";

// ── Query keys ─────────────────────────────────────────────────────────────────

export const inventoryCategoryKeys = {
  all:    ["inventory-categories"]                   as const,
  list:   (params: object) => [...inventoryCategoryKeys.all, params] as const,
  detail: (id: string)     => [...inventoryCategoryKeys.all, id]     as const,
};

// ── Hooks ──────────────────────────────────────────────────────────────────────

export function useInventoryCategories(params: { search?: string; isActive?: boolean } = {}) {
  return useQuery({
    queryKey: inventoryCategoryKeys.list(params),
    queryFn:  () => inventoryCategoriesApi.getAll(params),
    staleTime: 60_000,
  });
}

export function useCreateInventoryCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: inventoryCategoriesApi.create,
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: inventoryCategoryKeys.all });
      toast.success("Category created successfully.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateInventoryCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof inventoryCategoriesApi.update>[1]) =>
      inventoryCategoriesApi.update(id, payload),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: inventoryCategoryKeys.all });
      toast.success("Category updated successfully.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteInventoryCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => inventoryCategoriesApi.delete(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: inventoryCategoryKeys.all });
      toast.success("Category deleted.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
