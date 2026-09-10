import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { crmApi } from "@/lib/crm.api";
import type { DealsPageParams, MoveDealStageOptions } from "@/types/crm";
import { QK } from "@/hooks/query-keys";

export function useDealsPaged(params: DealsPageParams) {
  return useQuery({
    queryKey: [QK, "deals", "paged", params],
    queryFn: () => crmApi.getDealsPaged(params),
  });
}

export function useDeal(id: string) {
  return useQuery({
    queryKey: [QK, "deal", id],
    queryFn: () => crmApi.getDeal(id),
    enabled: Boolean(id),
  });
}

export function useMoveDealStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      stage,
      probability,
      ...opts
    }: { id: string; stage: string; probability: number } & MoveDealStageOptions) =>
      crmApi.moveDealStage(id, stage, probability, opts),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: [QK, "deal", id] });
      qc.invalidateQueries({ queryKey: [QK, "deals", "paged"] });
    },
  });
}
