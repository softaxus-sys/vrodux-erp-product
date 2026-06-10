import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  hrApi,
  type CreateEmployeePayload,
  type UpdateEmployeePayload,
  type CreateLeavePayload,
  type CreatePayrollRunPayload,
  type GeneratePayrollPayload,
  type MarkAttendancePayload,
  type UpdateAttendancePayload,
  type CreateJobPostingPayload,
} from "@/lib/hr/hr.api";
import { toast } from "sonner";

const QK = "hr";

// ── Employees ─────────────────────────────────────────────────────────────────

export function useEmployees() {
  return useQuery({
    queryKey: [QK, "employees"],
    queryFn:  hrApi.getEmployees,
    staleTime: 5 * 60 * 1000,
  });
}

export function useHrSummary() {
  return useQuery({
    queryKey: [QK, "hr-summary"],
    queryFn:  hrApi.getHrSummary,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateEmployeePayload) => hrApi.createEmployee(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "employees"] });
      qc.invalidateQueries({ queryKey: [QK, "hr-summary"] });
      toast.success("Employee added successfully.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateEmployee(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateEmployeePayload) => hrApi.updateEmployee(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "employees"] });
      toast.success("Employee updated.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hrApi.deleteEmployee(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "employees"] });
      qc.invalidateQueries({ queryKey: [QK, "hr-summary"] });
      toast.success("Employee removed.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Attendance ────────────────────────────────────────────────────────────────

export function useAttendance() {
  return useQuery({
    queryKey: [QK, "attendance"],
    queryFn:  hrApi.getAttendance,
    staleTime: 2 * 60 * 1000,
  });
}

export function useAttendanceSummary() {
  return useQuery({
    queryKey: [QK, "attendance-summary"],
    queryFn:  hrApi.getAttendanceSummary,
    staleTime: 2 * 60 * 1000,
  });
}

export function useMarkAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: MarkAttendancePayload) => hrApi.markAttendance(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "attendance"] });
      qc.invalidateQueries({ queryKey: [QK, "attendance-summary"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateAttendancePayload }) =>
      hrApi.updateAttendance(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "attendance"] });
      qc.invalidateQueries({ queryKey: [QK, "attendance-summary"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Leaves ────────────────────────────────────────────────────────────────────

export function useLeaveRequests() {
  return useQuery({
    queryKey: [QK, "leave-requests"],
    queryFn:  hrApi.getLeaveRequests,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLeaveBalances() {
  return useQuery({
    queryKey: [QK, "leave-balances"],
    queryFn:  hrApi.getLeaveBalances,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLeaveSummary() {
  return useQuery({
    queryKey: [QK, "leave-summary"],
    queryFn:  hrApi.getLeaveSummary,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateLeavePayload) => hrApi.createLeave(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "leave-requests"] });
      qc.invalidateQueries({ queryKey: [QK, "leave-summary"] });
      toast.success("Leave request submitted successfully.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hrApi.deleteLeave(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "leave-requests"] });
      qc.invalidateQueries({ queryKey: [QK, "leave-summary"] });
      toast.success("Leave request deleted.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useApproveLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hrApi.approveLeave(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "leave-requests"] });
      qc.invalidateQueries({ queryKey: [QK, "leave-summary"] });
      toast.success("Leave request approved.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRejectLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      hrApi.rejectLeave(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "leave-requests"] });
      qc.invalidateQueries({ queryKey: [QK, "leave-summary"] });
      toast.success("Leave request rejected.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Payroll ───────────────────────────────────────────────────────────────────

export function usePayrollRuns() {
  return useQuery({
    queryKey: [QK, "payroll-runs"],
    queryFn:  hrApi.getPayrollRuns,
    staleTime: 30 * 1000,
  });
}

export function usePayrollSummary() {
  return useQuery({
    queryKey: [QK, "payroll-summary"],
    queryFn:  hrApi.getPayrollSummary,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePayrollRunById(id: string | null) {
  return useQuery({
    queryKey: [QK, "payroll-run", id],
    queryFn:  () => hrApi.getPayrollRunById(id!),
    enabled:  !!id,
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreatePayrollRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePayrollRunPayload) => hrApi.createPayrollRun(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "payroll-runs"] });
      qc.invalidateQueries({ queryKey: [QK, "payroll-summary"] });
      toast.success("Payroll run created successfully.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useGeneratePayrollRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: GeneratePayrollPayload) => hrApi.generatePayrollRun(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "payroll-runs"] });
      qc.invalidateQueries({ queryKey: [QK, "payroll-summary"] });
      toast.success("Payroll run generated from active employees.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeletePayrollRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hrApi.deletePayrollRun(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "payroll-runs"] });
      qc.invalidateQueries({ queryKey: [QK, "payroll-summary"] });
      toast.success("Draft payroll run deleted.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRejectPayrollRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      hrApi.rejectPayrollRun(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "payroll-runs"] });
      qc.invalidateQueries({ queryKey: [QK, "payroll-summary"] });
      toast.success("Payroll run rejected. The creator has been notified.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useProcessPayrollRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hrApi.processPayrollRun(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: [QK, "payroll-runs"] });
      qc.invalidateQueries({ queryKey: [QK, "payroll-summary"] });
      qc.invalidateQueries({ queryKey: [QK, "payroll-run", id] });
      toast.success("Payroll run processed successfully.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function usePayPayrollRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hrApi.payPayrollRun(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: [QK, "payroll-runs"] });
      qc.invalidateQueries({ queryKey: [QK, "payroll-summary"] });
      qc.invalidateQueries({ queryKey: [QK, "payroll-run", id] });
      toast.success("Payroll marked as paid. Salaries have been disbursed.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useReopenPayrollRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hrApi.reopenPayrollRun(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: [QK, "payroll-runs"] });
      qc.invalidateQueries({ queryKey: [QK, "payroll-run", id] });
      toast.success("Payroll run reopened as draft. Edit the slips and resubmit.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdatePayrollSlip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ runId, slipId, allowances, deductions, notes }: {
      runId: string; slipId: string; allowances: number; deductions: number; notes?: string;
    }) => hrApi.updatePayrollSlip(runId, slipId, { allowances, deductions, notes }),
    onSuccess: (_, { runId }) => {
      qc.invalidateQueries({ queryKey: [QK, "payroll-run", runId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSendPayslipEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ runId, slipId }: { runId: string; slipId: string }) =>
      hrApi.sendPayslipEmail(runId, slipId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: [QK, "payroll-run"] });
      toast.success(`Payslip sent to ${data.sentTo}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Performance ───────────────────────────────────────────────────────────────

export function usePerformanceReviews() {
  return useQuery({
    queryKey: [QK, "performance-reviews"],
    queryFn:  hrApi.getPerformanceReviews,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePerformanceSummary() {
  return useQuery({
    queryKey: [QK, "performance-summary"],
    queryFn:  hrApi.getPerformanceSummary,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Recruitment ───────────────────────────────────────────────────────────────

export function useJobPostings() {
  return useQuery({
    queryKey: [QK, "job-postings"],
    queryFn:  hrApi.getJobPostings,
    staleTime: 5 * 60 * 1000,
  });
}

export function useApplicants() {
  return useQuery({
    queryKey: [QK, "applicants"],
    queryFn:  hrApi.getApplicants,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRecruitmentSummary() {
  return useQuery({
    queryKey: [QK, "recruitment-summary"],
    queryFn:  hrApi.getRecruitmentSummary,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateJobPosting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateJobPostingPayload) => hrApi.createJobPosting(payload),
    onSuccess: (_, payload) => {
      qc.invalidateQueries({ queryKey: [QK, "job-postings"] });
      qc.invalidateQueries({ queryKey: [QK, "recruitment-summary"] });
      toast.success(payload.status === "open" ? "Job posting published." : "Job saved as draft.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
