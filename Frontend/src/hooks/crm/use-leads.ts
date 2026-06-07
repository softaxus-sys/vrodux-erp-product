import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { leadsApi, type CreateLeadRequest, type LeadStatus } from "@/lib/crm/leads.api";

export const leadKeys = {
  all:     ["crm-leads"] as const,
  list:    (params?: Record<string, string>) => [...leadKeys.all, "list", params ?? {}] as const,
  detail:  (id: string) => [...leadKeys.all, "detail", id] as const,
  summary: () => [...leadKeys.all, "summary"] as const,
};

export function useLeads(params?: Record<string, string>) {
  return useQuery({
    queryKey: leadKeys.list(params),
    queryFn:  () => leadsApi.getAll(params),
  });
}

export function useLead(id: string) {
  return useQuery({
    queryKey: leadKeys.detail(id),
    queryFn:  () => leadsApi.getById(id),
    enabled:  !!id,
  });
}

export function useLeadSummary() {
  return useQuery({
    queryKey: leadKeys.summary(),
    queryFn:  () => leadsApi.getSummary(),
  });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateLeadRequest) => leadsApi.create(data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: leadKeys.all }); },
  });
}

export function useUpdateLeadStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: LeadStatus }) =>
      leadsApi.updateStatus(id, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: leadKeys.all }); },
  });
}
