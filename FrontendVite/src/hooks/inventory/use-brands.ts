import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { brandsApi } from "@/lib/inventory/brands.api";

// ── Query keys ─────────────────────────────────────────────────────────────────

export const brandKeys = {
  all:    ["inventory-brands"]                 as const,
  list:   (params: object) => [...brandKeys.all, params] as const,
  detail: (id: string)     => [...brandKeys.all, id]     as const,
};

// ── Hooks ──────────────────────────────────────────────────────────────────────

export function useBrands(params: { search?: string; isActive?: boolean } = {}) {
  return useQuery({
    queryKey: brandKeys.list(params),
    queryFn:  () => brandsApi.getAll(params),
    staleTime: 60_000,
  });
}

export function useCreateBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: brandsApi.create,
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: brandKeys.all });
      toast.success("Brand created successfully.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof brandsApi.update>[1]) =>
      brandsApi.update(id, payload),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: brandKeys.all });
      toast.success("Brand updated successfully.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => brandsApi.delete(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: brandKeys.all });
      toast.success("Brand deleted.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
