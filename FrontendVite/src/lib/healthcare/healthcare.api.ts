import { rawApiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/healthcare`;

export interface PatientDto {
  id: string; patientNumber: string; leadId?: string | null; customerId?: string | null;
  fullName: string; gender: string; dateOfBirth?: string | null; phone: string; email?: string | null;
  bloodGroup?: string | null; assignedDoctor?: string | null; status: string; registeredDate: string; notes?: string | null; createdAt: string;
}
export interface AppointmentDto {
  id: string; appointmentNumber: string; patientId: string; patientName: string; doctor: string;
  department?: string | null; scheduledAt: string; status: string; reason?: string | null; notes?: string | null; createdAt: string;
}
export interface TreatmentPlanDto {
  id: string; patientId: string; patientName: string; diagnosis: string; plan: string; doctor: string;
  startDate: string; followUpDate?: string | null; status: string; notes?: string | null; createdAt: string;
}
export interface HealthcareSummaryDto {
  patients: number; scheduledAppointments: number; todayAppointments: number; completedAppointments: number; activeTreatments: number;
}

export interface CreatePatientReq { leadId?: string | null; customerId?: string | null; fullName: string; gender?: string | null; dateOfBirth?: string | null; phone?: string | null; email?: string | null; bloodGroup?: string | null; assignedDoctor?: string | null; notes?: string | null; }
export interface CreateApptReq { patientId: string; patientName: string; doctor: string; department?: string | null; scheduledAt: string; reason?: string | null; notes?: string | null; }
export interface CreatePlanReq { patientId: string; patientName: string; diagnosis: string; plan: string; doctor: string; startDate: string; followUpDate?: string | null; notes?: string | null; }

/** Paging for the vertical lists, which grow with the practice and are never pruned. */
export interface VerticalPageParams { page?: number; pageSize?: number; status?: string; search?: string; }

export interface VerticalPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}
export const healthcareApi = {
  getSummary:    (): Promise<HealthcareSummaryDto> => rawApiClient.get(`${BASE}/summary`),  getPatients: (p: VerticalPageParams = {}): Promise<VerticalPage<PatientDto>> => {
    const qs = new URLSearchParams();
    qs.set("page", String(p.page ?? 1));
    qs.set("pageSize", String(p.pageSize ?? 30));
    if (p.status) qs.set("status", p.status);
    if (p.search?.trim()) qs.set("search", p.search.trim());
    return rawApiClient.get(`${BASE}/patients?${qs}`);
  },
  createPatient: (d: CreatePatientReq): Promise<PatientDto> => rawApiClient.post(`${BASE}/patients`, d),
  deletePatient: (id: string): Promise<void> => rawApiClient.delete(`${BASE}/patients/${id}`),  getAppointments: (p: VerticalPageParams = {}): Promise<VerticalPage<AppointmentDto>> => {
    const qs = new URLSearchParams();
    qs.set("page", String(p.page ?? 1));
    qs.set("pageSize", String(p.pageSize ?? 30));
    if (p.status) qs.set("status", p.status);
    if (p.search?.trim()) qs.set("search", p.search.trim());
    return rawApiClient.get(`${BASE}/appointments?${qs}`);
  },
  createAppointment: (d: CreateApptReq): Promise<AppointmentDto> => rawApiClient.post(`${BASE}/appointments`, d),
  setApptStatus:     (id: string, status: string): Promise<void> => rawApiClient.patch(`${BASE}/appointments/${id}/status`, { status }),
  deleteAppointment: (id: string): Promise<void> => rawApiClient.delete(`${BASE}/appointments/${id}`),  getPlans: (p: VerticalPageParams = {}): Promise<VerticalPage<TreatmentPlanDto>> => {
    const qs = new URLSearchParams();
    qs.set("page", String(p.page ?? 1));
    qs.set("pageSize", String(p.pageSize ?? 30));
    if (p.status) qs.set("status", p.status);
    if (p.search?.trim()) qs.set("search", p.search.trim());
    return rawApiClient.get(`${BASE}/treatment-plans?${qs}`);
  },
  createPlan: (d: CreatePlanReq): Promise<TreatmentPlanDto> => rawApiClient.post(`${BASE}/treatment-plans`, d),
  setPlanStatus:(id: string, status: string): Promise<void> => rawApiClient.patch(`${BASE}/treatment-plans/${id}/status`, { status }),
  deletePlan: (id: string): Promise<void> => rawApiClient.delete(`${BASE}/treatment-plans/${id}`),
};
