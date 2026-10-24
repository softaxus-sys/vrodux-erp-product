import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { platformsApi, taxApi, type SavePlatformConnection, type SaveTaxProfile } from "@/lib/restaurant/tax-platforms.api";
import { rKeys } from "./use-restaurant";

const taxKey = [...rKeys.all, "tax-settings"] as const;
const queueKey = [...rKeys.all, "fbr-queue"] as const;
const platformsKey = [...rKeys.all, "platforms"] as const;

export function useTaxSettings() {
  return useQuery({ queryKey: taxKey, queryFn: taxApi.get });
}

/** Saves the workspace setting (branchId null) or one branch's own. */
export function useSaveTaxProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ branchId, data }: { branchId: string | null; data: SaveTaxProfile }) =>
      branchId ? taxApi.saveBranch(branchId, data) : taxApi.saveWorkspace(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taxKey });
      qc.invalidateQueries({ queryKey: [...rKeys.all, "current-tax"] });
      toast.success("Tax setting saved. New bills use it; bills already open keep their rate.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteBranchTax() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (branchId: string) => taxApi.deleteBranch(branchId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taxKey });
      qc.invalidateQueries({ queryKey: [...rKeys.all, "current-tax"] });
      toast.success("The branch now uses the workspace setting.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useTestBranchFbr() {
  return useMutation({ mutationFn: (branchId: string) => taxApi.testFbr(branchId), onError: (e: Error) => toast.error(e.message) });
}

export function useFbrQueue(branchId: string | null, enabled = true) {
  return useQuery({ queryKey: [...queueKey, branchId], queryFn: () => taxApi.fbrQueue(branchId), enabled, refetchInterval: 60_000 });
}

export function useRetryFbrQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId?: string) => taxApi.retryFbr(orderId),
    onSuccess: n => {
      qc.invalidateQueries({ queryKey: queueKey });
      qc.invalidateQueries({ queryKey: rKeys.all });
      toast.success(n > 0 ? `${n} bill(s) accepted by FBR.` : "Nothing was accepted — see the reason on each bill.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Foodpanda ──

export function usePlatformConnections(enabled = true) {
  return useQuery({ queryKey: platformsKey, queryFn: platformsApi.list, enabled });
}

export function useSavePlatformConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string | null; data: SavePlatformConnection }) =>
      id ? platformsApi.update(id, data) : platformsApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: platformsKey }); toast.success("Foodpanda connection saved."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeletePlatformConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => platformsApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: platformsKey }); toast.success("Foodpanda connection removed."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useTestPlatformConnection() {
  return useMutation({ mutationFn: (id: string) => platformsApi.test(id), onError: (e: Error) => toast.error(e.message) });
}
