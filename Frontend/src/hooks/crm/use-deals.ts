import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dealsApi, type CreateDealRequest, type DealStage } from "@/lib/crm/deals.api";

export const dealKeys = {
  all:     ["crm-deals"] as const,
  list:    (params?: Record<string, string>) => [...dealKeys.all, "list", params ?? {}] as const,
  detail:  (id: string) => [...dealKeys.all, "detail", id] as const,
  summary: () => [...dealKeys.all, "summary"] as const,
};

export function useDeals(params?: Record<string, string>) {
  return useQuery({
    queryKey: dealKeys.list(params),
    queryFn:  () => dealsApi.getAll(params),
  });
}

export function useDeal(id: string) {
  return useQuery({
    queryKey: dealKeys.detail(id),
    queryFn:  () => dealsApi.getById(id),
    enabled:  !!id,
  });
}

export function useDealSummary() {
  return useQuery({
    queryKey: dealKeys.summary(),
    queryFn:  () => dealsApi.getSummary(),
  });
}

export function useCreateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDealRequest) => dealsApi.create(data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: dealKeys.all }); },
  });
}

export function useUpdateDealStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: DealStage }) =>
      dealsApi.updateStage(id, stage),
    onSuccess: () => { qc.invalidateQueries({ queryKey: dealKeys.all }); },
  });
}
