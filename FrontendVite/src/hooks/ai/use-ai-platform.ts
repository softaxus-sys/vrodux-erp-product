import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { aiPlatformApi, type UpdatePlatformAiPayload } from "@/lib/ai/ai-platform.api";

const QK = "ai-platform";

export function usePlatformAi() {
  return useQuery({ queryKey: [QK], queryFn: () => aiPlatformApi.get() });
}

export function useUpdatePlatformAi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: UpdatePlatformAiPayload) => aiPlatformApi.update(p),
    onSuccess: (data) => {
      qc.setQueryData([QK], data);
      // Every workspace's banner and availability depends on this.
      qc.invalidateQueries({ queryKey: ["ai", "capabilities"] });
      toast.success("Platform AI saved.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useTestPlatformAi() {
  return useMutation({
    mutationFn: () => aiPlatformApi.test(),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function usePlatformAiUsage(month?: string) {
  return useQuery({ queryKey: [QK, "usage", month ?? "current"], queryFn: () => aiPlatformApi.usage(month) });
}
