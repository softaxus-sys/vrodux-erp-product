import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { hrSelfApi } from "@/lib/hr.api";
import type { ApplyLeavePayload, SelfPageParams } from "@/types/hr";

const QK = "hr-self" as const;

export function useMyProfile() {
  return useQuery({ queryKey: [QK, "profile"], queryFn: hrSelfApi.getProfile });
}

export function useAttendanceToday() {
  return useQuery({ queryKey: [QK, "attendance-today"], queryFn: hrSelfApi.getAttendanceToday });
}

export function useMyAttendance(params: SelfPageParams & { fromDate?: string; toDate?: string }) {
  return useQuery({
    queryKey: [QK, "attendance", params],
    queryFn: () => hrSelfApi.getAttendance(params),
  });
}

export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: hrSelfApi.checkIn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "attendance-today"] });
      qc.invalidateQueries({ queryKey: [QK, "attendance"] });
    },
  });
}

export function useCheckOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: hrSelfApi.checkOut,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "attendance-today"] });
      qc.invalidateQueries({ queryKey: [QK, "attendance"] });
    },
  });
}

export function useMyLeaves(params: SelfPageParams = {}) {
  return useQuery({ queryKey: [QK, "leaves", params], queryFn: () => hrSelfApi.getLeaves(params) });
}

export function useLeaveBalances() {
  return useQuery({ queryKey: [QK, "leave-balances"], queryFn: () => hrSelfApi.getLeaveBalances() });
}

export function useApplyLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ApplyLeavePayload) => hrSelfApi.applyForLeave(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "leaves"] });
      qc.invalidateQueries({ queryKey: [QK, "leave-balances"] });
    },
  });
}

export function useCancelLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leaveId: string) => hrSelfApi.cancelLeave(leaveId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "leaves"] });
      qc.invalidateQueries({ queryKey: [QK, "leave-balances"] });
    },
  });
}

export function useMyPayslips(params: SelfPageParams = {}) {
  return useQuery({ queryKey: [QK, "payslips", params], queryFn: () => hrSelfApi.getPayslips(params) });
}
