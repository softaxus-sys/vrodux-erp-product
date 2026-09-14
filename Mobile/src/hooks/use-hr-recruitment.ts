import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { hrRecruitmentApi } from "@/lib/hr-recruitment.api";
import type { ApplicantsPageParams, ApplicantStage, JobPostingsPageParams, JobStatus } from "@/types/hr-recruitment";

const QK = "hr-recruitment" as const;

export function useJobPostings(params: JobPostingsPageParams) {
  return useQuery({
    queryKey: [QK, "jobs", params],
    queryFn: () => hrRecruitmentApi.getJobPostings(params),
  });
}

export function useJobPosting(id: string) {
  return useQuery({
    queryKey: [QK, "job", id],
    queryFn: () => hrRecruitmentApi.getJobPosting(id),
    enabled: Boolean(id),
  });
}

export function useUpdateJobStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: JobStatus }) => hrRecruitmentApi.updateJobStatus(id, status),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: [QK, "jobs"] });
      qc.invalidateQueries({ queryKey: [QK, "job", id] });
    },
  });
}

export function useApplicants(params: ApplicantsPageParams) {
  return useQuery({
    queryKey: [QK, "applicants", params],
    queryFn: () => hrRecruitmentApi.getApplicants(params),
  });
}

export function useApplicant(id: string) {
  return useQuery({
    queryKey: [QK, "applicant", id],
    queryFn: () => hrRecruitmentApi.getApplicant(id),
    enabled: Boolean(id),
  });
}

export function useUpdateApplicantStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: ApplicantStage }) => hrRecruitmentApi.updateApplicantStage(id, stage),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: [QK, "applicants"] });
      qc.invalidateQueries({ queryKey: [QK, "applicant", id] });
    },
  });
}

export function useRecruitmentSummary() {
  return useQuery({
    queryKey: [QK, "summary"],
    queryFn: hrRecruitmentApi.getSummary,
  });
}
