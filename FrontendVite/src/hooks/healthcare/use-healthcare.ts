import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { healthcareApi, type CreatePatientReq, type CreateApptReq, type CreatePlanReq, type VerticalPageParams } from "@/lib/healthcare/healthcare.api";

const QK = "healthcare";

export function useHealthcareSummary() { return useQuery({ queryKey: [QK, "summary"], queryFn: healthcareApi.getSummary }); }
export function usePatients(params: VerticalPageParams = {}) {
  return useQuery({
    queryKey: [...[QK, "patients"], params],
    queryFn: () => healthcareApi.getPatients(params),
    // Keeps the current page on screen while the next one loads, so paging never blanks the table.
    placeholderData: (prev) => prev,
  });
}
export function useAppointments(params: VerticalPageParams = {}) {
  return useQuery({
    queryKey: [...[QK, "appointments"], params],
    queryFn: () => healthcareApi.getAppointments(params),
    // Keeps the current page on screen while the next one loads, so paging never blanks the table.
    placeholderData: (prev) => prev,
  });
}
export function useTreatmentPlans(params: VerticalPageParams = {}) {
  return useQuery({
    queryKey: [...[QK, "plans"], params],
    queryFn: () => healthcareApi.getPlans(params),
    // Keeps the current page on screen while the next one loads, so paging never blanks the table.
    placeholderData: (prev) => prev,
  });
}

function useM<T>(fn: (a: T) => Promise<unknown>, msg?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      [["summary"], ["patients"], ["appointments"], ["plans"]].forEach(k => qc.invalidateQueries({ queryKey: [QK, ...k] }));
      if (msg) toast.success(msg);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreatePatient() { return useM((d: CreatePatientReq) => healthcareApi.createPatient(d), "Patient registered."); }
export function useDeletePatient() { return useM((id: string) => healthcareApi.deletePatient(id), "Patient removed."); }
export function useCreateAppointment() { return useM((d: CreateApptReq) => healthcareApi.createAppointment(d), "Appointment booked."); }
export function useSetApptStatus()     { return useM(({ id, status }: { id: string; status: string }) => healthcareApi.setApptStatus(id, status), "Appointment updated."); }
export function useDeleteAppointment() { return useM((id: string) => healthcareApi.deleteAppointment(id), "Appointment removed."); }
export function useCreatePlan()    { return useM((d: CreatePlanReq) => healthcareApi.createPlan(d), "Treatment plan created."); }
export function useSetPlanStatus() { return useM(({ id, status }: { id: string; status: string }) => healthcareApi.setPlanStatus(id, status), "Plan updated."); }
export function useDeletePlan()    { return useM((id: string) => healthcareApi.deletePlan(id), "Plan removed."); }
