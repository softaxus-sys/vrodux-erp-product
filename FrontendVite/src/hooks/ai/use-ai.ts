import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  aiApi,
  type AiSettingsDto,
  type SendChatPayload,
  type UpdateAiSettingsPayload,
} from "@/lib/ai/ai.api";

const QK = "ai";

/** Tenant AI settings (admin). Enabled only when the caller can view them. */
export function useAiSettings(enabled = true) {
  return useQuery<AiSettingsDto>({
    queryKey: [QK, "settings"],
    queryFn: () => aiApi.getSettings(),
    enabled,
    staleTime: 60_000,
  });
}

export function useUpdateAiSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateAiSettingsPayload) => aiApi.updateSettings(payload),
    onSuccess: (data) => {
      qc.setQueryData([QK, "settings"], data);
      qc.invalidateQueries({ queryKey: [QK, "settings"] });
      toast.success("AI settings saved.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Send one chat turn. Errors surface as a thrown ApiError; the view renders them inline. */
export function useSendChat() {
  return useMutation({
    mutationFn: (payload: SendChatPayload) => aiApi.sendChat(payload),
  });
}
