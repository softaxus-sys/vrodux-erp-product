import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  hrLeaveApprovalsApi,
  payrollApprovalsApi,
  purchaseApprovalsApi,
  salesReturnApprovalsApi,
} from "@/lib/approvals.api";

const QK = "approvals" as const;

// ── HR leave requests ───────────────────────────────────────────────────────────────────────
export function usePendingLeaves(enabled: boolean) {
  return useQuery({
    queryKey: [QK, "leaves"],
    queryFn: hrLeaveApprovalsApi.getPending,
    enabled,
  });
}

export function useApproveLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approverId }: { id: string; approverId: string }) =>
      hrLeaveApprovalsApi.approve(id, approverId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK, "leaves"] }),
  });
}

export function useRejectLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approverId, notes }: { id: string; approverId: string; notes?: string }) =>
      hrLeaveApprovalsApi.reject(id, approverId, notes),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK, "leaves"] }),
  });
}

// ── Purchase requisitions ───────────────────────────────────────────────────────────────────
export function usePendingPurchaseApprovals(enabled: boolean) {
  return useQuery({
    queryKey: [QK, "purchase"],
    queryFn: purchaseApprovalsApi.getAll,
    enabled,
    select: (rows) => rows.filter((r) => r.status === "pending"),
  });
}

export function useApprovePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, by }: { id: string; by: string }) => purchaseApprovalsApi.approve(id, by),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK, "purchase"] }),
  });
}

export function useRejectPurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, by, reason }: { id: string; by: string; reason: string }) =>
      purchaseApprovalsApi.reject(id, by, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK, "purchase"] }),
  });
}

// ── Sales returns ───────────────────────────────────────────────────────────────────────────
export function usePendingSalesReturns(enabled: boolean) {
  return useQuery({
    queryKey: [QK, "sales-returns"],
    queryFn: salesReturnApprovalsApi.getAll,
    enabled,
    select: (rows) => rows.filter((r) => r.status === "pending"),
  });
}

export function useApproveSalesReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, by }: { id: string; by: string }) => salesReturnApprovalsApi.approve(id, by),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK, "sales-returns"] }),
  });
}

export function useRejectSalesReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, by }: { id: string; by: string }) => salesReturnApprovalsApi.reject(id, by),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK, "sales-returns"] }),
  });
}

// ── HR payroll runs ─────────────────────────────────────────────────────────────────────────
export function usePayrollRunsForApproval(enabled: boolean) {
  return useQuery({
    queryKey: [QK, "payroll"],
    queryFn: payrollApprovalsApi.getRuns,
    enabled,
  });
}

function usePayrollAction(fn: (id: string) => Promise<void>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK, "payroll"] }),
  });
}

export function useProcessPayroll() {
  return usePayrollAction(payrollApprovalsApi.process);
}

export function usePayPayroll() {
  return usePayrollAction(payrollApprovalsApi.pay);
}

export function useFinanceApprovePayroll() {
  return usePayrollAction(payrollApprovalsApi.financeApprove);
}

export function useRejectPayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => payrollApprovalsApi.reject(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK, "payroll"] }),
  });
}
