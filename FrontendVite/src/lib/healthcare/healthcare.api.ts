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

export const healthcareApi = {
  getSummary:    (): Promise<HealthcareSummaryDto> => rawApiClient.get(`${BASE}/summary`),

  getPatients:   (): Promise<PatientDto[]> => rawApiClient.get(`${BASE}/patients`),
  createPatient: (d: CreatePatientReq): Promise<PatientDto> => rawApiClient.post(`${BASE}/patients`, d),
  deletePatient: (id: string): Promise<void> => rawApiClient.delete(`${BASE}/patients/${id}`),

  getAppointments:   (): Promise<AppointmentDto[]> => rawApiClient.get(`${BASE}/appointments`),
  createAppointment: (d: CreateApptReq): Promise<AppointmentDto> => rawApiClient.post(`${BASE}/appointments`, d),
  setApptStatus:     (id: string, status: string): Promise<void> => rawApiClient.patch(`${BASE}/appointments/${id}/status`, { status }),
  deleteAppointment: (id: string): Promise<void> => rawApiClient.delete(`${BASE}/appointments/${id}`),

  getPlans:   (): Promise<TreatmentPlanDto[]> => rawApiClient.get(`${BASE}/treatment-plans`),
  createPlan: (d: CreatePlanReq): Promise<TreatmentPlanDto> => rawApiClient.post(`${BASE}/treatment-plans`, d),
  setPlanStatus:(id: string, status: string): Promise<void> => rawApiClient.patch(`${BASE}/treatment-plans/${id}/status`, { status }),
  deletePlan: (id: string): Promise<void> => rawApiClient.delete(`${BASE}/treatment-plans/${id}`),
};
