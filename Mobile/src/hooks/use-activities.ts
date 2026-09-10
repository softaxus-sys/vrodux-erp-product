import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { crmApi } from "@/lib/crm.api";
import type { CreateActivityRequest } from "@/types/crm";
import { QK } from "@/hooks/query-keys";

/** Shared across leads/deals/customers -- each screen passes its own related-record type/id. */
export function useActivities(relatedToType: "lead" | "deal" | "customer", relatedToId: string) {
  return useQuery({
    queryKey: [QK, "activities", relatedToType, relatedToId],
    queryFn: () => crmApi.getActivities(relatedToType, relatedToId),
    enabled: Boolean(relatedToId),
  });
}

export function useCreateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: CreateActivityRequest) => crmApi.createActivity(a),
    onSuccess: (_data, a) => {
      qc.invalidateQueries({ queryKey: [QK, "activities", a.relatedToType, a.relatedToId] });
      qc.invalidateQueries({ queryKey: [QK, a.relatedToType, a.relatedToId] });
    },
  });
}
