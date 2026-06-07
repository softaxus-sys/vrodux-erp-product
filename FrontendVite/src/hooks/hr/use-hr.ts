import { useQuery } from "@tanstack/react-query";
import { hrApi } from "@/lib/hr/hr.api";

const QK = "hr";

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

export function usePayrollRuns() {
  return useQuery({
    queryKey: [QK, "payroll-runs"],
    queryFn:  hrApi.getPayrollRuns,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePayrollSummary() {
  return useQuery({
    queryKey: [QK, "payroll-summary"],
    queryFn:  hrApi.getPayrollSummary,
    staleTime: 5 * 60 * 1000,
  });
}

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
