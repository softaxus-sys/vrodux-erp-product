import { apiClient, type PagedResult } from "@/lib/api-client";
import type {
  ApplicantDto,
  ApplicantsPageParams,
  ApplicantStage,
  JobPostingDto,
  JobPostingsPageParams,
  JobStatus,
  RecruitmentSummaryDto,
} from "@/types/hr-recruitment";

const BASE = "/api/hr/recruitment";

/** Backend enforces all four; the web UI only gates two of them in components -- mirror the full
 *  set here rather than the web's narrower gating (confirmed against RecruitmentController.cs). */
export const HR_RECRUITMENT_VIEW = "hr.recruitment.view";
export const HR_RECRUITMENT_CREATE = "hr.recruitment.create";
export const HR_RECRUITMENT_EDIT = "hr.recruitment.edit";
export const HR_RECRUITMENT_DELETE = "hr.recruitment.delete";

function buildJobsQuery(p: JobPostingsPageParams): string {
  const qs = new URLSearchParams();
  qs.set("page", String(p.page ?? 1));
  qs.set("pageSize", String(p.pageSize ?? 20));
  if (p.status) qs.set("status", p.status);
  return qs.toString();
}

function buildApplicantsQuery(p: ApplicantsPageParams): string {
  const qs = new URLSearchParams();
  qs.set("page", String(p.page ?? 1));
  qs.set("pageSize", String(p.pageSize ?? 25));
  if (p.jobId) qs.set("jobId", p.jobId);
  if (p.stage) qs.set("stage", p.stage);
  return qs.toString();
}

export const hrRecruitmentApi = {
  getJobPostings: (params: JobPostingsPageParams = {}): Promise<PagedResult<JobPostingDto>> =>
    apiClient.get(`${BASE}/jobs?${buildJobsQuery(params)}`),

  getJobPosting: (id: string): Promise<JobPostingDto> => apiClient.get(`${BASE}/jobs/${id}`),

  updateJobStatus: (id: string, status: JobStatus): Promise<void> =>
    apiClient.post(`${BASE}/jobs/${id}/status`, { status }),

  getApplicants: (params: ApplicantsPageParams = {}): Promise<PagedResult<ApplicantDto>> =>
    apiClient.get(`${BASE}/applicants?${buildApplicantsQuery(params)}`),

  getApplicant: (id: string): Promise<ApplicantDto> => apiClient.get(`${BASE}/applicants/${id}`),

  updateApplicantStage: (id: string, stage: ApplicantStage): Promise<void> =>
    apiClient.put(`${BASE}/applicants/${id}/stage`, { stage }),

  getSummary: (): Promise<RecruitmentSummaryDto> => apiClient.get(`${BASE}/summary`),
};
