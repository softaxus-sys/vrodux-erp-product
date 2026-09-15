import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { posSettingsApi, type PosSettingsDto, type SwitchReadinessDto } from "@/lib/pos/pos-settings.api";

export const posSettingsKeys = {
  all:       ["pos-settings"] as const,
  readiness: ["pos-settings", "switch-readiness"] as const,
};

/**
 * The tenant's POS mode. Polled so a till notices a switch made from the back office without a reload.
 */
export function usePosSettings(enabled = true) {
  return useQuery<PosSettingsDto>({
    queryKey: posSettingsKeys.all,
    queryFn:  posSettingsApi.get,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    retry: 1,
    enabled,
  });
}

export function useSwitchReadiness() {
  return useQuery<SwitchReadinessDto>({
    queryKey: posSettingsKeys.readiness,
    queryFn:  posSettingsApi.getReadiness,
    staleTime: 0,
    refetchInterval: 15 * 1000, // blockers clear as tills close shifts and sync
  });
}

export function useUpdatePosSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { offlineModeEnabled: boolean; force?: boolean }) => posSettingsApi.update(payload),
    onSuccess: (data) => {
      qc.setQueryData(posSettingsKeys.all, data);
      qc.invalidateQueries({ queryKey: posSettingsKeys.readiness });
      toast.success(data.offlineModeEnabled
        ? "Switched to offline mode. Tills save sales locally and sync at day end."
        : "Switched to online mode. Tills record every sale live.");
    },
    onError: (err: Error) => {
      qc.invalidateQueries({ queryKey: posSettingsKeys.readiness });
      toast.error(err.message);
    },
  });
}
