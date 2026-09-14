/**
 * Authenticated recruitment management (`/api/hr/recruitment/*`) -- distinct from the public,
 * anonymous careers portal (`/api/hr/careers/*`, `CareersController` is `[AllowAnonymous]`).
 * Mirrors the backend's real DTOs (`RecruitmentController.cs`), not the web frontend's own TS
 * type (which drops `headcount`/`responsibilities` despite the backend returning them).
 *
 * The web app over-fetches (`pageSize=500`, filters client-side) even though the backend supports
 * real `page`/`pageSize`/`status`/`jobId`/`stage` query params -- mobile uses real pagination
 * instead, to avoid pulling a tenant's entire history over a mobile connection.
 */
export type JobStatus = "draft" | "open" | "on_hold" | "closed";
export type JobType = "full_time" | "part_time" | "contract";
export type ExperienceLevel = "junior" | "mid" | "senior" | "lead" | "executive";
export type ApplicantStage = "applied" | "screening" | "interview" | "offer" | "hired" | "rejected";

export interface JobPostingDto {
  id: string;
  title: string;
  department: string;
  branch: string;
  type: JobType;
  experienceLevel: ExperienceLevel;
  headcount: number;
  salaryMin: number;
  salaryMax: number;
  currency: string;
  status: JobStatus;
  postedDate: string;
  closingDate?: string | null;
  applicants: number;
  description: string;
  requirements: string[];
  responsibilities: string[];
  hiringManager?: string | null;
}

export interface JobPostingsPageParams {
  page?: number;
  pageSize?: number;
  status?: JobStatus;
}

export interface ApplicantDto {
  id: string;
  jobId: string;
  jobTitle: string;
  name: string;
  email: string;
  phone?: string | null;
  nationality?: string | null;
  currentRole?: string | null;
  currentCompany?: string | null;
  experience: number;
  stage: ApplicantStage;
  appliedDate: string;
  rating?: number | null;
  notes?: string | null;
  source?: string | null;
  hasResume: boolean;
}

export interface ApplicantsPageParams {
  page?: number;
  pageSize?: number;
  jobId?: string;
  stage?: ApplicantStage;
}

export interface RecruitmentSummaryDto {
  openPositions: number;
  totalApplicants: number;
  inInterview: number;
  offers: number;
  hiredThisMonth: number;
  avgTimeToHire: number;
}

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  draft: "Draft",
  open: "Open",
  on_hold: "On hold",
  closed: "Closed",
};

export const JOB_STATUS_TONE: Record<JobStatus, "success" | "warning" | "destructive" | "info" | "neutral"> = {
  draft: "neutral",
  open: "success",
  on_hold: "warning",
  closed: "destructive",
};

/** Sequential pipeline order -- "move to next stage" advances one step; rejected is reachable
 *  directly from any stage, matching the web drawer's own two actions. */
export const APPLICANT_STAGE_ORDER: ApplicantStage[] = ["applied", "screening", "interview", "offer", "hired"];

export const APPLICANT_STAGE_LABELS: Record<ApplicantStage, string> = {
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
  rejected: "Rejected",
};

export const APPLICANT_STAGE_TONE: Record<ApplicantStage, "success" | "warning" | "destructive" | "info" | "neutral"> = {
  applied: "neutral",
  screening: "info",
  interview: "info",
  offer: "warning",
  hired: "success",
  rejected: "destructive",
};
