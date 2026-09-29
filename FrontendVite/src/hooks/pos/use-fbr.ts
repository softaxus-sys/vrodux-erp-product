import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fbrApi, type SaveFbrSettings } from "@/lib/pos/fbr.api";
import { posSettingsKeys } from "@/hooks/pos/use-pos-settings";

export const fbrKeys = { all: ["pos-fbr"] as const };

/** FBR settings + queue status. Polled so the pending count drains visibly as FBR catches up. */
export function useFbrSettings(enabled = true) {
  return useQuery({
    queryKey: fbrKeys.all,
    queryFn:  fbrApi.get,
    enabled,
    refetchInterval: 30 * 1000,
  });
}

export function useSaveFbrSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SaveFbrSettings) => fbrApi.save(body),
    onSuccess: (data) => {
      qc.setQueryData(fbrKeys.all, data);
      // The till reads fbrEnabled / fee from the POS settings - refresh them too.
      qc.invalidateQueries({ queryKey: posSettingsKeys.all });
      toast.success(data.enabled ? "FBR integration saved and switched on." : "FBR settings saved.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useTestFbrConnection() {
  return useMutation({
    mutationFn: () => fbrApi.test(),
    onError:    (e: Error) => toast.error(e.message),
  });
}

export function useRetryFbr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (transactionId?: string) => fbrApi.retry(transactionId),
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: fbrKeys.all });
      toast.success(n === 1 ? "1 sale queued for FBR again." : `${n} sales queued for FBR again.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
