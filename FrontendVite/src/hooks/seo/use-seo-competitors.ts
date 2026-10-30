import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { seoCompetitorsApi } from "@/lib/seo/seo-competitors.api";

const QK = "seo-competitors";

export function useCompetitors(siteId: string | null) {
  return useQuery({
    queryKey: [QK, "overview", siteId],
    queryFn: () => seoCompetitorsApi.overview(siteId!),
    enabled: !!siteId,
    // A comparison runs in the background: poll while one is in progress.
    refetchInterval: (q) => {
      const s = q.state.data?.latestScan?.status;
      return s === "queued" || s === "running" ? 4000 : false;
    },
  });
}

export function useCompetitorScan(scanId: string | null, status?: string) {
  return useQuery({
    queryKey: [QK, "scan", scanId, status],
    queryFn: () => seoCompetitorsApi.scan(scanId!),
    enabled: !!scanId && status === "completed",
    staleTime: 15_000,
  });
}

function useCompetitorMutation<TArgs, TResult>(fn: (a: TArgs) => Promise<TResult>, success?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
      qc.invalidateQueries({ queryKey: ["seo", "credits"] });
      qc.invalidateQueries({ queryKey: ["seo-content"] });
      if (success) toast.success(success);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export const useAddCompetitor = () =>
  useCompetitorMutation(({ siteId, domain }: { siteId: string; domain: string }) => seoCompetitorsApi.add(siteId, domain));
export const useRemoveCompetitor = () => useCompetitorMutation((id: string) => seoCompetitorsApi.remove(id));
export const useStartCompetitorScan = () =>
  useCompetitorMutation(({ siteId, locationCode }: { siteId: string; locationCode: number }) => seoCompetitorsApi.start(siteId, locationCode),
    "Comparison started. It usually takes a few minutes.");
export const useDraftPlanItem = () =>
  useCompetitorMutation((id: string) => seoCompetitorsApi.draft(id), "Draft written. Review it in the Content tab.");
export const useSkipPlanItem = () => useCompetitorMutation((id: string) => seoCompetitorsApi.skip(id));
