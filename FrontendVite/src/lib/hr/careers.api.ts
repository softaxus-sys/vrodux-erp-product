/**
 * Public, anonymous careers-portal API — no auth headers, no token refresh.
 * Backed by CareersController (api/hr/careers/{tenantSlug}/...), which is
 * [AllowAnonymous] and resolves the tenant from the URL slug.
 */

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/hr/careers`;

export class CareersApiError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = "CareersApiError";
  }
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (body as Record<string, unknown> | null)?.error as string | undefined;
    throw new CareersApiError(res.status, msg ?? `HTTP ${res.status}`);
  }
  return body as T;
}

export interface CompanyDto {
  name: string;
  slug: string;
  industry: string | null;
}

export interface PublicJobDto {
  id: string;
  title: string;
  department: string;
  branch: string;
  type: string;
  experienceLevel: string;
  headcount: number;
  salaryMin: number;
  salaryMax: number;
  currency: string;
  postedDate: string;
  closingDate?: string;
  description: string;
  requirements: string[];
  responsibilities: string[];
}

export interface ApplyPayload {
  jobId: string;
  name: string;
  email: string;
  phone?: string;
  nationality?: string;
  currentRole?: string;
  currentCompany?: string;
  experience?: number;
  coverNote?: string;
  resume?: File | null;
}

export interface ApplyResultDto {
  applicantId: string;
  message: string;
}

export const careersApi = {
  getCompany: (tenantSlug: string): Promise<CompanyDto> =>
    get(`${BASE}/${tenantSlug}/company`),

  getOpenJobs: (tenantSlug: string): Promise<PublicJobDto[]> =>
    get(`${BASE}/${tenantSlug}/jobs`),

  getOpenJob: (tenantSlug: string, jobId: string): Promise<PublicJobDto> =>
    get(`${BASE}/${tenantSlug}/jobs/${jobId}`),

  apply: async (tenantSlug: string, payload: ApplyPayload): Promise<ApplyResultDto> => {
    const form = new FormData();
    form.append("JobId", payload.jobId);
    form.append("Name", payload.name);
    form.append("Email", payload.email);
    if (payload.phone) form.append("Phone", payload.phone);
    if (payload.nationality) form.append("Nationality", payload.nationality);
    if (payload.currentRole) form.append("CurrentRole", payload.currentRole);
    if (payload.currentCompany) form.append("CurrentCompany", payload.currentCompany);
    if (payload.experience !== undefined) form.append("Experience", String(payload.experience));
    if (payload.coverNote) form.append("CoverNote", payload.coverNote);
    if (payload.resume) form.append("Resume", payload.resume);

    const res = await fetch(`${BASE}/${tenantSlug}/applicants`, { method: "POST", body: form });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = (body as Record<string, unknown> | null)?.error as string | undefined;
      throw new CareersApiError(res.status, msg ?? `HTTP ${res.status}`);
    }
    return body as ApplyResultDto;
  },
};
