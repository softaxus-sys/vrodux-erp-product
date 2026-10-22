import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { whatsappApi, type WaAutoReplies, type WaSendRequest } from "@/lib/whatsapp/whatsapp.api";
import { useCan } from "@/components/auth/can";

const QK = "whatsapp";

export function useWaConnection(enabled = true) {
  return useQuery({ queryKey: [QK, "connection"], queryFn: whatsappApi.getConnection, enabled, staleTime: 60_000 });
}

export function useWaTemplates(approvedOnly = false, enabled = true) {
  return useQuery({ queryKey: [QK, "templates", approvedOnly], queryFn: () => whatsappApi.getTemplates(approvedOnly), enabled });
}

export function useWaConversations(search: string, unreadOnly: boolean) {
  return useQuery({
    queryKey: [QK, "conversations", search, unreadOnly],
    queryFn: () => whatsappApi.getConversations(search, unreadOnly),
    refetchInterval: 15_000,
  });
}

export function useWaMessages(conversationId: string | null) {
  return useQuery({
    queryKey: [QK, "messages", conversationId],
    queryFn: () => whatsappApi.getMessages(conversationId!),
    enabled: !!conversationId,
    refetchInterval: 10_000,
  });
}

export function useWaThread(relatedType: string, relatedId: string | undefined, phone?: string | null, enabled = true) {
  return useQuery({
    queryKey: [QK, "thread", relatedType, relatedId, phone],
    queryFn: () => whatsappApi.getThread(relatedType, relatedId!, phone),
    enabled: enabled && !!relatedId,
  });
}

export function useWaRules(enabled = true) {
  return useQuery({ queryKey: [QK, "rules"], queryFn: whatsappApi.getRules, enabled });
}

export function useWaAutomations(enabled = true) {
  return useQuery({ queryKey: [QK, "automations"], queryFn: whatsappApi.getAutomations, enabled });
}

/** Whether this user may send WhatsApp messages from a record screen. */
export function useCanSendWhatsApp() {
  return useCan("messaging.inbox.send");
}

function useWaMutation<TArgs, TResult>(fn: (a: TArgs) => Promise<TResult>, success?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
      if (success) toast.success(success);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export const useWaConnect      = () => useWaMutation(whatsappApi.connect, "WhatsApp connected.");
export const useWaSetAppSecret = () => useWaMutation((s: string | null) => whatsappApi.setAppSecret(s), "App secret saved.");
export const useWaDisconnect   = () => useWaMutation(() => whatsappApi.disconnect(), "WhatsApp disconnected.");
export const useWaAutoReplies  = () => useWaMutation((b: WaAutoReplies) => whatsappApi.updateAutoReplies(b), "Auto-replies saved.");
export const useWaSyncTemplates = () => useWaMutation(() => whatsappApi.syncTemplates(), "Templates synced from Meta.");
export const useWaCreateTemplate = () => useWaMutation(whatsappApi.createTemplate, "Template sent to Meta for approval.");
export const useWaMarkRead     = () => useWaMutation((id: string) => whatsappApi.markRead(id));
export const useWaSaveRule     = () => useWaMutation(whatsappApi.saveRule, "Rule saved.");
export const useWaDeleteRule   = () => useWaMutation((id: string) => whatsappApi.deleteRule(id), "Rule deleted.");
export const useWaSaveAutomation = () => useWaMutation(whatsappApi.saveAutomation, "Automation saved.");

/** Sending reports a failed delivery as a message, not a success. */
export function useWaSend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: WaSendRequest) => whatsappApi.send(b),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: [QK] });
      if (r.status === "failed") toast.error(r.error ?? "WhatsApp did not accept the message.");
      else toast.success("WhatsApp message sent.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
