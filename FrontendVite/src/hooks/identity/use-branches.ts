import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { branchesApi, type UpsertBranchRequest } from "@/lib/identity/branches.api";

const QK = "identity-branches";

export function useBranches(status?: string) {
  return useQuery({
    queryKey: [QK, status],
    queryFn:  () => branchesApi.getAll(1, 100, status),
    select:   (res) => res.items,
  });
}

export function useCreateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertBranchRequest) => branchesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
      toast.success("Branch created.");
    },
    onError: () => toast.error("Failed to create branch."),
  });
}

export function useUpdateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpsertBranchRequest }) =>
      branchesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
      toast.success("Branch updated.");
    },
    onError: () => toast.error("Failed to update branch."),
  });
}

export function useDeleteBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => branchesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
      toast.success("Branch deleted.");
    },
    onError: () => toast.error("Failed to delete branch."),
  });
}
