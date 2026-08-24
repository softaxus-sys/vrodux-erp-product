import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  aiApi,
  type AiAgentDto,
  type AiCapabilitiesDto,
  type AiConversationDto,
  type AiSettingsDto,
  type AutomationRuleDto,
  type AutomationRuleSummaryDto,
  type ConfirmActionPayload,
  type SaveAutomationRulePayload,
  type ScheduledCallDto,
  type SendChatPayload,
  type TelegramLinkStatus,
  type UpdateAiSettingsPayload,
  type UpdateVoiceSettingsPayload,
  type VoiceSettingsDto,
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

/**
 * The current user's persisted chat history. Refetches on every mount (default staleTime), so
 * reopening the assistant panel or navigating back to the full page always shows what this user
 * actually chatted, instead of resetting to a blank conversation.
 */
export function useAiConversation() {
  return useQuery<AiConversationDto>({
    queryKey: [QK, "conversation"],
    queryFn: () => aiApi.getConversation(),
  });
}

/** Clears the current user's persisted conversation (the "Clear chat" / "New chat" action). */
export function useClearConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => aiApi.clearConversation(),
    onSuccess: () => qc.setQueryData([QK, "conversation"], { conversationId: null, messages: [] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Tenant AI capabilities (tier + enabled features). Available to any user — used to gate voice, automations, etc. */
export function useAiCapabilities(enabled = true) {
  return useQuery<AiCapabilitiesDto>({
    queryKey: [QK, "capabilities"],
    queryFn: () => aiApi.getCapabilities(),
    enabled,
    staleTime: 60_000,
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

// ── Voice agent ────────────────────────────────────────────────────────────────

/** Tenant voice-agent settings (admin). */
export function useVoiceSettings(enabled = true) {
  return useQuery<VoiceSettingsDto>({
    queryKey: [QK, "voice-settings"],
    queryFn: () => aiApi.getVoiceSettings(),
    enabled,
    staleTime: 60_000,
  });
}

export function useUpdateVoiceSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateVoiceSettingsPayload) => aiApi.updateVoiceSettings(payload),
    onSuccess: (data) => {
      qc.setQueryData([QK, "voice-settings"], data);
      qc.invalidateQueries({ queryKey: [QK, "voice-settings"] });
      toast.success("Voice agent settings saved.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Recent outbound AI calls, newest first. Short staleTime — statuses move while calls run. */
export function useVoiceCalls(enabled = true) {
  return useQuery<ScheduledCallDto[]>({
    queryKey: [QK, "voice-calls"],
    queryFn: () => aiApi.getVoiceCalls(),
    enabled,
    staleTime: 15_000,
    refetchInterval: enabled ? 30_000 : false,
  });
}

// ── Automations (M4) ────────────────────────────────────────────────────────────

export function useAutomations(enabled = true) {
  return useQuery<AutomationRuleSummaryDto[]>({
    queryKey: [QK, "automations"],
    queryFn: () => aiApi.getAutomations(),
    enabled,
    staleTime: 15_000,
  });
}

export function useAutomationEventTypes(enabled = true) {
  return useQuery({
    queryKey: [QK, "automation-event-types"],
    queryFn: () => aiApi.getAutomationEventTypes(),
    enabled,
    staleTime: 10 * 60_000,
  });
}

export function useAutomation(id: string | null) {
  return useQuery<AutomationRuleDto>({
    queryKey: [QK, "automation", id],
    queryFn: () => aiApi.getAutomation(id!),
    enabled: !!id,
    staleTime: 10_000,
  });
}

function invalidateAutomations(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: [QK, "automations"] });
  qc.invalidateQueries({ queryKey: [QK, "automation"] });
}

export function useCreateAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveAutomationRulePayload) => aiApi.createAutomation(payload),
    onSuccess: () => {
      invalidateAutomations(qc);
      toast.success("Automation created.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: SaveAutomationRulePayload }) =>
      aiApi.updateAutomation(id, payload),
    onSuccess: () => {
      invalidateAutomations(qc);
      toast.success("Automation updated.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useToggleAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      enabled ? aiApi.enableAutomation(id) : aiApi.disableAutomation(id),
    onSuccess: (_d, v) => {
      invalidateAutomations(qc);
      toast.success(v.enabled ? "Automation enabled." : "Automation paused.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => aiApi.deleteAutomation(id),
    onSuccess: () => {
      invalidateAutomations(qc);
      toast.success("Automation deleted.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRunAutomationNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => aiApi.runAutomationNow(id),
    onSuccess: (run) => {
      invalidateAutomations(qc);
      if (run.status === "success") toast.success("Automation ran successfully.");
      else if (run.status === "pending_confirmation") toast.info("Automation ran — an action is awaiting approval.");
      else if (run.status === "failed") toast.error(run.error ?? "Automation run failed.");
      else toast.success("Automation ran.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useResolveAutomationRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ runId, approve }: { runId: string; approve: boolean }) =>
      approve ? aiApi.approveAutomationRun(runId) : aiApi.rejectAutomationRun(runId),
    onSuccess: (_d, v) => {
      invalidateAutomations(qc);
      toast.success(v.approve ? "Action approved and run." : "Action rejected.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
