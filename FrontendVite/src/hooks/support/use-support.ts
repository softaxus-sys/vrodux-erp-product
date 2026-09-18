import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  supportApi,
  type TicketStatus, type TicketCategory, type CreateTicketRequest, type AttachmentInput,
} from "@/lib/support/support.api";

const QK = "support";

export function useMyTickets(status?: TicketStatus) {
  return useQuery({
    queryKey: [QK, "my-tickets", status ?? "all"],
    queryFn: () => supportApi.getMyTickets(status),
    staleTime: 30 * 1000,
  });
}

export function useTicket(id: string | null) {
  return useQuery({
    queryKey: [QK, "ticket", id],
    queryFn: () => supportApi.getTicket(id!),
    enabled: !!id,
    staleTime: 15 * 1000,
  });
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTicketRequest) => supportApi.createTicket(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "my-tickets"] });
      toast.success("Ticket submitted — we'll be in touch by email.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAddTicketMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body, attachments }: { id: string; body: string; attachments?: AttachmentInput[] }) =>
      supportApi.addMessage(id, body, attachments),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [QK, "ticket", vars.id] });
      qc.invalidateQueries({ queryKey: [QK, "my-tickets"] });
      qc.invalidateQueries({ queryKey: [QK, "queue"] });
      toast.success("Reply sent.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Agent queue ───────────────────────────────────────────────────────────────

export function useSupportQueue(params?: { status?: TicketStatus; category?: TicketCategory; assignedToUserId?: string }) {
  return useQuery({
    queryKey: [QK, "queue", params ?? {}],
    queryFn: () => supportApi.getQueue(params),
    staleTime: 15 * 1000,
  });
}

export function useSupportQueueSummary() {
  return useQuery({
    queryKey: [QK, "queue-summary"],
    queryFn: supportApi.getQueueSummary,
    staleTime: 15 * 1000,
  });
}

export function useSupportAgents(enabled = true) {
  return useQuery({
    queryKey: [QK, "agents"],
    queryFn: supportApi.getAgents,
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

function useSupportMutation<T>(fn: (a: T) => Promise<unknown>, msg?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
      if (msg) toast.success(msg);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useChangeTicketStatus() {
  return useSupportMutation(
    ({ id, status }: { id: string; status: TicketStatus }) => supportApi.changeStatus(id, status),
    "Ticket status updated.");
}

export function useAssignTicket() {
  return useSupportMutation(
    (v: { id: string; assignToUserId: string | null; assignToUserName: string | null; note?: string }) =>
      supportApi.assign(v.id, v.assignToUserId, v.assignToUserName, v.note),
    "Ticket assignment updated.");
}

export function useSetTicketPriority() {
  return useSupportMutation(
    ({ id, priority }: { id: string; priority: import("@/lib/support/support.api").TicketPriority }) =>
      supportApi.setPriority(id, priority),
    "Priority updated.");
}
