import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  recruitmentApi,
  type CreateJobPostingRequest,
  type CreateApplicantRequest,
} from "@/lib/hr/recruitment.api";
import { toast } from "sonner";

export const recruitmentKeys = {
  all:         ["hr-recruitment"] as const,
  jobs:        () => [...recruitmentKeys.all, "jobs"] as const,
  jobList:     (params?: object) => [...recruitmentKeys.jobs(), params ?? {}] as const,
  applicants:  () => [...recruitmentKeys.all, "applicants"] as const,
  applicantList: (params?: object) => [...recruitmentKeys.applicants(), params ?? {}] as const,
  applicant:   (id: string) => [...recruitmentKeys.applicants(), "detail", id] as const,
};

export function useJobPostings(params?: { status?: string; search?: string }) {
  return useQuery({
    queryKey: recruitmentKeys.jobList(params),
    queryFn:  () => recruitmentApi.getJobPostings(params),
  });
}

export function useApplicants(params?: {
  jobPostingId?: string;
  stage?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  return useQuery({
    queryKey: recruitmentKeys.applicantList(params),
    queryFn:  () => recruitmentApi.getApplicants(params),
  });
}

export function useCreateJobPosting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateJobPostingRequest) => recruitmentApi.createJobPosting(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: recruitmentKeys.jobs() });
      toast.success("Job posting created.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCreateApplicant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateApplicantRequest) => recruitmentApi.createApplicant(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: recruitmentKeys.applicants() });
      toast.success("Applicant added.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useMoveApplicantStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) =>
      recruitmentApi.moveApplicantStage(id, stage),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: recruitmentKeys.applicants() });
      toast.success("Stage updated.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
