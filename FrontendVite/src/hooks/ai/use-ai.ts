import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  aiApi,
  type AiAgentDto,
  type AiSettingsDto,
  type ConfirmActionPayload,
  type SendChatPayload,
  type TelegramLinkStatus,
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

/** Confirm and run a write action the assistant proposed. */
export function useConfirmAction() {
  return useMutation({
    mutationFn: (payload: ConfirmActionPayload) => aiApi.confirmAction(payload),
  });
}

/** The named agents the current user can talk to. */
export function useAiAgents() {
  return useQuery<AiAgentDto[]>({
    queryKey: [QK, "agents"],
    queryFn: () => aiApi.getAgents(),
    staleTime: 5 * 60_000,
  });
}

// ── Telegram ──────────────────────────────────────────────────────────────────

export function useTelegramStatus(enabled = true) {
  return useQuery<TelegramLinkStatus>({
    queryKey: [QK, "telegram-status"],
    queryFn: () => aiApi.getTelegramStatus(),
    enabled,
    staleTime: 30_000,
  });
}

export function useGenerateTelegramLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => aiApi.generateTelegramLink(),
    onSuccess: (data) => qc.setQueryData([QK, "telegram-status"], data),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUnlinkTelegram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => aiApi.unlinkTelegram(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "telegram-status"] });
      toast.success("Telegram disconnected.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRegisterTelegramWebhook() {
  return useMutation({
    mutationFn: () => aiApi.registerTelegramWebhook(),
    onSuccess: () => toast.success("Telegram webhook registered."),
    onError: (e: Error) => toast.error(e.message),
  });
}
