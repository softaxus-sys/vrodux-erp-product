import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sessionsApi } from "@/lib/pos/sessions.api";
import type { POSSessionDto, POSSessionSummaryDto } from "@/lib/pos/types";
import { usePosOffline } from "@/contexts/pos-offline-context";
import { toast } from "sonner";

// ── Query keys ────────────────────────────────────────────────────────────────

export const sessionKeys = {
  all:     ["pos-sessions"] as const,
  active:  () => [...sessionKeys.all, "active"] as const,
  details: () => [...sessionKeys.all, "detail"] as const,
  detail:  (id: string) => [...sessionKeys.details(), id] as const,
};

// Every hook below branches on usePosOffline(): null = live mode (unchanged behaviour),
// otherwise the shift lives on this till until the day-end sync.

// ── Queries ───────────────────────────────────────────────────────────────────

export function useActiveSessions() {
  const off = usePosOffline();
  return useQuery<POSSessionSummaryDto[]>({
    queryKey:        off ? [...sessionKeys.active(), "offline"] : sessionKeys.active(),
    queryFn:         off
      ? async () => { const s = await off.engine.getOpenSession(); return s ? [off.engine.toSessionSummary(s)] : []; }
      : sessionsApi.getActive,
    staleTime:       0,          // always fetch fresh — session state is critical
    refetchInterval: off ? false : 30_000, // poll for multi-terminal awareness (live mode only)
  });
}

export function useSession(id: string) {
  const off = usePosOffline();
  return useQuery<POSSessionDto>({
    queryKey: off ? [...sessionKeys.detail(id), "offline"] : sessionKeys.detail(id),
    queryFn:  () => off ? off.engine.getSessionDto(id) : sessionsApi.getById(id),
    enabled:  !!id,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useOpenSession() {
  const qc = useQueryClient();
  const off = usePosOffline();
  return useMutation({
    mutationFn: (payload: {
      registerId: string;
      openingCash: number;
      notes?: string | null;
    }) => off
      ? off.engine.openSession(payload.registerId, payload.openingCash, payload.notes ?? null)
      : sessionsApi.open(payload),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: sessionKeys.active() });
      qc.setQueryData(sessionKeys.detail(data.id), data);
      toast.success(off
        ? `Shift opened on register ${data.registerId} (offline — syncs at day end).`
        : `Session opened on register ${data.registerId}.`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCloseSession() {
  const qc = useQueryClient();
  const off = usePosOffline();
  return useMutation({
    mutationFn: ({
      sessionId,
      closingCash,
      notes,
    }: {
      sessionId: string;
      closingCash: number;
      notes?: string | null;
    }) => off
      ? off.engine.closeSession(sessionId, closingCash, notes ?? null)
      : sessionsApi.close(sessionId, { closingCash, notes }),
    onSuccess: (data) => {
      // Clear the active-sessions list immediately (synchronous) so the
      // ShiftGate effect doesn't re-populate session from stale cache.
      qc.setQueryData(off ? [...sessionKeys.active(), "offline"] : sessionKeys.active(), []);
      qc.setQueryData(sessionKeys.detail(data.id), data);
      qc.invalidateQueries({ queryKey: sessionKeys.active() });
      if (off) {
        toast.success("Shift closed on this till. Sync to Cloud to upload it.");
        // Day end is the moment to upload — offer it straight away when there's a connection.
        if (off.online) off.openSync();
      } else {
        toast.success("Session closed.");
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRecordCashMovement() {
  const qc = useQueryClient();
  const off = usePosOffline();
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
    }) => off
      ? off.engine.recordCashMovement(sessionId, type, amount, reason)
      : sessionsApi.recordCashMovement(sessionId, { type, amount, reason }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: sessionKeys.detail(data.sessionId) });
      toast.success(`${data.type === "PayIn" ? "Cash in" : "Cash out"} recorded: ${data.amount}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSuspendSession() {
  const qc = useQueryClient();
  const off = usePosOffline();
  return useMutation({
    mutationFn: ({
      sessionId,
      notes,
    }: {
      sessionId: string;
      notes?: string | null;
    }) => {
      if (off) throw new Error("Suspending a shift isn't available while this till is in offline mode.");
      return sessionsApi.suspend(sessionId, { notes });
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: sessionKeys.active() });
      qc.setQueryData(sessionKeys.detail(data.id), data);
      toast.success("Session suspended.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
