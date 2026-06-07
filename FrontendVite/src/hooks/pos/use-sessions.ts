import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sessionsApi } from "@/lib/pos/sessions.api";
import type { POSSessionDto, POSSessionSummaryDto } from "@/lib/pos/types";
import { toast } from "sonner";

// ── Query keys ────────────────────────────────────────────────────────────────

export const sessionKeys = {
  all:     ["pos-sessions"] as const,
  active:  () => [...sessionKeys.all, "active"] as const,
  details: () => [...sessionKeys.all, "detail"] as const,
  detail:  (id: string) => [...sessionKeys.details(), id] as const,
};

// ── Queries ───────────────────────────────────────────────────────────────────

export function useActiveSessions() {
  return useQuery<POSSessionSummaryDto[]>({
    queryKey:        sessionKeys.active(),
    queryFn:         sessionsApi.getActive,
    staleTime:       0,          // always fetch fresh — session state is critical
    refetchInterval: 30_000,     // poll every 30s for multi-terminal awareness
  });
}

export function useSession(id: string) {
  return useQuery<POSSessionDto>({
    queryKey: sessionKeys.detail(id),
    queryFn:  () => sessionsApi.getById(id),
    enabled:  !!id,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useOpenSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      registerId: string;
      openingCash: number;
      notes?: string | null;
    }) => sessionsApi.open(payload),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: sessionKeys.active() });
      qc.setQueryData(sessionKeys.detail(data.id), data);
      toast.success(`Session opened on register ${data.registerId}.`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCloseSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      closingCash,
      notes,
    }: {
      sessionId: string;
      closingCash: number;
      notes?: string | null;
    }) => sessionsApi.close(sessionId, { closingCash, notes }),
    onSuccess: (data) => {
      // Clear the active-sessions list immediately (synchronous) so the
      // ShiftGate effect doesn't re-populate session from stale cache.
      qc.setQueryData(sessionKeys.active(), []);
      qc.setQueryData(sessionKeys.detail(data.id), data);
      qc.invalidateQueries({ queryKey: sessionKeys.active() });
      toast.success("Session closed.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRecordCashMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      type,
      amount,
      reason,
    }: {
      sessionId: string;
      type: "payin" | "payout";
      amount: number;
      reason: string;
    }) => sessionsApi.recordCashMovement(sessionId, { type, amount, reason }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: sessionKeys.detail(data.sessionId) });
      toast.success(`${data.type === "PayIn" ? "Cash in" : "Cash out"} recorded: ${data.amount}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSuspendSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      notes,
    }: {
      sessionId: string;
      notes?: string | null;
    }) => sessionsApi.suspend(sessionId, { notes }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: sessionKeys.active() });
      qc.setQueryData(sessionKeys.detail(data.id), data);
      toast.success("Session suspended.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
