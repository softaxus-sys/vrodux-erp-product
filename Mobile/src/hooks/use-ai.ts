import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aiApi } from "@/lib/ai.api";
import type { ConfirmActionPayload, SendChatPayload } from "@/types/ai";

const QK = "ai" as const;

export function useAiConversation() {
  return useQuery({
    queryKey: [QK, "conversation"],
    queryFn: aiApi.getConversation,
  });
}

export function useSendChat() {
  return useMutation({
    mutationFn: (payload: SendChatPayload) => aiApi.sendChat(payload),
  });
}

export function useConfirmAction() {
  return useMutation({
    mutationFn: (payload: ConfirmActionPayload) => aiApi.confirmAction(payload),
  });
}

export function useClearConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: aiApi.clearConversation,
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK, "conversation"] }),
  });
}

export function useAiAgents() {
  return useQuery({
    queryKey: [QK, "agents"],
    queryFn: aiApi.getAgents,
    staleTime: 5 * 60 * 1000, // agent roster rarely changes mid-session
  });
}
