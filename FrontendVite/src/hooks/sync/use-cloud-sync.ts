import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cloudSyncApi, type UpdateCloudSyncRequest } from "@/lib/sync/cloud-sync.api";

const QK = "cloud-sync";

export function useCloudSyncSettings() {
  return useQuery({
    queryKey: [QK, "settings"],
    queryFn:  () => cloudSyncApi.get(),
    // A run takes a while and the screen should show it finishing without anyone pressing reload.
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

export function useCloudSyncRuns(take = 30) {
  return useQuery({
    queryKey: [QK, "runs", take],
    queryFn:  () => cloudSyncApi.runs(take),
    refetchInterval: 30_000,
  });
}

export function useUpdateCloudSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateCloudSyncRequest) => cloudSyncApi.update(body),
    onSuccess: (data) => {
      qc.setQueryData([QK, "settings"], data);
      toast.success("Cloud sync settings saved.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRunCloudSyncNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => cloudSyncApi.runNow(),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: [QK] });

      // Three genuinely different outcomes. Reporting a skipped run as success is the most
      // misleading thing this screen could do — the operator would walk away from a box that
      // never pushed anything.
      if (!r.ran)        toast.warning(r.skippedReason ?? "Nothing to do — sync is not configured.");
      else if (r.succeeded)
        toast.success(
          r.rowsSent > 0
            ? `Pushed ${r.rowsSent.toLocaleString()} row(s) across ${r.tablesProcessed} table(s).`
            : "Already up to date — nothing has changed since the last run.");
      else
        toast.error(
          `${r.tablesFailed} table(s) failed. ${r.failures[0]?.error ?? ""}`.trim());
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReseedCloudSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => cloudSyncApi.reseed(),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: [QK] });
      toast.success(`${r.cleared} table(s) cleared. Everything will be re-sent on the next run.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
