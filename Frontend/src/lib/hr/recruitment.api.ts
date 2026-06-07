import { rawApiClient } from "@/lib/api-client";
import type { PagedResult } from "@/lib/api-client";

const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/hr`;

// ── Job Postings ──────────────────────────────────────────────────────────────

export interface JobPostingDto {
  id: string;
  title: string;
  department: string;
  branch: string | null;
  status: string;
  experienceLevel: string | null;
  employmentType: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string;
  closingDate: string | null;
  applicantCount: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface CreateJobPostingRequest {
  title: string;
  department: string;
  branch?: string | null;
  experienceLevel?: string | null;
  employmentType?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency?: string;
  closingDate?: string | null;
}

// ── Applicants ────────────────────────────────────────────────────────────────

export interface ApplicantDto {
  id: string;
  jobPostingId: string;
  jobTitle: string;
  name: string;
  email: string;
  phone: string | null;
  currentRole: string | null;
  currentCompany: string | null;
  experience: number | null;
  nationality: string | null;
  source: string | null;
  stage: string;
  rating: number | null;
  notes: string | null;
  appliedDate: string;
  createdAt: string;
}

export interface CreateApplicantRequest {
  jobPostingId: string;
  name: string;
  email: string;
  phone?: string | null;
  currentRole?: string | null;
  currentCompany?: string | null;
  experience?: number | null;
  nationality?: string | null;
  source?: string | null;
}

export const recruitmentApi = {
  // Job Postings
  getJobPostings: (params?: { status?: string; search?: string }): Promise<JobPostingDto[]> => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.search) qs.set("search", params.search);
    const q = qs.toString();
    return rawApiClient.get<JobPostingDto[]>(q ? `${BASE}/job-postings?${q}` : `${BASE}/job-postings`);
  },

  getJobPostingById: (id: string): Promise<JobPostingDto> =>
    rawApiClient.get<JobPostingDto>(`${BASE}/job-postings/${id}`),

  createJobPosting: (data: CreateJobPostingRequest): Promise<JobPostingDto> =>
    rawApiClient.post<JobPostingDto>(`${BASE}/job-postings`, data),

  // Applicants
  getApplicants: (params?: {
    jobPostingId?: string;
    stage?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PagedResult<ApplicantDto>> => {
    const qs = new URLSearchParams();
    if (params?.jobPostingId) qs.set("jobPostingId", params.jobPostingId);
    if (params?.stage)        qs.set("stage",        params.stage);
    if (params?.search)       qs.set("search",       params.search);
    if (params?.page)         qs.set("page",         String(params.page));
    if (params?.pageSize)     qs.set("pageSize",     String(params.pageSize));
    const q = qs.toString();
    return rawApiClient.get<PagedResult<ApplicantDto>>(q ? `${BASE}/applicants?${q}` : `${BASE}/applicants`);
  },

  getApplicantById: (id: string): Promise<ApplicantDto> =>
    rawApiClient.get<ApplicantDto>(`${BASE}/applicants/${id}`),

  createApplicant: (data: CreateApplicantRequest): Promise<ApplicantDto> =>
    rawApiClient.post<ApplicantDto>(`${BASE}/applicants`, data),

  moveApplicantStage: (id: string, stage: string): Promise<void> =>
    rawApiClient.put<void>(`${BASE}/applicants/${id}/stage`, { stage }),
};
