import { apiClient } from "@/lib/api-client";
import type { VerticalPage, VerticalPageParams } from "@/lib/verticals-shared";
import type { AdmissionDto, EducationSummaryDto, EnrollmentDto, StudentDto } from "@/types/education";

const BASE = "/api/education";

export const EDUCATION_ADMISSIONS_VIEW = "education.admissions.view";
export const EDUCATION_STUDENTS_VIEW = "education.students.view";
export const EDUCATION_ENROLLMENTS_VIEW = "education.enrollments.view";

function qs(p: VerticalPageParams): string {
  const q = new URLSearchParams();
  q.set("page", String(p.page ?? 1));
  q.set("pageSize", String(p.pageSize ?? 30));
  if (p.status) q.set("status", p.status);
  if (p.search) q.set("search", p.search);
  return q.toString();
}

export const educationApi = {
  getSummary: (): Promise<EducationSummaryDto> => apiClient.get(`${BASE}/summary`),
  getAdmissions: (p: VerticalPageParams): Promise<VerticalPage<AdmissionDto>> => apiClient.get(`${BASE}/admissions?${qs(p)}`),
  getStudents: (p: VerticalPageParams): Promise<VerticalPage<StudentDto>> => apiClient.get(`${BASE}/students?${qs(p)}`),
  getEnrollments: (p: VerticalPageParams): Promise<VerticalPage<EnrollmentDto>> => apiClient.get(`${BASE}/enrollments?${qs(p)}`),
};
