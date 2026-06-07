import { rawApiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/education`;

export interface AdmissionDto {
  id: string; admissionNumber: string; leadId?: string | null; studentId?: string | null;
  applicantName: string; program: string; intakeTerm: string; guardianName?: string | null;
  phone?: string | null; email?: string | null; status: string; appliedDate: string; notes?: string | null; createdAt: string;
}
export interface StudentDto {
  id: string; studentNumber: string; customerId?: string | null; fullName: string; gender: string; program: string;
  guardianName?: string | null; phone?: string | null; email?: string | null; status: string; enrolledDate: string; notes?: string | null; createdAt: string;
}
export interface EnrollmentDto {
  id: string; enrollmentNumber: string; studentId: string; studentName: string; course: string; term: string;
  feeTotal: number; feePaid: number; feeBalance: number; status: string; enrollDate: string; notes?: string | null; createdAt: string;
}
export interface EducationSummaryDto {
  openInquiries: number; totalAdmissions: number; enrolledStudents: number; activeEnrollments: number;
  feesBilled: number; feesCollected: number; feesOutstanding: number;
}

export interface CreateAdmissionReq { leadId?: string | null; applicantName: string; program: string; intakeTerm?: string | null; guardianName?: string | null; phone?: string | null; email?: string | null; notes?: string | null; }
export interface CreateStudentReq { customerId?: string | null; fullName: string; gender?: string | null; program?: string | null; guardianName?: string | null; phone?: string | null; email?: string | null; notes?: string | null; }
export interface CreateEnrollmentReq { studentId: string; studentName: string; course: string; term?: string | null; feeTotal: number; notes?: string | null; }

export const educationApi = {
  getSummary:     (): Promise<EducationSummaryDto> => rawApiClient.get(`${BASE}/summary`),

  getAdmissions:  (): Promise<AdmissionDto[]> => rawApiClient.get(`${BASE}/admissions`),
  createAdmission:(d: CreateAdmissionReq): Promise<AdmissionDto> => rawApiClient.post(`${BASE}/admissions`, d),
  setAdmissionStatus:(id: string, status: string): Promise<void> => rawApiClient.patch(`${BASE}/admissions/${id}/status`, { status }),
  enrollAdmission:(id: string): Promise<{ studentId: string; studentNumber: string }> => rawApiClient.post(`${BASE}/admissions/${id}/enroll`),
  deleteAdmission:(id: string): Promise<void> => rawApiClient.delete(`${BASE}/admissions/${id}`),

  getStudents:    (): Promise<StudentDto[]> => rawApiClient.get(`${BASE}/students`),
  createStudent:  (d: CreateStudentReq): Promise<StudentDto> => rawApiClient.post(`${BASE}/students`, d),
  deleteStudent:  (id: string): Promise<void> => rawApiClient.delete(`${BASE}/students/${id}`),

  getEnrollments: (): Promise<EnrollmentDto[]> => rawApiClient.get(`${BASE}/enrollments`),
  createEnrollment:(d: CreateEnrollmentReq): Promise<EnrollmentDto> => rawApiClient.post(`${BASE}/enrollments`, d),
  recordFee:      (id: string, amount: number): Promise<EnrollmentDto> => rawApiClient.post(`${BASE}/enrollments/${id}/payment`, { amount }),
  setEnrollmentStatus:(id: string, status: string): Promise<void> => rawApiClient.patch(`${BASE}/enrollments/${id}/status`, { status }),
  deleteEnrollment:(id: string): Promise<void> => rawApiClient.delete(`${BASE}/enrollments/${id}`),
};
