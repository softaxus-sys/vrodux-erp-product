import { apiClient } from "@/lib/api-client";
import type { VerticalPage, VerticalPageParams } from "@/lib/verticals-shared";
import type { AppointmentDto, HealthcareSummaryDto, PatientDto, TreatmentPlanDto } from "@/types/healthcare";

const BASE = "/api/healthcare";

export const HEALTHCARE_PATIENTS_VIEW = "healthcare.patients.view";
export const HEALTHCARE_APPOINTMENTS_VIEW = "healthcare.appointments.view";
export const HEALTHCARE_TREATMENT_PLANS_VIEW = "healthcare.treatment-plans.view";

function qs(p: VerticalPageParams): string {
  const q = new URLSearchParams();
  q.set("page", String(p.page ?? 1));
  q.set("pageSize", String(p.pageSize ?? 30));
  if (p.status) q.set("status", p.status);
  if (p.search) q.set("search", p.search);
  return q.toString();
}

export const healthcareApi = {
  getSummary: (): Promise<HealthcareSummaryDto> => apiClient.get(`${BASE}/summary`),
  getPatients: (p: VerticalPageParams): Promise<VerticalPage<PatientDto>> => apiClient.get(`${BASE}/patients?${qs(p)}`),
  getAppointments: (p: VerticalPageParams): Promise<VerticalPage<AppointmentDto>> => apiClient.get(`${BASE}/appointments?${qs(p)}`),
  getTreatmentPlans: (p: VerticalPageParams): Promise<VerticalPage<TreatmentPlanDto>> => apiClient.get(`${BASE}/treatment-plans?${qs(p)}`),
};
