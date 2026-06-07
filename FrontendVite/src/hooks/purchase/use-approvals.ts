import { useQuery } from "@tanstack/react-query";
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
