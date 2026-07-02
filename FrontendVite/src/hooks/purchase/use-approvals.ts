import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { approvalsApi } from "@/lib/purchase/approvals.api";

const QK = "purchase-approvals";

export function useApprovals() {
  return useQuery({
    queryKey: [QK],
    queryFn:  approvalsApi.getAll,
    staleTime: 60_000,
  });
}

export function useApprovalsSummary() {
  return useQuery({
    queryKey: [QK, "summary"],
    queryFn:  approvalsApi.getSummary,
    staleTime: 60_000,
  });
}

function useApprovalMutation(fn: (v: { id: string; by: string; reason?: string }) => Promise<void>, msg: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
      qc.invalidateQueries({ queryKey: [QK, "summary"] });
      toast.success(msg);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useApproveApproval() {
  return useApprovalMutation(({ id, by }) => approvalsApi.approve(id, by), "Request approved.");
}

export function useRejectApproval() {
  return useApprovalMutation(({ id, by, reason }) => approvalsApi.reject(id, by, reason ?? ""), "Request rejected.");
}
