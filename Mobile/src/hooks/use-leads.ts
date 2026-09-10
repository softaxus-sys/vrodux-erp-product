import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { crmApi } from "@/lib/crm.api";
import type { CreateActivityRequest, LeadsPageParams } from "@/types/crm";

const QK = "crm" as const;

export function useLeadsPaged(params: LeadsPageParams) {
  return useQuery({
    queryKey: [QK, "leads", "paged", params],
    queryFn: () => crmApi.getLeadsPaged(params),
  });
}

export function useLead(id: string) {
  return useQuery({
    queryKey: [QK, "lead", id],
    queryFn: () => crmApi.getLead(id),
    enabled: Boolean(id),
  });
}

export function useLeadActivities(leadId: string) {
  return useQuery({
    queryKey: [QK, "lead-activities", leadId],
    queryFn: () => crmApi.getLeadActivities(leadId),
    enabled: Boolean(leadId),
  });
}

export function useSetLeadStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => crmApi.setLeadStatus(id, status),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: [QK, "lead", id] });
      qc.invalidateQueries({ queryKey: [QK, "leads", "paged"] });
    },
  });
}

export function useCreateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: CreateActivityRequest) => crmApi.createActivity(a),
    onSuccess: (_data, a) => {
      qc.invalidateQueries({ queryKey: [QK, "lead-activities", a.relatedToId] });
      qc.invalidateQueries({ queryKey: [QK, "lead", a.relatedToId] });
    },
  });
}
