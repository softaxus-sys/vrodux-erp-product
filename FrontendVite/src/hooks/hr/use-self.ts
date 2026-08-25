import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { selfApi, type ApplyLeavePayload } from "@/lib/hr/self.api";

const QK = "hr-self";

/**
 * Hooks for employee self-service. None of them takes an employee id: the backend resolves the
 * subject from the token, so there is nothing here for a caller to get wrong.
 */

export function useMyProfile() {
  return useQuery({
    queryKey: [QK, "profile"],
    queryFn:  selfApi.getProfile,
    staleTime: 5 * 60 * 1000,
    // A user with no linked employee record gets a clear message from the API; retrying that
    // would just repeat a permanent, expected answer.
    retry: false,
  });
}

export function useMyLeaves() {
  return useQuery({ queryKey: [QK, "leaves"], queryFn: selfApi.getLeaves, retry: false });
}

export function useMyLeaveBalances(year?: number) {
  return useQuery({
    queryKey: [QK, "leave-balances", year ?? "current"],
    queryFn:  () => selfApi.getLeaveBalances(year),
    retry: false,
  });
}

export function useMyAttendance(fromDate?: string, toDate?: string) {
  return useQuery({
    queryKey: [QK, "attendance", fromDate ?? "", toDate ?? ""],
    queryFn:  () => selfApi.getAttendance(fromDate, toDate),
    retry: false,
  });
}

export function useMyAttendanceToday() {
  return useQuery({
    queryKey: [QK, "attendance-today"],
    queryFn:  selfApi.getAttendanceToday,
    retry: false,
  });
}

export function useMyPayslips() {
  return useQuery({ queryKey: [QK, "payslips"], queryFn: selfApi.getPayslips, retry: false });
}

function useSelfMutation<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
  invalidate: string[],
  successMessage: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      invalidate.forEach(key => qc.invalidateQueries({ queryKey: [QK, key] }));
      toast.success(successMessage);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useApplyForLeave() {
  return useSelfMutation<ApplyLeavePayload, unknown>(
    selfApi.applyForLeave,
    // The balance changes too: a pending request is held against the entitlement so nobody can
    // book past it while an earlier request is still awaiting approval.
    ["leaves", "leave-balances"],
    "Leave request submitted.",
  );
}

export function useCancelMyLeave() {
  return useSelfMutation<string, void>(
    selfApi.cancelLeave,
    ["leaves", "leave-balances"],
    "Leave request cancelled.",
  );
}

export function useCheckIn() {
  return useSelfMutation<void, unknown>(
    () => selfApi.checkIn(),
    ["attendance-today", "attendance"],
    "Checked in.",
  );
}

export function useCheckOut() {
  return useSelfMutation<void, unknown>(
    () => selfApi.checkOut(),
    ["attendance-today", "attendance"],
    "Checked out.",
  );
}
