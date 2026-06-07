import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { approvalsApi } from "@/lib/purchase/approvals.api";

export const approvalKeys = {
  all:     ["purchase-approvals"] as const,
  list:    (params?: object) => [...approvalKeys.all, "list", params ?? {}] as const,
  detail:  (id: string) => [...approvalKeys.all, "detail", id] as const,
  summary: () => [...approvalKeys.all, "summary"] as const,
};

export function useApprovals(params?: { status?: string; type?: string }) {
  return useQuery({
    queryKey: approvalKeys.list(params),
    queryFn:  () => approvalsApi.getAll(params),
  });
}

export function useApproval(id: string) {
  return useQuery({
    queryKey: approvalKeys.detail(id),
    queryFn:  () => approvalsApi.getById(id),
    enabled:  !!id,
  });
}

export function useApprovalSummary() {
  return useQuery({
    queryKey: approvalKeys.summary(),
    queryFn:  () => approvalsApi.getSummary(),
  });
}

export function useApproveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      approvalsApi.approve(id, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: approvalKeys.all });
    },
  });
}

export function useRejectRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      approvalsApi.reject(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: approvalKeys.all });
    },
  });
}
