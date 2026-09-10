import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { crmApi } from "@/lib/crm.api";
import type { ConvertLeadRequest, LeadsPageParams } from "@/types/crm";
import { QK } from "@/hooks/query-keys";

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

export function useConvertLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ConvertLeadRequest }) => crmApi.convertLead(id, body),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: [QK, "lead", id] });
      qc.invalidateQueries({ queryKey: [QK, "leads", "paged"] });
      // The new opportunity should show up next time the pipeline list is opened.
      qc.invalidateQueries({ queryKey: [QK, "deals", "paged"] });
    },
  });
}
