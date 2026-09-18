import { useQuery } from "@tanstack/react-query";
import { healthcareApi } from "@/lib/healthcare.api";
import { usePagedVerticalList } from "@/hooks/use-vertical-list";

const QK = "healthcare" as const;

export function useHealthcareSummary(enabled = true) {
  return useQuery({ queryKey: [QK, "summary"], queryFn: healthcareApi.getSummary, enabled });
}

export function usePatientsList(enabled = true) {
  return usePagedVerticalList([QK, "patients"], healthcareApi.getPatients, enabled);
}

export function useAppointmentsList(enabled = true) {
  return usePagedVerticalList([QK, "appointments"], healthcareApi.getAppointments, enabled);
}

export function useTreatmentPlansList(enabled = true) {
  return usePagedVerticalList([QK, "treatment-plans"], healthcareApi.getTreatmentPlans, enabled);
}
