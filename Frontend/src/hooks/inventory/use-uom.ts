import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { uomApi } from "@/lib/inventory/uom.api";

// ── Query keys ─────────────────────────────────────────────────────────────────

export const uomKeys = {
  all:    ["inventory-uom"]                  as const,
  list:   (params: object) => [...uomKeys.all, params] as const,
  detail: (id: string)     => [...uomKeys.all, id]     as const,
};

// ── Hooks ──────────────────────────────────────────────────────────────────────

export function useUoMs(params: { search?: string; isActive?: boolean } = {}) {
  return useQuery({
    queryKey: uomKeys.list(params),
    queryFn:  () => uomApi.getAll(params),
    staleTime: 60_000,
  });
}

export function useCreateUoM() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: uomApi.create,
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: uomKeys.all });
      toast.success("Unit of measure created successfully.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateUoM() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof uomApi.update>[1]) =>
      uomApi.update(id, payload),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: uomKeys.all });
      toast.success("Unit of measure updated successfully.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteUoM() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => uomApi.delete(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: uomKeys.all });
      toast.success("Unit of measure deleted.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
